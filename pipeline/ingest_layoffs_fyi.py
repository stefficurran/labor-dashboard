"""Scrape layoffs.fyi data from their public Airtable shared view."""

import json
import re
import duckdb
import httpx

DB_PATH = "../data/labor.duckdb"
EMBED_URL = "https://airtable.com/embed/shrFrEtQb57krTYGz?backgroundColor=green&viewControls=on"
VIEW_ID = "viwg1fxrDR5kVsrIz"

# Column IDs from the Airtable schema
COL_COMPANY = "fldWyUNuYW5ObN8Fw"
COL_LAID_OFF = "flduZSpdFqkB4eeEh"
COL_DATE = "fldXPv4gHmcbxvQRi"
COL_PERCENTAGE = "fldMPQjXwImpjkDqb"
COL_INDUSTRY = "fldMvtAoxHCri39uZ"
COL_STAGE = "fldbWCltYdMzywX2v"
COL_COUNTRY = "fldnR6AcR7HjRtwrG"
COL_LOCATION = "fld1mbRJlknicV1Dk"
COL_FUNDS = "fld5Rl99rerd8qYDZ"


def _build_choice_maps(columns: list[dict]) -> dict[str, dict[str, str]]:
    """Build column_id -> {choice_id -> choice_name} maps for select fields."""
    maps = {}
    for col in columns:
        if col["type"] in ("select", "multiSelect"):
            opts = col.get("typeOptions", {})
            choices = opts.get("choices", {})
            if isinstance(choices, dict):
                maps[col["id"]] = {cid: c.get("name", cid) for cid, c in choices.items()}
    return maps


def _resolve(choice_maps: dict, col_id: str, value) -> str | None:
    """Resolve a select/multiSelect value to its display name."""
    if value is None:
        return None
    cmap = choice_maps.get(col_id, {})
    if isinstance(value, str):
        return cmap.get(value, value)
    if isinstance(value, list) and value:
        return cmap.get(value[0], str(value[0]))
    return None


def fetch_page(session: httpx.Client, init: dict, offset: str | None = None) -> dict:
    """Fetch one page of shared view data."""
    params: dict = {
        "shouldUseNestedResponseFormat": "true",
        "stringifiedObjectParams": json.dumps({"includeDataForViewId": VIEW_ID}),
        "accessPolicy": init["accessPolicy"],
    }
    if offset:
        params["offset"] = offset

    resp = session.get(
        f"https://airtable.com/v0.3/view/{VIEW_ID}/readSharedViewData",
        params=params,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "x-airtable-application-id": init["singleApplicationId"],
            "x-airtable-page-load-id": init["pageLoadId"],
            "x-requested-with": "XMLHttpRequest",
            "x-airtable-inter-service-client": "webClient",
            "x-csrf-token": init["csrfToken"],
            "x-time-zone": "America/Los_Angeles",
            "x-user-locale": "en",
        },
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()


def main():
    print("Scraping layoffs.fyi from Airtable shared view...")

    session = httpx.Client(follow_redirects=True, timeout=30)

    # Step 1: Load the embed page to get session tokens
    page = session.get(EMBED_URL, headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    })
    match = re.search(r"window\.initData\s*=\s*({.*?});", page.text, re.DOTALL)
    if not match:
        print("ERROR: Could not extract initData from Airtable page")
        return
    init = json.loads(match.group(1))
    print(f"  Session established (app: {init['singleApplicationId']})")

    # Step 2: Fetch first page to get column schema
    body = fetch_page(session, init)
    data = body.get("data", body)
    columns = data.get("columns", [])
    choice_maps = _build_choice_maps(columns)
    all_rows = data.get("rows", [])
    cursor = data.get("offset")

    print(f"  Page 1: {len(all_rows)} rows")

    # Step 3: Paginate
    page_num = 1
    while cursor:
        page_num += 1
        body = fetch_page(session, init, offset=cursor)
        data = body.get("data", body)
        page_rows = data.get("rows", [])
        all_rows.extend(page_rows)
        cursor = data.get("offset")
        print(f"  Page {page_num}: {len(page_rows)} rows (total: {len(all_rows)})")
        if not page_rows:
            break

    print(f"\n  Total rows fetched: {len(all_rows)}")

    # Step 4: Parse rows into clean records
    records = []
    for row in all_rows:
        cells = row.get("cellValuesByColumnId", {})
        company = cells.get(COL_COMPANY)
        date_raw = cells.get(COL_DATE)
        laid_off = cells.get(COL_LAID_OFF)
        percentage = cells.get(COL_PERCENTAGE)
        industry = _resolve(choice_maps, COL_INDUSTRY, cells.get(COL_INDUSTRY))
        stage = _resolve(choice_maps, COL_STAGE, cells.get(COL_STAGE))
        country = _resolve(choice_maps, COL_COUNTRY, cells.get(COL_COUNTRY))
        location = _resolve(choice_maps, COL_LOCATION, cells.get(COL_LOCATION))
        funds = cells.get(COL_FUNDS)

        if not company or not date_raw:
            continue

        # Parse date (ISO format from Airtable: "2025-03-19T00:00:00.000Z")
        date_str = date_raw[:10] if date_raw else None

        try:
            laid_off_int = int(laid_off) if laid_off is not None else None
        except (ValueError, TypeError):
            laid_off_int = None

        try:
            pct_float = float(percentage) if percentage is not None else None
        except (ValueError, TypeError):
            pct_float = None

        try:
            funds_float = float(funds) if funds is not None else None
        except (ValueError, TypeError):
            funds_float = None

        records.append((
            company, location, industry, laid_off_int, pct_float,
            date_str, stage, country, funds_float,
        ))

    print(f"  Valid records: {len(records)}")

    # Step 5: Store in DuckDB (merge with existing historical data)
    con = duckdb.connect(DB_PATH)
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

    # Upsert: fresh Airtable data overwrites any matching (company, date) from old CSV
    if records:
        con.executemany(
            "INSERT OR REPLACE INTO layoffs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            records,
        )

    # Summary
    result = con.execute("""
        SELECT COUNT(*) as rows,
               MIN(date) as min_date,
               MAX(date) as max_date,
               SUM(total_laid_off) as total_laid_off
        FROM layoffs WHERE total_laid_off IS NOT NULL
    """).fetchone()
    con.close()

    print(f"\n  Stored {result[0]} records with layoff counts")
    print(f"  Date range: {result[1]} to {result[2]}")
    print(f"  Total laid off: {result[3]:,.0f}")

    # Top industries
    con2 = duckdb.connect(DB_PATH, read_only=True)
    top = con2.execute("""
        SELECT industry, SUM(total_laid_off) as total
        FROM layoffs WHERE total_laid_off IS NOT NULL AND industry IS NOT NULL
        GROUP BY 1 ORDER BY 2 DESC LIMIT 5
    """).fetchall()
    con2.close()

    print("  Top industries:")
    for ind, total in top:
        print(f"    {ind}: {total:,.0f}")


if __name__ == "__main__":
    main()
