"""Export stock market data as JSON for the Next.js dashboard."""

import json
import duckdb
import polars as pl

DB_PATH = "../data/labor.duckdb"
OUT_PATH = "../dashboard/public/data"

con = duckdb.connect(DB_PATH, read_only=True)

# --- 1. Query daily stock data and resample to monthly ---

stock_series = {"SP500": "S&P 500", "NASDAQCOM": "NASDAQ"}

stock_frames = {}
for series_id, label in stock_series.items():
    rows = con.execute(
        "SELECT date, value FROM observations WHERE series_id = ? ORDER BY date",
        [series_id],
    ).fetchall()
    df = pl.DataFrame({"date": [r[0] for r in rows], "value": [r[1] for r in rows]})
    df = df.with_columns(pl.col("date").cast(pl.Date))

    # Resample daily -> monthly: take last value per month (month-end close)
    monthly = (
        df.sort("date")
        .group_by_dynamic("date", every="1mo")
        .agg(pl.col("value").last())
    )
    stock_frames[label] = monthly

# Join S&P 500 and NASDAQ on date
sp = stock_frames["S&P 500"].rename({"value": "S&P 500"})
nq = stock_frames["NASDAQ"].rename({"value": "NASDAQ"})
stocks = sp.join(nq, on="date", how="inner").sort("date")

# Build stock_indices output
stock_indices_data = []
for row in stocks.iter_rows(named=True):
    stock_indices_data.append({
        "date": row["date"].isoformat(),
        "S&P 500": round(row["S&P 500"], 2),
        "NASDAQ": round(row["NASDAQ"], 2),
    })

# Build stock_indexed output (base 100 at first date)
sp_base = stocks["S&P 500"][0]
nq_base = stocks["NASDAQ"][0]
stock_indexed_data = []
for row in stocks.iter_rows(named=True):
    stock_indexed_data.append({
        "date": row["date"].isoformat(),
        "S&P 500": round(row["S&P 500"] / sp_base * 100, 2),
        "NASDAQ": round(row["NASDAQ"] / nq_base * 100, 2),
    })

# --- 2. Query monthly tech employment (USINFO) for overlay ---

emp_rows = con.execute(
    "SELECT date, value FROM observations WHERE series_id = 'USINFO' ORDER BY date"
).fetchall()
emp_df = pl.DataFrame({"date": [r[0] for r in emp_rows], "Tech Employment": [r[1] for r in emp_rows]})
emp_df = emp_df.with_columns(pl.col("date").cast(pl.Date))

# Join S&P 500 monthly with employment on date
sp_for_overlay = stock_frames["S&P 500"].rename({"value": "S&P 500"})
overlay = sp_for_overlay.join(emp_df, on="date", how="inner").sort("date")

# Index both to 100 at first shared date
if len(overlay) > 0:
    sp_overlay_base = overlay["S&P 500"][0]
    emp_overlay_base = overlay["Tech Employment"][0]
    overlay_data = []
    for row in overlay.iter_rows(named=True):
        overlay_data.append({
            "date": row["date"].isoformat(),
            "S&P 500": round(row["S&P 500"] / sp_overlay_base * 100, 2),
            "Tech Employment": round(row["Tech Employment"] / emp_overlay_base * 100, 2),
        })
else:
    overlay_data = []

# --- 3. Build output ---

output = {
    "stock_indices": {
        "title": "Stock Market Indices (Monthly)",
        "subtitle": "Month-end closing price",
        "labels": ["S&P 500", "NASDAQ"],
        "data": stock_indices_data,
    },
    "stock_indexed": {
        "title": "Stock Market: Indexed Comparison",
        "subtitle": "Base 100 = start of period",
        "labels": ["S&P 500", "NASDAQ"],
        "data": stock_indexed_data,
    },
    "market_employment_overlay": {
        "title": "S&P 500 vs Tech Employment",
        "subtitle": "Both indexed to 100 — do stocks lead hiring?",
        "labels": ["S&P 500", "Tech Employment"],
        "data": overlay_data,
    },
}

import os
os.makedirs(OUT_PATH, exist_ok=True)

with open(f"{OUT_PATH}/market.json", "w") as f:
    json.dump(output, f)

con.close()

print(f"Exported to {OUT_PATH}/market.json")
print(f"Charts: {list(output.keys())}")
for key, chart in output.items():
    print(f"  {key}: {len(chart['data'])} data points")
