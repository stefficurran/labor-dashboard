"""Ingest Census BTOS (Business Trends and Outlook Survey) AI adoption data into DuckDB.

The BTOS survey added AI adoption questions in November 2025. It provides
AI adoption rates by NAICS sector, surveyed biweekly.

Data source: https://www.census.gov/hfp/btos/data_downloads
The Census BTOS portal is a JavaScript SPA with no direct CSV download link.
This script attempts to fetch data from the Census API; if that fails, it
reads from a local CSV at ../data/btos_ai.csv which contains curated data
points from published Census reports and press releases.
"""

import sys
from pathlib import Path

import duckdb
import httpx
import polars as pl

DB_PATH = "../data/labor.duckdb"
LOCAL_CSV = "../data/btos_ai.csv"

# Known Census BTOS download URLs to try (the SPA may expose these)
CENSUS_URLS = [
    "https://www.census.gov/hfp/btos/downloads/btos_ai_use.csv",
    "https://www.census.gov/hfp/btos/downloads/btos_ai_adoption.csv",
    "https://www.census.gov/hfp/btos/downloads/ai_use_by_sector.csv",
]


def try_census_download() -> pl.DataFrame | None:
    """Attempt to download AI adoption data directly from Census."""
    client = httpx.Client(follow_redirects=True, timeout=30)

    for url in CENSUS_URLS:
        try:
            resp = client.get(url)
            if resp.status_code == 200 and len(resp.content) > 100:
                # Skip HTML responses (the SPA returns HTML for all paths)
                content_type = resp.headers.get("content-type", "")
                if "html" in content_type or resp.content[:20].strip().startswith(b"<"):
                    continue
                print(f"  Downloaded from: {url}")
                try:
                    df = pl.read_csv(resp.content)
                    if len(df) > 0:
                        return df
                except Exception:
                    continue
        except httpx.RequestError:
            continue

    return None


def load_local_csv() -> pl.DataFrame:
    """Load AI adoption data from local CSV."""
    csv_path = Path(LOCAL_CSV)
    if not csv_path.exists():
        print(f"  ERROR: Local CSV not found at {csv_path.resolve()}")
        print("  Please download BTOS AI data from:")
        print("    https://www.census.gov/hfp/btos/data_downloads")
        print(f"  and save it as {csv_path.resolve()}")
        sys.exit(1)

    df = pl.read_csv(str(csv_path))
    print(f"  Loaded {len(df)} rows from local CSV")
    return df


def normalize(df: pl.DataFrame) -> pl.DataFrame:
    """Normalize column names and types to match our schema."""
    # Map common Census column name variants to our schema
    rename_map = {}
    for col in df.columns:
        lower = col.lower().strip()
        if lower in ("survey_date", "date", "period", "survey_period", "ref_date"):
            rename_map[col] = "survey_date"
        elif lower in ("naics_code", "naics", "sector_code", "industry_code"):
            rename_map[col] = "naics_code"
        elif lower in ("naics_label", "naics_title", "sector", "sector_label", "industry", "industry_label"):
            rename_map[col] = "naics_label"
        elif lower in ("ai_adoption_pct", "ai_use_pct", "ai_pct", "pct_using_ai", "ai_adoption_rate"):
            rename_map[col] = "ai_adoption_pct"

    if rename_map:
        df = df.rename(rename_map)

    # Ensure required columns exist
    required = {"survey_date", "naics_code", "naics_label", "ai_adoption_pct"}
    missing = required - set(df.columns)
    if missing:
        print(f"  ERROR: Missing columns: {missing}")
        print(f"  Available columns: {df.columns}")
        sys.exit(1)

    # Cast types
    df = df.with_columns(
        pl.col("survey_date").cast(pl.Date),
        pl.col("naics_code").cast(pl.Utf8),
        pl.col("naics_label").cast(pl.Utf8),
        pl.col("ai_adoption_pct").cast(pl.Float64),
    ).select("survey_date", "naics_code", "naics_label", "ai_adoption_pct")

    return df


def store(df: pl.DataFrame):
    """Create table and insert records into DuckDB."""
    con = duckdb.connect(DB_PATH)

    con.execute("""
        CREATE TABLE IF NOT EXISTS btos_ai_adoption (
            survey_date DATE,
            naics_code TEXT,
            naics_label TEXT,
            ai_adoption_pct REAL,
            PRIMARY KEY (survey_date, naics_code)
        )
    """)

    # Convert to list of tuples for insertion
    records = df.rows()
    if records:
        con.executemany(
            "INSERT OR REPLACE INTO btos_ai_adoption VALUES (?, ?, ?, ?)",
            records,
        )

    # Print summary
    print("\n" + "=" * 60)
    print("BTOS AI ADOPTION — SUMMARY")
    print("=" * 60)

    count = con.execute("SELECT COUNT(*) FROM btos_ai_adoption").fetchone()[0]
    print(f"  Total records: {count}")

    dates = con.execute(
        "SELECT DISTINCT survey_date FROM btos_ai_adoption ORDER BY survey_date"
    ).fetchall()
    print(f"  Survey periods: {', '.join(str(d[0]) for d in dates)}")

    sectors = con.execute(
        "SELECT COUNT(DISTINCT naics_code) FROM btos_ai_adoption"
    ).fetchone()[0]
    print(f"  Sectors: {sectors}")

    min_max = con.execute(
        "SELECT MIN(ai_adoption_pct), MAX(ai_adoption_pct) FROM btos_ai_adoption"
    ).fetchone()
    print(f"  Adoption range: {min_max[0]:.1f}% — {min_max[1]:.1f}%")

    # Top 5 sectors by latest adoption rate
    print("\n  Top 5 sectors (latest survey):")
    top5 = con.execute("""
        SELECT naics_code, naics_label, ai_adoption_pct
        FROM btos_ai_adoption
        WHERE survey_date = (SELECT MAX(survey_date) FROM btos_ai_adoption)
        ORDER BY ai_adoption_pct DESC
        LIMIT 5
    """).fetchall()
    for row in top5:
        print(f"    {row[0]:>5s}  {row[1]:50s}  {row[2]:5.1f}%")

    con.close()


def main():
    print("Ingesting BTOS AI adoption data...")

    # Try Census download first
    print("\n  Attempting Census download...")
    df = try_census_download()

    if df is None:
        print("  Census download not available (SPA-only portal)")
        print("  Falling back to local CSV...")
        df = load_local_csv()

    df = normalize(df)
    print(f"  Normalized: {len(df)} rows, columns: {df.columns}")

    store(df)
    print(f"\nData stored in {DB_PATH}")


if __name__ == "__main__":
    main()
