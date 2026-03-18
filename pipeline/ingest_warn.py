"""Fetch WARN Act layoff notices from the WARN Firehose API into DuckDB.

Strategy: maximize records per API request (200/day on starter tier).
1. Fetch new data since our latest record (most efficient — usually just 1-2 pages)
2. Backfill older data with remaining budget

Usage:
    uv run python ingest_warn.py             # full ingest
    uv run python ingest_warn.py --dry-run   # validate config + plan without API calls
"""

import os
import sys
import time
import duckdb
import httpx
from dotenv import load_dotenv

load_dotenv()

DB_PATH = "../data/labor.duckdb"
BASE_URL = "https://warnfirehose.com"
PAGE_LIMIT = 100  # Starter tier allows 100 per request
START_DATE = "2020-01-01"
MAX_REQUESTS = 195  # Stay under the 200/day limit with some buffer


def _parse_records(records: list[dict]) -> list[tuple]:
    """Parse API records into DuckDB rows."""
    rows = []
    for rec in records:
        notice_date = rec.get("notice_date") or rec.get("date")
        company = rec.get("company_name") or rec.get("company")
        state = rec.get("state")
        city = rec.get("city")
        employees = rec.get("employees_affected") or rec.get("number_of_workers")
        industry = rec.get("industry")
        layoff_type = rec.get("layoff_type")

        if notice_date and company and state:
            try:
                emp_int = int(employees) if employees else None
            except (ValueError, TypeError):
                emp_int = None
            rows.append((notice_date, company, state, city, emp_int, industry, layoff_type))
    return rows


def _fetch_page(api_key: str, params: dict) -> dict | None:
    """Fetch one page from the API. Returns None on rate limit or error."""
    try:
        resp = httpx.get(
            f"{BASE_URL}/api/records",
            params=params,
            headers={"X-API-Key": api_key},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 429:
            print(f"  Rate limit reached — stopping for today.")
        else:
            print(f"  API error: {e.response.status_code} — {e.response.text[:200]}")
        return None
    except httpx.RequestError as e:
        print(f"  Request error: {e}")
        return None


def _ingest_range(api_key: str, con, date_from: str, date_to: str | None,
                  order: str, label: str, budget: int) -> tuple[int, int]:
    """Fetch records in a date range. Returns (records_inserted, requests_used)."""
    offset = 0
    total_inserted = 0
    requests_used = 0

    while requests_used < budget:
        params: dict = {
            "date_from": date_from,
            "limit": PAGE_LIMIT,
            "offset": offset,
            "sort": "notice_date",
            "order": order,
        }
        if date_to:
            params["date_to"] = date_to

        body = _fetch_page(api_key, params)
        requests_used += 1
        if body is None:
            break

        records = body.get("records", [])
        if not records:
            break

        rows = _parse_records(records)
        if rows:
            con.executemany(
                "INSERT OR REPLACE INTO warn_notices VALUES (?, ?, ?, ?, ?, ?, ?)",
                rows,
            )
            total_inserted += len(rows)

        if requests_used % 20 == 0 or requests_used == 1:
            avail = body.get("total", "?")
            print(f"  [{label}] Request {requests_used} — +{total_inserted} records (avail: {avail})")

        if len(records) < PAGE_LIMIT:
            break
        offset += PAGE_LIMIT
        time.sleep(0.2)

    return total_inserted, requests_used


def _dry_run():
    """Validate config, DB state, and plan — no API calls."""
    print("=== DRY RUN (no API requests will be made) ===\n")

    # 1. Check API key
    api_key = os.environ.get("WARN_API_KEY", "").strip()
    if not api_key:
        print("FAIL: WARN_API_KEY not set in .env")
        print("  Get a free API key at https://warnfirehose.com and add it to .env")
        return False
    print(f"OK: WARN_API_KEY set ({api_key[:4]}...{api_key[-4:]})")

    # 2. Check DB connectivity + table
    try:
        con = duckdb.connect(DB_PATH)
        con.execute("""
            CREATE TABLE IF NOT EXISTS warn_notices (
                notice_date DATE,
                company TEXT,
                state TEXT,
                city TEXT,
                employees_affected INTEGER,
                industry TEXT,
                layoff_type TEXT,
                PRIMARY KEY (company, notice_date, state)
            )
        """)
    except Exception as e:
        print(f"FAIL: Cannot connect to DuckDB at {DB_PATH} — {e}")
        return False
    print(f"OK: DuckDB at {DB_PATH}")

    # 3. Check current coverage
    existing_count = con.execute("SELECT COUNT(*) FROM warn_notices").fetchone()[0]
    max_date = con.execute("SELECT MAX(notice_date) FROM warn_notices").fetchone()[0]
    min_date = con.execute("SELECT MIN(notice_date) FROM warn_notices").fetchone()[0]
    print(f"OK: {existing_count} existing records ({min_date} to {max_date})")

    # 4. Plan what would happen
    print(f"\nPlan (budget: {MAX_REQUESTS} requests):")
    if max_date:
        print(f"  Phase 1: Fetch new records since {max_date} (asc)")
    else:
        print(f"  Phase 1: Initial fetch from {START_DATE} (newest first, max 50 requests)")

    if max_date and str(min_date) > START_DATE:
        print(f"  Phase 2: Backfill {START_DATE} to {min_date} with remaining budget")
    elif not max_date:
        print(f"  Phase 2: Backfill with remaining budget")
    else:
        print(f"  Phase 2: No gap — full coverage from {START_DATE}")

    # 5. Connectivity check (HEAD request, doesn't count against rate limit)
    try:
        resp = httpx.head(BASE_URL, timeout=10)
        print(f"\nOK: WARN Firehose reachable (HTTP {resp.status_code})")
    except httpx.RequestError as e:
        print(f"\nWARN: Cannot reach {BASE_URL} — {e}")

    con.close()
    print("\n=== Dry run passed — safe to run without --dry-run ===")
    return True


def main():
    dry_run = "--dry-run" in sys.argv
    if dry_run:
        success = _dry_run()
        sys.exit(0 if success else 1)

    api_key = os.environ.get("WARN_API_KEY", "").strip()
    if not api_key:
        print("WARN_API_KEY not set in .env — skipping WARN data ingest.")
        print("Get a free API key at https://warnfirehose.com and add it to .env")
        return

    con = duckdb.connect(DB_PATH)
    con.execute("""
        CREATE TABLE IF NOT EXISTS warn_notices (
            notice_date DATE,
            company TEXT,
            state TEXT,
            city TEXT,
            employees_affected INTEGER,
            industry TEXT,
            layoff_type TEXT,
            PRIMARY KEY (company, notice_date, state)
        )
    """)

    existing_count = con.execute("SELECT COUNT(*) FROM warn_notices").fetchone()[0]
    max_date = con.execute("SELECT MAX(notice_date) FROM warn_notices").fetchone()[0]
    min_date = con.execute("SELECT MIN(notice_date) FROM warn_notices").fetchone()[0]
    print(f"Existing: {existing_count} records ({min_date} to {max_date})")

    budget = MAX_REQUESTS
    total_inserted = 0

    # === Phase 1: Fetch only NEW data (since our latest record) ===
    # This is the most efficient step — usually 1-2 requests for daily runs
    if max_date:
        print(f"\nPhase 1: New data since {max_date}...")
        inserted, used = _ingest_range(
            api_key, con,
            date_from=str(max_date),  # overlap by 1 day (INSERT OR REPLACE handles dupes)
            date_to=None,
            order="asc",
            label="new",
            budget=budget,
        )
        total_inserted += inserted
        budget -= used
        if inserted > 0:
            print(f"  +{inserted} new records ({used} requests)")
        else:
            print(f"  No new records ({used} requests)")
    else:
        # First run — fetch newest first to get recent coverage immediately
        print(f"\nPhase 1: Initial fetch (newest first)...")
        inserted, used = _ingest_range(
            api_key, con,
            date_from=START_DATE,
            date_to=None,
            order="desc",
            label="initial",
            budget=min(budget, 50),  # Cap initial at 50 requests, save rest for backfill
        )
        total_inserted += inserted
        budget -= used
        print(f"  +{inserted} records ({used} requests)")

    # === Phase 2: Backfill older data with remaining budget ===
    if budget > 0:
        current_min = con.execute("SELECT MIN(notice_date) FROM warn_notices").fetchone()[0]
        if current_min and str(current_min) > START_DATE:
            print(f"\nPhase 2: Backfilling before {current_min} ({budget} requests remaining)...")
            inserted, used = _ingest_range(
                api_key, con,
                date_from=START_DATE,
                date_to=str(current_min),
                order="desc",  # Newest-first within backfill range (get closer to existing data)
                label="backfill",
                budget=budget,
            )
            total_inserted += inserted
            budget -= used
            if inserted > 0:
                print(f"  +{inserted} records ({used} requests)")
            else:
                print(f"  Backfill complete! ({used} requests)")
        else:
            print(f"\nPhase 2: No gap to backfill — full coverage from {START_DATE}")

    # Summary
    final_count = con.execute("SELECT COUNT(*) FROM warn_notices").fetchone()[0]
    final_range = con.execute(
        "SELECT MIN(notice_date), MAX(notice_date) FROM warn_notices"
    ).fetchone()
    con.close()

    print(f"\nDone! +{total_inserted} this run. Total: {final_count} records.")
    if final_range[0]:
        print(f"Coverage: {final_range[0]} to {final_range[1]}")
    print(f"Requests remaining today: ~{budget}")


if __name__ == "__main__":
    main()
