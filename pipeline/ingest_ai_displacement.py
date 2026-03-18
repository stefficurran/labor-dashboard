"""Download AI Displacement Tracker data from GitHub and store in DuckDB."""

import json
import duckdb
import httpx

DB_PATH = "../data/labor.duckdb"

REPO_API = "https://api.github.com/repos/noahaust2/ai-displacement-tracker"
REPO_CONTENTS = f"{REPO_API}/contents/"
# Direct data paths to try
DATA_URLS = [
    "https://raw.githubusercontent.com/noahaust2/ai-displacement-tracker/main/data/events.json",
    "https://raw.githubusercontent.com/noahaust2/ai-displacement-tracker/main/events.json",
    "https://raw.githubusercontent.com/noahaust2/ai-displacement-tracker/main/data.json",
]


def find_data_url() -> tuple[str | None, bytes | None]:
    """Try to find and fetch the data file from the repo."""
    client = httpx.Client(follow_redirects=True, timeout=30)

    # First check if repo exists
    try:
        resp = client.get(REPO_API)
        if resp.status_code == 404:
            print("  WARNING: Repository noahaust2/ai-displacement-tracker not found")
            return None, None
    except httpx.RequestError as e:
        print(f"  WARNING: Could not reach GitHub API: {e}")
        return None, None

    # Try to list repo contents to find data files
    try:
        resp = client.get(REPO_CONTENTS)
        if resp.status_code == 200:
            contents = resp.json()
            print(f"  Repo root files: {[f['name'] for f in contents]}")
            # Look for data directory or JSON files
            for item in contents:
                if item["type"] == "dir" and item["name"] == "data":
                    data_resp = client.get(item["url"])
                    if data_resp.status_code == 200:
                        data_contents = data_resp.json()
                        print(f"  Data dir files: {[f['name'] for f in data_contents]}")
                        for dfile in data_contents:
                            if dfile["name"].endswith(".json"):
                                raw_url = dfile.get("download_url", dfile.get("html_url"))
                                if raw_url:
                                    fetch_resp = client.get(raw_url)
                                    if fetch_resp.status_code == 200:
                                        return raw_url, fetch_resp.content
                elif item["name"].endswith(".json") and item["name"] not in ("package.json", "tsconfig.json"):
                    raw_url = item.get("download_url", item.get("html_url"))
                    if raw_url:
                        fetch_resp = client.get(raw_url)
                        if fetch_resp.status_code == 200:
                            return raw_url, fetch_resp.content
    except httpx.RequestError:
        pass

    # Fall back to trying known paths
    for url in DATA_URLS:
        try:
            resp = client.get(url)
            if resp.status_code == 200:
                return url, resp.content
        except httpx.RequestError:
            continue

    return None, None


def main():
    print("Fetching AI Displacement Tracker data...")

    url, data_bytes = find_data_url()
    if data_bytes is None:
        print("\n  Could not find AI Displacement Tracker data.")
        print("  The repository may not exist yet or may have moved.")
        print("  Skipping — table will be created empty for future use.")

        # Create the table anyway so downstream code doesn't break
        con = duckdb.connect(DB_PATH)
        con.execute("""
            CREATE TABLE IF NOT EXISTS ai_displacement (
                date DATE,
                company TEXT,
                workers_affected INTEGER,
                sector TEXT,
                country TEXT,
                description TEXT,
                PRIMARY KEY (company, date)
            )
        """)
        result = con.execute("SELECT COUNT(*) FROM ai_displacement").fetchone()
        con.close()
        print(f"  Table exists with {result[0]} rows")
        return

    print(f"  Fetched data from: {url}")

    # Parse JSON
    events = json.loads(data_bytes)

    # Handle different possible structures
    if isinstance(events, dict):
        # Might be wrapped in a key like "events" or "data"
        for key in ("events", "data", "records"):
            if key in events and isinstance(events[key], list):
                events = events[key]
                break
        else:
            # Maybe the dict values are the events
            if not isinstance(events, list):
                print(f"  WARNING: Unexpected JSON structure (dict with keys: {list(events.keys())[:10]})")
                return

    if not isinstance(events, list):
        print(f"  WARNING: Expected a list of events, got {type(events).__name__}")
        return

    print(f"  Found {len(events)} events")
    if events:
        print(f"  Sample event keys: {list(events[0].keys()) if isinstance(events[0], dict) else 'N/A'}")

    # Parse events into records
    records = []
    for event in events:
        if not isinstance(event, dict):
            continue

        # Try common field names
        date_val = event.get("date") or event.get("Date") or event.get("announcement_date")
        company = event.get("company") or event.get("Company") or event.get("organization")
        workers = event.get("workers_affected") or event.get("workers") or event.get("jobs_affected") or event.get("number_affected")
        sector = event.get("sector") or event.get("industry") or event.get("Sector")
        country = event.get("country") or event.get("Country") or event.get("location")
        description = event.get("description") or event.get("details") or event.get("summary") or event.get("notes")

        if not date_val or not company:
            continue

        # Parse date — take first 10 chars for YYYY-MM-DD
        date_str = str(date_val)[:10]

        try:
            workers_int = int(workers) if workers is not None else None
        except (ValueError, TypeError):
            workers_int = None

        records.append((date_str, str(company), workers_int, str(sector) if sector else None,
                        str(country) if country else None, str(description) if description else None))

    print(f"  Valid records: {len(records)}")

    # Store in DuckDB
    con = duckdb.connect(DB_PATH)
    con.execute("""
        CREATE TABLE IF NOT EXISTS ai_displacement (
            date DATE,
            company TEXT,
            workers_affected INTEGER,
            sector TEXT,
            country TEXT,
            description TEXT,
            PRIMARY KEY (company, date)
        )
    """)

    if records:
        con.executemany(
            "INSERT OR REPLACE INTO ai_displacement VALUES (?, ?, ?, ?, ?, ?)",
            records,
        )

    # Summary
    result = con.execute("""
        SELECT COUNT(*) as rows,
               MIN(date) as min_date,
               MAX(date) as max_date,
               SUM(workers_affected) as total_affected
        FROM ai_displacement
    """).fetchone()
    con.close()

    print(f"\n  Stored {result[0]} records")
    if result[0] > 0:
        print(f"  Date range: {result[1]} to {result[2]}")
        if result[3]:
            print(f"  Total workers affected: {result[3]:,.0f}")


if __name__ == "__main__":
    main()
