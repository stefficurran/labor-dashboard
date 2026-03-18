"""Export layoffs data from DuckDB as JSON for the Next.js dashboard."""

import json
import duckdb

DB_PATH = "../data/labor.duckdb"
OUT_PATH = "../dashboard/public/data/layoffs.json"

con = duckdb.connect(DB_PATH, read_only=True)

# Monthly aggregates
monthly_rows = con.execute("""
    SELECT DATE_TRUNC('month', date) as month,
           SUM(total_laid_off) as total,
           COUNT(DISTINCT company) as companies
    FROM layoffs
    GROUP BY 1
    ORDER BY 1
""").fetchall()

monthly_data = [
    {"date": row[0].strftime("%Y-%m-%d"), "total": int(row[1])}
    for row in monthly_rows
]

# Cumulative running sum
cumulative_data = []
running = 0
for row in monthly_rows:
    running += int(row[1])
    cumulative_data.append({
        "date": row[0].strftime("%Y-%m-%d"),
        "cumulative": running,
    })

# By industry
industry_rows = con.execute("""
    SELECT industry,
           SUM(total_laid_off) as total,
           COUNT(DISTINCT company) as companies
    FROM layoffs
    GROUP BY industry
    ORDER BY total DESC
""").fetchall()

by_industry = [
    {"industry": row[0], "total": int(row[1]), "companies": int(row[2])}
    for row in industry_rows
]

# Top 20 companies
company_rows = con.execute("""
    SELECT company,
           SUM(total_laid_off) as total,
           COUNT(*) as rounds
    FROM layoffs
    GROUP BY company
    ORDER BY total DESC
    LIMIT 20
""").fetchall()

top_companies = [
    {"company": row[0], "total": int(row[1]), "rounds": int(row[2])}
    for row in company_rows
]

# WARN Act monthly totals (if table exists)
warn_monthly_section = None
try:
    tables = [row[0] for row in con.execute("SHOW TABLES").fetchall()]
    if "warn_notices" in tables:
        warn_rows = con.execute("""
            SELECT DATE_TRUNC('month', notice_date) as month,
                   SUM(employees_affected) as total
            FROM warn_notices
            WHERE employees_affected IS NOT NULL
            GROUP BY 1
            ORDER BY 1
        """).fetchall()
        if warn_rows:
            warn_monthly_data = [
                {"date": row[0].strftime("%Y-%m-%d"), "total": int(row[1])}
                for row in warn_rows
            ]
            warn_monthly_section = {
                "title": "WARN Act Notices (Monthly)",
                "subtitle": "Government-reported layoff notices, employees affected",
                "labels": ["total"],
                "data": warn_monthly_data,
            }
            print(f"  {len(warn_monthly_data)} months of WARN data included")
except Exception as e:
    print(f"  WARN data skipped: {e}")

# Assemble output
output = {
    "monthly": {
        "title": "Monthly Tech Layoffs",
        "subtitle": "Total employees laid off per month",
        "labels": ["total"],
        "data": monthly_data,
    },
    "cumulative": {
        "title": "Cumulative Layoffs",
        "subtitle": "Running total since March 2020",
        "labels": ["cumulative"],
        "data": cumulative_data,
    },
    "by_industry": by_industry,
    "top_companies": top_companies,
}

if warn_monthly_section:
    output["warn_monthly"] = warn_monthly_section

with open(OUT_PATH, "w") as f:
    json.dump(output, f, indent=2)

print(f"Exported {len(monthly_data)} months of data")
print(f"  {len(by_industry)} industries")
print(f"  {len(top_companies)} top companies")
print(f"  Written to {OUT_PATH}")

con.close()
