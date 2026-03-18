"""Export layoffs data from DuckDB as JSON for the Next.js dashboard."""

import json
import duckdb

DB_PATH = "../data/labor.duckdb"
OUT_PATH = "../dashboard/public/data/layoffs.json"

con = duckdb.connect(DB_PATH, read_only=True)

# US-only filter for all layoffs.fyi queries
US_FILTER = "country = 'United States'"

# Monthly aggregates (layoffs.fyi)
monthly_rows = con.execute(f"""
    SELECT DATE_TRUNC('month', date) as month,
           SUM(total_laid_off) as total,
           COUNT(DISTINCT company) as companies
    FROM layoffs
    WHERE {US_FILTER}
    GROUP BY 1
    ORDER BY 1
""").fetchall()

monthly_data = [
    {"date": row[0].strftime("%Y-%m-%d"), "total": int(row[1])}
    for row in monthly_rows
]

# Monthly layoffs by industry (top 8 industries, layoffs.fyi)
top_industries = con.execute(f"""
    SELECT industry FROM layoffs
    WHERE {US_FILTER} AND industry IS NOT NULL
    GROUP BY industry
    ORDER BY SUM(total_laid_off) DESC
    LIMIT 8
""").fetchall()
top_industry_names = [r[0] for r in top_industries]

industry_monthly_rows = con.execute(f"""
    SELECT DATE_TRUNC('month', date) as month, industry, SUM(total_laid_off) as total
    FROM layoffs
    WHERE {US_FILTER} AND total_laid_off IS NOT NULL
          AND industry IN ({','.join(f"'{i}'" for i in top_industry_names)})
    GROUP BY 1, 2
    ORDER BY 1
""").fetchall()

# Pivot into {date, Industry1, Industry2, ...} format
industry_by_date: dict[str, dict] = {}
for row in industry_monthly_rows:
    d = row[0].strftime("%Y-%m-%d")
    if d not in industry_by_date:
        industry_by_date[d] = {"date": d}
    industry_by_date[d][row[1]] = int(row[2])

industry_monthly_data = list(industry_by_date.values())

# Top layoff events — individual rounds with dates and context
top_events = con.execute(f"""
    SELECT company, date, total_laid_off, industry, percentage_laid_off
    FROM layoffs
    WHERE {US_FILTER} AND total_laid_off IS NOT NULL
    ORDER BY total_laid_off DESC
    LIMIT 25
""").fetchall()

top_events_data = [
    {
        "company": r[0],
        "date": r[1].strftime("%Y-%m-%d"),
        "laid_off": int(r[2]),
        "industry": r[3],
        "percentage": round(r[4] * 100) if r[4] else None,
    }
    for r in top_events
]

# Recent layoff events — most recent by date
recent_events = con.execute(f"""
    SELECT company, date, total_laid_off, industry, percentage_laid_off
    FROM layoffs
    WHERE {US_FILTER} AND total_laid_off IS NOT NULL
    ORDER BY date DESC
    LIMIT 25
""").fetchall()

recent_events_data = [
    {
        "company": r[0],
        "date": r[1].strftime("%Y-%m-%d"),
        "laid_off": int(r[2]),
        "industry": r[3],
        "percentage": round(r[4] * 100) if r[4] else None,
    }
    for r in recent_events
]

# WARN Act sections (if table exists)
warn_monthly_section = None
warn_industry_section = None
try:
    tables = [row[0] for row in con.execute("SHOW TABLES").fetchall()]
    if "warn_notices" in tables:
        # Monthly totals
        warn_rows = con.execute("""
            SELECT DATE_TRUNC('month', notice_date) as month,
                   SUM(employees_affected) as total
            FROM warn_notices
            WHERE employees_affected IS NOT NULL
            GROUP BY 1
            ORDER BY 1
        """).fetchall()
        if warn_rows:
            warn_monthly_section = {
                "title": "WARN Act Notices (Monthly)",
                "subtitle": "Government-reported layoff notices, employees affected",
                "labels": ["total"],
                "data": [
                    {"date": row[0].strftime("%Y-%m-%d"), "total": int(row[1])}
                    for row in warn_rows
                ],
            }
            print(f"  {len(warn_rows)} months of WARN data included")

        # Monthly by industry (top 8)
        warn_top_ind = con.execute("""
            SELECT industry FROM warn_notices
            WHERE industry IS NOT NULL AND employees_affected IS NOT NULL
            GROUP BY industry
            ORDER BY SUM(employees_affected) DESC
            LIMIT 8
        """).fetchall()
        warn_ind_names = [r[0] for r in warn_top_ind]

        if warn_ind_names:
            warn_ind_rows = con.execute(f"""
                SELECT DATE_TRUNC('month', notice_date) as month, industry,
                       SUM(employees_affected) as total
                FROM warn_notices
                WHERE industry IN ({','.join(f"'{i}'" for i in warn_ind_names)})
                      AND employees_affected IS NOT NULL
                GROUP BY 1, 2
                ORDER BY 1
            """).fetchall()

            warn_ind_by_date: dict[str, dict] = {}
            for row in warn_ind_rows:
                d = row[0].strftime("%Y-%m-%d")
                if d not in warn_ind_by_date:
                    warn_ind_by_date[d] = {"date": d}
                warn_ind_by_date[d][row[1]] = int(row[2])

            warn_industry_section = {
                "title": "WARN Notices by Industry",
                "subtitle": "Monthly employees affected by industry (government-sourced)",
                "labels": warn_ind_names,
                "data": list(warn_ind_by_date.values()),
            }
            print(f"  {len(warn_ind_names)} WARN industries included")

except Exception as e:
    print(f"  WARN data skipped: {e}")

# Assemble output
output = {
    "monthly": {
        "title": "Monthly Tech Layoffs (US)",
        "subtitle": "Total employees laid off per month — Layoffs.fyi (crowdsourced)",
        "labels": ["total"],
        "data": monthly_data,
    },
    "industry_monthly": {
        "title": "Layoffs by Industry Over Time",
        "subtitle": "Monthly layoffs for top industries — Layoffs.fyi (crowdsourced, US only)",
        "labels": top_industry_names,
        "data": industry_monthly_data,
    },
    "top_events": top_events_data,
    "recent_events": recent_events_data,
}

if warn_monthly_section:
    output["warn_monthly"] = warn_monthly_section
if warn_industry_section:
    output["warn_industry"] = warn_industry_section

with open(OUT_PATH, "w") as f:
    json.dump(output, f, indent=2)

print(f"Exported {len(monthly_data)} months of data")
print(f"  {len(top_industry_names)} industries (monthly)")
print(f"  {len(top_events_data)} top events")
print(f"  Written to {OUT_PATH}")

con.close()
