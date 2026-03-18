"""Fetch employment data for all major NAICS sectors from FRED."""

import duckdb
from fred_client import get_series, get_series_info

# Major NAICS supersectors — all CES "All Employees" series
SECTORS = {
    "USMINE": "Mining & Logging",
    "USCONS": "Construction",
    "MANEMP": "Manufacturing",
    "USTRADE": "Retail Trade",
    "USTPU": "Transportation & Warehousing",
    "USINFO": "Information",
    "USFIRE": "Financial Activities",
    "USPBS": "Professional & Business Services",
    "USEHS": "Education & Health Services",
    "USLAH": "Leisure & Hospitality",
    "USSERV": "Other Services",
    "USGOVT": "Government",
    "CES6054000001": "Professional & Technical Services",
    "CES6056000001": "Administrative & Support Services",
    "CES6562000001": "Health Care",
    "CES7071000001": "Arts, Entertainment & Recreation",
    "CES7072000001": "Accommodation & Food Services",
}

DB_PATH = "../data/labor.duckdb"
con = duckdb.connect(DB_PATH)

for series_id, label in SECTORS.items():
    # Skip if we already have it
    existing = con.execute(
        "SELECT COUNT(*) FROM observations WHERE series_id = ?", [series_id]
    ).fetchone()[0]
    if existing > 100:
        print(f"  SKIP {series_id} ({label}) — already have {existing} obs")
        continue

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

con.close()
print("Done.")
