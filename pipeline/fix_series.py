"""Fetch the missing series and add to DuckDB."""

import duckdb
from fred_client import get_series, get_series_info

EXTRA = {
    "USINFO": "Information Sector Employment",
    "JTU540099JOL": "Job Openings: Prof & Business Services",
    "JTU540099HIL": "Hires: Prof & Business Services",
    "JTU540099QUL": "Quits: Prof & Business Services",
}

DB_PATH = "../data/labor.duckdb"
con = duckdb.connect(DB_PATH)

for series_id, label in EXTRA.items():
    print(f"Fetching {series_id} ({label})...")
    try:
        info = get_series_info(series_id)
        obs = get_series(series_id)

        con.execute("""
            INSERT OR REPLACE INTO series_meta VALUES (?, ?, ?, ?, ?, ?, ?)
        """, [
            series_id, info["title"], info["frequency_short"],
            info["units_short"], info["seasonal_adjustment_short"],
            info["observation_start"], info["observation_end"],
        ])

        valid = [(series_id, o["date"], float(o["value"]))
                 for o in obs if o["value"] != "."]

        if valid:
            con.executemany("INSERT OR REPLACE INTO observations VALUES (?, ?, ?)", valid)
            print(f"  -> {len(valid)} observations")
    except Exception as e:
        print(f"  -> ERROR: {e}")

# Final summary
print("\nALL SERIES:")
for row in con.execute("""
    SELECT m.series_id, m.title, COUNT(o.date), MIN(o.date), MAX(o.date)
    FROM series_meta m LEFT JOIN observations o ON m.series_id = o.series_id
    GROUP BY m.series_id, m.title ORDER BY m.series_id
""").fetchall():
    print(f"  {row[0]:25s} | {row[2]:5d} obs | {row[3]} to {row[4]} | {row[1][:50]}")

con.close()
