"""Export sector growth data for the Growth tab."""

import json
import os
import duckdb

DB_PATH = "../data/labor.duckdb"
OUT_PATH = "../dashboard/public/data"
os.makedirs(OUT_PATH, exist_ok=True)

con = duckdb.connect(DB_PATH, read_only=True)

# All sector series we have (map series_id -> short label)
SECTORS = {
    "USMINE": "Mining & Logging",
    "USCONS": "Construction",
    "MANEMP": "Manufacturing",
    "USTRADE": "Retail Trade",
    "USTPU": "Transportation & Warehousing",
    "USINFO": "Information",
    "USFIRE": "Financial Activities",
    "USPBS": "Prof & Business Services",
    "USEHS": "Education & Health",
    "USLAH": "Leisure & Hospitality",
    "USSERV": "Other Services",
    "USGOVT": "Government",
    "CES6054000001": "Professional & Technical",
    "CES6056000001": "Admin & Support",
    "CES6562000001": "Health Care",
    "CES7071000001": "Arts & Entertainment",
    "CES7072000001": "Accommodation & Food",
}

# 1. Sector growth rankings — compute YoY and multi-year growth for each sector
growth_data = []
for sid, label in SECTORS.items():
    rows = con.execute("""
        SELECT date, value FROM observations
        WHERE series_id = ? ORDER BY date
    """, [sid]).fetchall()

    if len(rows) < 13:
        continue

    latest = rows[-1]
    one_year_ago = rows[-13] if len(rows) >= 13 else None
    three_years_ago = rows[-37] if len(rows) >= 37 else None
    five_years_ago = rows[-61] if len(rows) >= 61 else None

    entry = {
        "series_id": sid,
        "sector": label,
        "latest_date": latest[0].isoformat(),
        "latest_value": latest[1],
        "yoy_pct": round((latest[1] - one_year_ago[1]) / one_year_ago[1] * 100, 2) if one_year_ago else None,
        "yoy_change": round(latest[1] - one_year_ago[1], 1) if one_year_ago else None,
        "three_year_pct": round((latest[1] - three_years_ago[1]) / three_years_ago[1] * 100, 2) if three_years_ago else None,
        "five_year_pct": round((latest[1] - five_years_ago[1]) / five_years_ago[1] * 100, 2) if five_years_ago else None,
    }
    growth_data.append(entry)

# Sort by YoY growth descending
growth_data.sort(key=lambda x: x["yoy_pct"] or 0, reverse=True)

# 2. Time series for all sectors (indexed to 100 at various start points)
# We'll export raw employment so the frontend can index dynamically
sector_timeseries = {}
for sid, label in SECTORS.items():
    rows = con.execute("""
        SELECT date, value FROM observations
        WHERE series_id = ? AND date >= '2000-01-01'
        ORDER BY date
    """, [sid]).fetchall()
    sector_timeseries[label] = [
        {"date": r[0].isoformat(), "value": r[1]} for r in rows
    ]

# 3. Build a combined dataset where all sectors are on same dates (for the stacked/comparison chart)
# Get all dates
all_dates = [r[0].isoformat() for r in con.execute("""
    SELECT DISTINCT date FROM observations
    WHERE series_id = 'USINFO' AND date >= '2000-01-01'
    ORDER BY date
""").fetchall()]

combined = []
for date in all_dates:
    point = {"date": date}
    for sid, label in SECTORS.items():
        result = con.execute(
            "SELECT value FROM observations WHERE series_id = ? AND date = ?",
            [sid, date]
        ).fetchone()
        point[label] = result[0] if result else None
    combined.append(point)

# 4. Compute rolling 12-month growth rate for each sector over time
growth_over_time = []
for i, date in enumerate(all_dates):
    if i < 12:
        continue
    point = {"date": date}
    for sid, label in SECTORS.items():
        current = None
        previous = None
        for p in combined:
            if p["date"] == date:
                current = p.get(label)
            if p["date"] == all_dates[i - 12]:
                previous = p.get(label)
        if current and previous and previous > 0:
            point[label] = round((current - previous) / previous * 100, 2)
    growth_over_time.append(point)

output = {
    "rankings": growth_data,
    "sector_labels": list(SECTORS.values()),
    "timeseries": sector_timeseries,
    "combined": combined,
    "growth_over_time": growth_over_time,
}

with open(f"{OUT_PATH}/sectors.json", "w") as f:
    json.dump(output, f)

con.close()
print(f"Exported {len(SECTORS)} sectors to {OUT_PATH}/sectors.json")
print(f"Top 5 growing (YoY): {[s['sector'] + ' ' + str(s['yoy_pct']) + '%' for s in growth_data[:5]]}")
print(f"Bottom 5 (YoY): {[s['sector'] + ' ' + str(s['yoy_pct']) + '%' for s in growth_data[-5:]]}")
