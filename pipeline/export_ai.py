"""Export AI-related data from DuckDB as JSON for the AI tab."""

import json
import duckdb
import polars as pl

DB_PATH = "../data/labor.duckdb"
OUT_PATH = "../dashboard/public/data/ai.json"

con = duckdb.connect(DB_PATH, read_only=True)
output = {}

# ---------------------------------------------------------------------------
# 1. AI Job Postings Share (monthly from daily indeed_ai)
# ---------------------------------------------------------------------------
rows = con.execute("SELECT date, ai_share FROM indeed_ai ORDER BY date").fetchall()
if rows:
    df = pl.DataFrame({"date": [r[0] for r in rows], "ai_share": [r[1] for r in rows]})
    df = df.with_columns(pl.col("date").cast(pl.Date))
    monthly = (
        df.group_by_dynamic("date", every="1mo")
        .agg(pl.col("ai_share").last())
    )
    output["ai_job_share"] = {
        "title": "AI Job Postings Share",
        "subtitle": "% of all US Indeed postings mentioning AI",
        "labels": ["AI Share"],
        "data": [
            {"date": r["date"].isoformat(), "AI Share": round(r["ai_share"], 2)}
            for r in monthly.iter_rows(named=True)
        ],
    }

# ---------------------------------------------------------------------------
# 2. Software Dev Postings vs All Jobs (monthly from daily)
# ---------------------------------------------------------------------------
rows = con.execute("""
    SELECT sd.date, sd.value AS softdev, al.value AS all_jobs
    FROM observations sd
    JOIN observations al ON sd.date = al.date
    WHERE sd.series_id = 'IHLIDXUSTPSOFTDEVE'
      AND al.series_id = 'IHLIDXUS'
    ORDER BY sd.date
""").fetchall()
if rows:
    df = pl.DataFrame({
        "date": [r[0] for r in rows],
        "softdev": [r[1] for r in rows],
        "all_jobs": [r[2] for r in rows],
    }).with_columns(pl.col("date").cast(pl.Date))
    monthly = (
        df.group_by_dynamic("date", every="1mo")
        .agg(pl.col("softdev").last(), pl.col("all_jobs").last())
    )
    output["software_dev_postings"] = {
        "title": "Job Postings: Software Dev vs All Jobs",
        "subtitle": "Indeed index, Feb 2020 = 100",
        "labels": ["Software Dev", "All Jobs"],
        "data": [
            {
                "date": r["date"].isoformat(),
                "Software Dev": round(r["softdev"], 1),
                "All Jobs": round(r["all_jobs"], 1),
            }
            for r in monthly.iter_rows(named=True)
        ],
    }

# ---------------------------------------------------------------------------
# 3. Computer & Mathematical Occupations (annual)
# ---------------------------------------------------------------------------
rows = con.execute("""
    SELECT date, value FROM observations
    WHERE series_id = 'LEU0254476900A' ORDER BY date
""").fetchall()
if rows:
    output["computer_math_employment"] = {
        "title": "Computer & Mathematical Occupations",
        "subtitle": "Full-time employed, thousands (annual)",
        "labels": ["employment"],
        "data": [
            {"date": r[0].isoformat(), "employment": r[1]}
            for r in rows
        ],
    }

# ---------------------------------------------------------------------------
# 4. IT Investment vs R&D Spending (quarterly)
# ---------------------------------------------------------------------------
rows = con.execute("""
    SELECT it.date,
           it.value AS it_val,
           rd.value AS rd_val
    FROM observations it
    JOIN observations rd ON it.date = rd.date
    WHERE it.series_id = 'A679RC1Q027SBEA'
      AND rd.series_id = 'Y006RC1Q027SBEA'
    ORDER BY it.date
""").fetchall()
if rows:
    output["it_investment"] = {
        "title": "IT Investment vs R&D Spending",
        "subtitle": "Billions of dollars, quarterly, seasonally adjusted annual rate",
        "labels": ["IT Equipment & Software", "R&D"],
        "data": [
            {
                "date": r[0].isoformat(),
                "IT Equipment & Software": round(r[1], 1),
                "R&D": round(r[2], 1),
            }
            for r in rows
        ],
    }

# ---------------------------------------------------------------------------
# 5. Semiconductor Production Index (monthly)
# ---------------------------------------------------------------------------
rows = con.execute("""
    SELECT date, value FROM observations
    WHERE series_id = 'IPG3344S' ORDER BY date
""").fetchall()
if rows:
    output["semiconductor_production"] = {
        "title": "Semiconductor Production Index",
        "subtitle": "Industrial production index, 2017 = 100",
        "labels": ["index"],
        "data": [
            {"date": r[0].isoformat(), "index": round(r[1], 1)}
            for r in rows
        ],
    }

# ---------------------------------------------------------------------------
# 6. IT Investment vs Tech Employment (indexed to 100)
# ---------------------------------------------------------------------------
# A679RC1Q027SBEA is quarterly, USINFO is monthly
# Align by taking last month of each quarter for employment
it_rows = con.execute("""
    SELECT date, value FROM observations
    WHERE series_id = 'A679RC1Q027SBEA' ORDER BY date
""").fetchall()
emp_rows = con.execute("""
    SELECT date, value FROM observations
    WHERE series_id = 'USINFO' ORDER BY date
""").fetchall()
if it_rows and emp_rows:
    # Build lookup: for each quarter end date, find employment at that month
    emp_lookup = {r[0]: r[1] for r in emp_rows}
    paired = []
    for r in it_rows:
        qtr_date = r[0]
        # Quarter dates from BEA are start of quarter (Jan, Apr, Jul, Oct)
        # Map to last month of quarter: Jan->Mar, Apr->Jun, Jul->Sep, Oct->Dec
        import datetime
        month_map = {1: 3, 4: 6, 7: 9, 10: 12}
        end_month = month_map.get(qtr_date.month, qtr_date.month)
        emp_date = datetime.date(qtr_date.year, end_month, 1)
        emp_val = emp_lookup.get(emp_date)
        if emp_val is not None:
            paired.append((qtr_date, r[1], emp_val))

    if paired:
        it_base = paired[0][1]
        emp_base = paired[0][2]
        output["investment_vs_hiring"] = {
            "title": "IT Investment vs Tech Employment",
            "subtitle": "Both indexed to 100 — does investment lead hiring?",
            "labels": ["IT Investment", "Tech Employment"],
            "data": [
                {
                    "date": p[0].isoformat(),
                    "IT Investment": round(p[1] / it_base * 100, 1),
                    "Tech Employment": round(p[2] / emp_base * 100, 1),
                }
                for p in paired
            ],
        }

# ---------------------------------------------------------------------------
# 7. NVIDIA Stock vs Tech Employment (indexed to 100)
# ---------------------------------------------------------------------------
nvda_rows = con.execute("""
    SELECT date, value FROM observations
    WHERE series_id = 'NVDA' ORDER BY date
""").fetchall()
if nvda_rows and emp_rows:
    # Resample NVDA daily to monthly using Polars
    nvda_df = pl.DataFrame({
        "date": [r[0] for r in nvda_rows],
        "nvda": [r[1] for r in nvda_rows],
    }).with_columns(pl.col("date").cast(pl.Date))
    nvda_monthly = (
        nvda_df.group_by_dynamic("date", every="1mo")
        .agg(pl.col("nvda").last())
    )

    emp_df = pl.DataFrame({
        "date": [r[0] for r in emp_rows],
        "emp": [r[1] for r in emp_rows],
    }).with_columns(pl.col("date").cast(pl.Date))

    joined = nvda_monthly.join(emp_df, on="date", how="inner").sort("date")

    if len(joined) > 0:
        first = joined.row(0, named=True)
        nvda_base = first["nvda"]
        emp_base = first["emp"]
        output["nvda_vs_employment"] = {
            "title": "NVIDIA Stock vs Tech Employment",
            "subtitle": "Both indexed to 100 — AI spending proxy vs jobs",
            "labels": ["NVIDIA", "Tech Employment"],
            "data": [
                {
                    "date": r["date"].isoformat(),
                    "NVIDIA": round(r["nvda"] / nvda_base * 100, 1),
                    "Tech Employment": round(r["emp"] / emp_base * 100, 1),
                }
                for r in joined.iter_rows(named=True)
            ],
        }

# ---------------------------------------------------------------------------
# 8. Sector AI Adoption (latest survey period)
# ---------------------------------------------------------------------------
adoption_rows = con.execute("""
    SELECT naics_label, naics_code, ai_adoption_pct
    FROM btos_ai_adoption
    WHERE survey_date = (SELECT MAX(survey_date) FROM btos_ai_adoption)
    ORDER BY ai_adoption_pct DESC
""").fetchall()
if adoption_rows:
    output["sector_ai_adoption"] = [
        {
            "sector": r[0],
            "naics": r[1],
            "adoption_pct": round(r[2], 1),
        }
        for r in adoption_rows
    ]

# ---------------------------------------------------------------------------
# Write output
# ---------------------------------------------------------------------------
import os
os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)

with open(OUT_PATH, "w") as f:
    json.dump(output, f)

con.close()

print(f"Exported to {OUT_PATH}")
print(f"Sections: {list(output.keys())}")
for k, v in output.items():
    if isinstance(v, list):
        print(f"  {k}: {len(v)} sectors")
    elif isinstance(v, dict) and "data" in v:
        print(f"  {k}: {len(v['data'])} data points")
