"""Fetch all labor data from FRED and store in DuckDB."""

import duckdb
import polars as pl
from fred_client import get_series, get_series_info

# --- Series we want ---
SERIES = {
    # Tech sector employment (monthly, seasonally adjusted)
    "USINFO": "Information Sector Employment",
    "CES6054000001": "Professional & Technical Services Employment",
    "PAYEMS": "Total Nonfarm Employment",

    # JOLTS - Information sector (NAICS 51)
    "JTU5100JOL": "Job Openings: Information",
    "JTU5100HIL": "Hires: Information",
    "JTU5100QUL": "Quits: Information",
    "JTU5100LDL": "Layoffs: Information",

    # JOLTS - Prof/Tech Services (NAICS 54)
    "JTU540099JOL": "Job Openings: Prof/Tech Services",
    "JTU540099HIL": "Hires: Prof/Tech Services",

    # JOLTS - Total nonfarm (for comparison)
    "JTSJOL": "Job Openings: Total Nonfarm",
    "JTSHIL": "Hires: Total Nonfarm",
    "JTSQUL": "Quits: Total Nonfarm",

    # Unemployment
    "LNU04032237": "Unemployment Rate: Information Industry",
    "UNRATE": "Unemployment Rate: National",

    # Stock market indices (daily frequency)
    "SP500": "S&P 500",
    "NASDAQCOM": "NASDAQ Composite",

    # Indeed job posting indices (daily, indexed to Feb 2020 baseline)
    "IHLIDXUSTPSOFTDEVE": "Indeed: Software Development Postings",
    "IHLIDXUSTPMATH": "Indeed: Mathematics Postings",
    "IHLIDXUS": "Indeed: All Job Postings",

    # Computer/math employment (annual)
    "LEU0254476900A": "Employment: Computer & Mathematical Occupations",

    # AI investment proxies
    "A679RC1Q027SBEA": "Private Investment: IT Equipment & Software",
    "Y006RC1Q027SBEA": "Private Investment: R&D",
    "IPG3344S": "Industrial Production: Semiconductors",
}

DB_PATH = "../data/labor.duckdb"


def fetch_and_store():
    con = duckdb.connect(DB_PATH)

    # Create tables
    con.execute("""
        CREATE TABLE IF NOT EXISTS series_meta (
            series_id VARCHAR PRIMARY KEY,
            title VARCHAR,
            frequency VARCHAR,
            units VARCHAR,
            seasonal_adjustment VARCHAR,
            observation_start DATE,
            observation_end DATE
        )
    """)

    con.execute("""
        CREATE TABLE IF NOT EXISTS observations (
            series_id VARCHAR,
            date DATE,
            value DOUBLE,
            PRIMARY KEY (series_id, date)
        )
    """)

    for series_id, label in SERIES.items():
        print(f"Fetching {series_id} ({label})...")
        try:
            info = get_series_info(series_id)
            obs = get_series(series_id)

            # Store metadata
            con.execute("""
                INSERT OR REPLACE INTO series_meta VALUES (?, ?, ?, ?, ?, ?, ?)
            """, [
                series_id,
                info["title"],
                info["frequency_short"],
                info["units_short"],
                info["seasonal_adjustment_short"],
                info["observation_start"],
                info["observation_end"],
            ])

            # Store observations (skip missing values marked as ".")
            valid = [(series_id, o["date"], float(o["value"]))
                     for o in obs if o["value"] != "."]

            if valid:
                con.executemany("""
                    INSERT OR REPLACE INTO observations VALUES (?, ?, ?)
                """, valid)
                print(f"  -> {len(valid)} observations stored")
            else:
                print(f"  -> No valid observations")

        except Exception as e:
            print(f"  -> ERROR: {e}")

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    result = con.execute("""
        SELECT m.series_id, m.title, COUNT(o.date) as obs_count,
               MIN(o.date) as first_date, MAX(o.date) as last_date
        FROM series_meta m
        LEFT JOIN observations o ON m.series_id = o.series_id
        GROUP BY m.series_id, m.title
        ORDER BY m.series_id
    """).fetchall()

    for row in result:
        print(f"  {row[0]:40s} | {row[2]:5d} obs | {row[3]} to {row[4]}")

    con.close()
    print(f"\nData stored in {DB_PATH}")


if __name__ == "__main__":
    fetch_and_store()
