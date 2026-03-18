"""Download Indeed AI job posting tracker CSV and store in DuckDB."""

import duckdb
import httpx
import polars as pl

DB_PATH = "../data/labor.duckdb"

AI_POSTING_URL = "https://raw.githubusercontent.com/hiring-lab/ai-tracker/main/AI_posting.csv"
GENAI_POSTING_URL = "https://raw.githubusercontent.com/hiring-lab/ai-tracker/main/GenAI_posting.csv"


def fetch_csv(url: str) -> bytes | None:
    """Download a CSV, returning bytes or None on failure."""
    try:
        resp = httpx.get(url, follow_redirects=True, timeout=30)
        resp.raise_for_status()
        return resp.content
    except httpx.HTTPStatusError as e:
        print(f"  WARNING: {url} returned {e.response.status_code} — skipping")
        return None
    except httpx.RequestError as e:
        print(f"  WARNING: Could not fetch {url}: {e} — skipping")
        return None


def main():
    print("Fetching Indeed AI job posting tracker data...")

    # --- Download AI postings ---
    ai_bytes = fetch_csv(AI_POSTING_URL)
    if ai_bytes is None:
        print("  ERROR: Could not download AI_posting.csv — aborting")
        return

    ai_df = pl.read_csv(ai_bytes)
    print(f"  AI postings: {ai_df.shape[0]} rows, columns: {ai_df.columns}")

    # Filter to US only
    country_col = [c for c in ai_df.columns if "country" in c.lower()]
    if country_col:
        col = country_col[0]
        ai_df = ai_df.filter(pl.col(col) == "US")
        print(f"  Filtered to US: {ai_df.shape[0]} rows")
    else:
        print("  WARNING: No country column found — using all rows")

    # Identify the share column (anything with 'share' or 'AI' that isn't date/country)
    share_cols = [c for c in ai_df.columns if c not in ["date", country_col[0] if country_col else ""] and "share" in c.lower()]
    if not share_cols:
        share_cols = [c for c in ai_df.columns if c not in ["date", country_col[0] if country_col else ""]]
    ai_share_col = share_cols[0] if share_cols else ai_df.columns[-1]
    print(f"  Using AI share column: {ai_share_col}")

    ai_df = ai_df.select([
        pl.col("date").alias("date"),
        pl.col(ai_share_col).cast(pl.Float64).alias("ai_share"),
    ])

    # --- Download GenAI postings (may not exist) ---
    genai_bytes = fetch_csv(GENAI_POSTING_URL)
    if genai_bytes is not None:
        genai_df = pl.read_csv(genai_bytes)
        print(f"  GenAI postings: {genai_df.shape[0]} rows, columns: {genai_df.columns}")

        # Filter to US
        gcountry_col = [c for c in genai_df.columns if "country" in c.lower()]
        if gcountry_col:
            genai_df = genai_df.filter(pl.col(gcountry_col[0]) == "US")

        gshare_cols = [c for c in genai_df.columns if c not in ["date", gcountry_col[0] if gcountry_col else ""] and "share" in c.lower()]
        genai_share_col = gshare_cols[0] if gshare_cols else genai_df.columns[-1]

        genai_df = genai_df.select([
            pl.col("date").alias("date"),
            pl.col(genai_share_col).cast(pl.Float64).alias("genai_share"),
        ])

        # Join on date
        combined = ai_df.join(genai_df, on="date", how="left")
    else:
        print("  GenAI CSV not available — storing AI share only")
        combined = ai_df.with_columns(pl.lit(None).cast(pl.Float64).alias("genai_share"))

    # Parse dates
    combined = combined.with_columns(
        pl.col("date").str.to_date("%Y-%m-%d").alias("date")
    ).sort("date")

    print(f"  Combined dataset: {combined.shape[0]} rows")

    # --- Store in DuckDB ---
    con = duckdb.connect(DB_PATH)
    con.execute("""
        CREATE TABLE IF NOT EXISTS indeed_ai (
            date DATE,
            ai_share REAL,
            genai_share REAL,
            PRIMARY KEY (date)
        )
    """)

    # Prepare records
    records = []
    for row in combined.iter_rows():
        records.append((str(row[0]), row[1], row[2]))

    if records:
        con.executemany(
            "INSERT OR REPLACE INTO indeed_ai VALUES (?, ?, ?)",
            records,
        )

    # Summary
    result = con.execute("""
        SELECT COUNT(*) as rows,
               MIN(date) as min_date,
               MAX(date) as max_date,
               ROUND(MAX(CASE WHEN date = (SELECT MAX(date) FROM indeed_ai) THEN ai_share END), 2) as latest_ai,
               ROUND(MAX(CASE WHEN date = (SELECT MAX(date) FROM indeed_ai) THEN genai_share END), 2) as latest_genai
        FROM indeed_ai
    """).fetchone()
    con.close()

    print(f"\n  Stored {result[0]} records")
    print(f"  Date range: {result[1]} to {result[2]}")
    print(f"  Latest AI share: {result[3]:.2f}%")
    if result[4] is not None:
        print(f"  Latest GenAI share: {result[4]}%")


if __name__ == "__main__":
    main()
