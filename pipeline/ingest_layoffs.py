"""Ingest layoffs CSV data into DuckDB."""

import duckdb
import polars as pl

DB_PATH = "../data/labor.duckdb"
CSV_PATH = "../data/layoffs_raw.csv"

con = duckdb.connect(DB_PATH)

# Create table
con.execute("""
    CREATE TABLE IF NOT EXISTS layoffs (
        company TEXT,
        location TEXT,
        industry TEXT,
        total_laid_off INTEGER,
        percentage_laid_off REAL,
        date DATE,
        stage TEXT,
        country TEXT,
        funds_raised_millions REAL,
        PRIMARY KEY (company, date)
    )
""")

# Read CSV
df = pl.read_csv(CSV_PATH)

# Rename columns
df = df.rename({
    "Company": "company",
    "Location_HQ": "location",
    "Industry": "industry",
    "Laid_Off_Count": "total_laid_off",
    "Percentage": "percentage_laid_off",
    "Date": "date",
    "Stage": "stage",
    "Country": "country",
    "Funds_Raised": "funds_raised_millions",
})

# Keep only needed columns
df = df.select([
    "company", "location", "industry", "total_laid_off",
    "percentage_laid_off", "date", "stage", "country", "funds_raised_millions",
])

# Clean: drop rows where total_laid_off is null, empty, or "Unknown"
df = df.filter(
    pl.col("total_laid_off").is_not_null()
    & (pl.col("total_laid_off").cast(pl.Utf8) != "")
    & (pl.col("total_laid_off").cast(pl.Utf8) != "Unknown")
)

# Cast total_laid_off to integer (may have been read as string)
df = df.with_columns(pl.col("total_laid_off").cast(pl.Int64))

# Parse date
df = df.with_columns(pl.col("date").str.to_date("%Y-%m-%d"))

# Strip whitespace from text columns
text_cols = ["company", "location", "industry", "stage", "country"]
df = df.with_columns([pl.col(c).str.strip_chars() for c in text_cols])

# Deduplicate on (company, date), keeping first occurrence
df = df.unique(subset=["company", "date"], keep="first")

# Insert into DuckDB — convert to rows to avoid pyarrow dependency
con.execute("DELETE FROM layoffs")
rows = df.rows()
con.executemany(
    "INSERT OR REPLACE INTO layoffs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    rows,
)

# Summary
total = con.execute("SELECT COUNT(*) FROM layoffs").fetchone()[0]
date_range = con.execute(
    "SELECT MIN(date), MAX(date) FROM layoffs"
).fetchone()
top_industries = con.execute("""
    SELECT industry, SUM(total_laid_off) as total
    FROM layoffs
    GROUP BY industry
    ORDER BY total DESC
    LIMIT 5
""").fetchall()

print(f"Ingested {total} rows")
print(f"Date range: {date_range[0]} to {date_range[1]}")
print("Top 5 industries by layoffs:")
for industry, total in top_industries:
    print(f"  {industry}: {total:,}")

con.close()
