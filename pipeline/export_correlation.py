"""Export correlation charts joining stock market, layoffs, and labor data."""

import json
import duckdb
import polars as pl

DB_PATH = "../data/labor.duckdb"
OUT_PATH = "../dashboard/public/data/correlation.json"

con = duckdb.connect(DB_PATH, read_only=True)

# --- 1. Monthly stock data (SP500, NASDAQCOM) ---

stock_series = {"SP500": "S&P 500", "NASDAQCOM": "NASDAQ"}
stock_frames = {}

for series_id, label in stock_series.items():
    rows = con.execute(
        "SELECT date, value FROM observations WHERE series_id = ? ORDER BY date",
        [series_id],
    ).fetchall()
    df = pl.DataFrame({"date": [r[0] for r in rows], "value": [r[1] for r in rows]})
    df = df.with_columns(pl.col("date").cast(pl.Date))
    monthly = (
        df.sort("date")
        .group_by_dynamic("date", every="1mo")
        .agg(pl.col("value").last())
    )
    stock_frames[label] = monthly

# --- 2. Monthly tech employment (USINFO) ---

emp_rows = con.execute(
    "SELECT date, value FROM observations WHERE series_id = 'USINFO' ORDER BY date"
).fetchall()
emp_df = pl.DataFrame(
    {"date": [r[0] for r in emp_rows], "Tech Employment": [r[1] for r in emp_rows]}
).with_columns(pl.col("date").cast(pl.Date))

# --- 3. JOLTS layoffs (JTU5100LDL) and job openings (JTU5100JOL) ---

jolts_series = {"JTU5100LDL": "JOLTS Layoffs (K)", "JTU5100JOL": "Job Openings"}
jolts_frames = {}

for series_id, label in jolts_series.items():
    rows = con.execute(
        "SELECT date, value FROM observations WHERE series_id = ? ORDER BY date",
        [series_id],
    ).fetchall()
    df = pl.DataFrame({"date": [r[0] for r in rows], "value": [r[1] for r in rows]})
    df = df.with_columns(pl.col("date").cast(pl.Date)).rename({"value": label})
    jolts_frames[label] = df

# --- 4. Monthly layoffs.fyi totals ---

layoffs_data = []
try:
    layoffs_rows = con.execute("""
        SELECT DATE_TRUNC('month', date) as month, SUM(total_laid_off) as total
        FROM layoffs
        GROUP BY 1
        ORDER BY 1
    """).fetchall()
    if layoffs_rows:
        layoffs_data = layoffs_rows
except Exception:
    pass

layoffs_df = None
if layoffs_data:
    layoffs_df = pl.DataFrame(
        {"date": [r[0] for r in layoffs_data], "Layoffs.fyi": [int(r[1]) for r in layoffs_data]}
    ).with_columns(pl.col("date").cast(pl.Date))

# --- 5. Chart 1: market_vs_employment (S&P 500 vs Tech Employment, indexed) ---

sp_monthly = stock_frames["S&P 500"].rename({"value": "S&P 500"})
overlay1 = sp_monthly.join(emp_df, on="date", how="inner").sort("date")

if len(overlay1) > 0:
    sp_base = overlay1["S&P 500"][0]
    emp_base = overlay1["Tech Employment"][0]
    market_vs_emp_data = []
    for row in overlay1.iter_rows(named=True):
        market_vs_emp_data.append({
            "date": row["date"].isoformat(),
            "S&P 500": round(row["S&P 500"] / sp_base * 100, 2),
            "Tech Employment": round(row["Tech Employment"] / emp_base * 100, 2),
        })
else:
    market_vs_emp_data = []

# --- 6. Chart 2: layoffs_vs_jolts (raw values, not indexed) ---

layoffs_vs_jolts_data = []
if layoffs_df is not None and "JOLTS Layoffs (K)" in jolts_frames:
    jolts_layoffs = jolts_frames["JOLTS Layoffs (K)"]
    overlay2 = layoffs_df.join(jolts_layoffs, on="date", how="inner").sort("date")
    for row in overlay2.iter_rows(named=True):
        layoffs_vs_jolts_data.append({
            "date": row["date"].isoformat(),
            "Layoffs.fyi": row["Layoffs.fyi"],
            "JOLTS Layoffs (K)": round(row["JOLTS Layoffs (K)"], 1),
        })

# --- 7. Chart 3: nasdaq_vs_openings (indexed) ---

nq_monthly = stock_frames["NASDAQ"].rename({"value": "NASDAQ"})
openings = jolts_frames["Job Openings"]
overlay3 = nq_monthly.join(openings, on="date", how="inner").sort("date")

if len(overlay3) > 0:
    nq_base = overlay3["NASDAQ"][0]
    jo_base = overlay3["Job Openings"][0]
    nasdaq_vs_openings_data = []
    for row in overlay3.iter_rows(named=True):
        nasdaq_vs_openings_data.append({
            "date": row["date"].isoformat(),
            "NASDAQ": round(row["NASDAQ"] / nq_base * 100, 2),
            "Job Openings": round(row["Job Openings"] / jo_base * 100, 2),
        })
else:
    nasdaq_vs_openings_data = []

# --- 8. Build output ---

output = {
    "market_vs_employment": {
        "title": "S&P 500 vs Tech Employment",
        "subtitle": "Both indexed to 100 — do stocks lead hiring?",
        "labels": ["S&P 500", "Tech Employment"],
        "data": market_vs_emp_data,
    },
    "layoffs_vs_jolts": {
        "title": "Layoffs.fyi vs JOLTS Information Layoffs",
        "subtitle": "Crowdsourced vs government data, thousands",
        "labels": ["Layoffs.fyi", "JOLTS Layoffs (K)"],
        "data": layoffs_vs_jolts_data,
    },
    "nasdaq_vs_openings": {
        "title": "NASDAQ vs Info Job Openings",
        "subtitle": "Both indexed to 100 — does the stock market predict hiring?",
        "labels": ["NASDAQ", "Job Openings"],
        "data": nasdaq_vs_openings_data,
    },
}

import os
os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)

with open(OUT_PATH, "w") as f:
    json.dump(output, f)

con.close()

print(f"Exported to {OUT_PATH}")
print(f"Charts: {list(output.keys())}")
for key, chart in output.items():
    print(f"  {key}: {len(chart['data'])} data points")
