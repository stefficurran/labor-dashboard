"""Fetch NVIDIA daily stock data via yfinance and store in DuckDB."""

import duckdb
import yfinance as yf

DB_PATH = "../data/labor.duckdb"

def main():
    print("Fetching NVIDIA (NVDA) daily stock data...")

    ticker = yf.Ticker("NVDA")
    hist = ticker.history(start="2016-01-01")

    if hist.empty:
        print("  -> No data returned from yfinance")
        return

    # Reset index to get Date as a column
    hist = hist.reset_index()

    con = duckdb.connect(DB_PATH)

    # Ensure tables exist
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

    # Store metadata
    con.execute("""
        INSERT OR REPLACE INTO series_meta VALUES (?, ?, ?, ?, ?, ?, ?)
    """, [
        "NVDA",
        "NVIDIA Corporation Stock Price (Close)",
        "D",  # Daily
        "$",
        "Not Applicable",
        str(hist["Date"].min().date()),
        str(hist["Date"].max().date()),
    ])

    # Store observations (daily close price)
    rows = []
    for _, row in hist.iterrows():
        date_str = str(row["Date"].date()) if hasattr(row["Date"], "date") else str(row["Date"])[:10]
        close = float(row["Close"])
        rows.append(("NVDA", date_str, close))

    if rows:
        con.executemany("INSERT OR REPLACE INTO observations VALUES (?, ?, ?)", rows)
        print(f"  -> {len(rows)} daily observations stored")
        print(f"  -> Date range: {rows[0][1]} to {rows[-1][1]}")
        print(f"  -> Latest close: ${rows[-1][2]:.2f}")

    con.close()

if __name__ == "__main__":
    main()
