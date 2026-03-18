"""Export event study data for AI model releases — measures stock market reactions."""

import bisect
import json
import duckdb
import os
from datetime import date, timedelta

DB_PATH = "../data/labor.duckdb"
OUT_PATH = "../dashboard/public/data"
EVENTS_PATH = "../dashboard/public/data/events.json"

WINDOW_BEFORE = 5
WINDOW_AFTER = 10

SERIES = {
    "SP500": "S&P 500",
    "NASDAQCOM": "NASDAQ",
    "NVDA": "NVDA",
}

con = duckdb.connect(DB_PATH, read_only=True)

# Load all daily prices into memory, keyed by series_id
prices = {}
for series_id in SERIES:
    rows = con.execute(
        "SELECT date, value FROM observations WHERE series_id = ? ORDER BY date",
        [series_id],
    ).fetchall()
    # Store as list of (date, value) tuples — dates are already date objects
    prices[series_id] = rows

# Get all USINFO monthly data once
usinfo_rows = con.execute("""
    SELECT date, value FROM observations
    WHERE series_id = 'USINFO' ORDER BY date
""").fetchall()
usinfo_data = {r[0]: r[1] for r in usinfo_rows}
usinfo_dates = sorted(usinfo_data.keys())

con.close()


def nearest_usinfo(event_date, usinfo_dates, usinfo_data):
    """Find the USINFO value closest to the given date."""
    idx = bisect.bisect_left(usinfo_dates, event_date)
    if idx >= len(usinfo_dates):
        idx = len(usinfo_dates) - 1
    elif idx > 0:
        before = usinfo_dates[idx - 1]
        after = usinfo_dates[idx]
        if (event_date - before) <= (after - event_date):
            idx = idx - 1
    return usinfo_data[usinfo_dates[idx]]


def employment_at_offset(event_date, months_offset, usinfo_dates, usinfo_data):
    """Find the USINFO value ~N months after event_date."""
    target = date(
        event_date.year + (event_date.month + months_offset - 1) // 12,
        (event_date.month + months_offset - 1) % 12 + 1,
        1,
    )
    return nearest_usinfo(target, usinfo_dates, usinfo_data)


# Build date->index lookup for each series
date_index = {}
for series_id, rows in prices.items():
    date_index[series_id] = {r[0]: i for i, r in enumerate(rows)}

# Load events, filter for ai_release
with open(EVENTS_PATH) as f:
    all_events = json.load(f)

ai_events = [e for e in all_events if e.get("category") == "ai_release"]

# Use SP500 trading dates as the reference calendar (has broadest coverage post-2016)
sp500_dates = [r[0] for r in prices["SP500"]]
sp500_set = set(sp500_dates)


def find_nearest_trading_day(target_date):
    """Find the nearest trading day on or after target_date in SP500 data."""
    d = target_date
    for _ in range(10):  # look up to 10 calendar days forward
        if d in sp500_set:
            return d
        d += timedelta(days=1)
    return None


def get_window_prices(series_id, event_trading_idx, before, after):
    """Get prices for trading days around the event.

    Returns dict of {relative_day: price} where day 0 = event day.
    """
    rows = prices[series_id]
    if not rows:
        return {}

    # Find the index of the event date in this series
    dates_list = [r[0] for r in rows]
    event_date = sp500_dates[event_trading_idx]

    # Find closest date in this series
    if event_date not in date_index[series_id]:
        return {}

    idx = date_index[series_id][event_date]
    result = {}

    for rel_day in range(-before, after + 1):
        abs_idx = idx + rel_day
        if 0 <= abs_idx < len(rows):
            result[rel_day] = rows[abs_idx][1]

    return result


def compute_cumulative_returns(window_prices):
    """Compute cumulative returns from day -1 baseline.

    Returns dict of {relative_day: cumulative_return_pct}.
    Day -1 = 0.0 (baseline).
    """
    if -1 not in window_prices:
        return {}

    baseline = window_prices[-1]
    if baseline == 0:
        return {}

    result = {}
    for day, price in sorted(window_prices.items()):
        result[day] = (price - baseline) / baseline * 100

    return result


# Process each event
output_events = []

for event in ai_events:
    # Parse event date
    parts = event["date"].split("-")
    event_date = date(int(parts[0]), int(parts[1]), int(parts[2]))

    # Skip events before SP500 data starts (2016)
    if event_date.year < 2016:
        continue

    # Find nearest trading day
    trading_date = find_nearest_trading_day(event_date)
    if trading_date is None:
        continue

    # Get the index in SP500 trading calendar
    if trading_date not in date_index["SP500"]:
        continue
    event_sp_idx = date_index["SP500"][trading_date]

    # Need enough data before and after
    if event_sp_idx < WINDOW_BEFORE or event_sp_idx >= len(sp500_dates) - WINDOW_AFTER:
        continue

    # Get window prices and cumulative returns for each series
    cars = {}
    for series_id in SERIES:
        wp = get_window_prices(series_id, event_sp_idx, WINDOW_BEFORE, WINDOW_AFTER)
        cars[series_id] = compute_cumulative_returns(wp)

    # Build window data array
    window_data = []
    for day in range(-WINDOW_BEFORE, WINDOW_AFTER + 1):
        row = {"day": day}
        for series_id, label in SERIES.items():
            if day in cars[series_id]:
                row[label] = round(cars[series_id][day], 2)
            else:
                row[label] = None
        window_data.append(row)

    # Build summary
    def get_car(series_id, day):
        if day in cars[series_id]:
            return round(cars[series_id][day], 2)
        return None

    sp_car_1d = get_car("SP500", 1)
    sp_car_3d = get_car("SP500", 3)
    sp_car_10d = get_car("SP500", 10)
    nq_car_1d = get_car("NASDAQCOM", 1)
    nq_car_3d = get_car("NASDAQCOM", 3)
    nq_car_10d = get_car("NASDAQCOM", 10)
    nvda_car_1d = get_car("NVDA", 1)
    nvda_car_3d = get_car("NVDA", 3)
    nvda_car_10d = get_car("NVDA", 10)

    tech_premium_10d = None
    if nq_car_10d is not None and sp_car_10d is not None:
        tech_premium_10d = round(nq_car_10d - sp_car_10d, 2)

    summary = {
        "sp500_car_1d": sp_car_1d,
        "sp500_car_3d": sp_car_3d,
        "sp500_car_10d": sp_car_10d,
        "nasdaq_car_1d": nq_car_1d,
        "nasdaq_car_3d": nq_car_3d,
        "nasdaq_car_10d": nq_car_10d,
        "nvda_car_1d": nvda_car_1d,
        "nvda_car_3d": nvda_car_3d,
        "nvda_car_10d": nvda_car_10d,
        "tech_premium_10d": tech_premium_10d,
    }

    # Employment context from USINFO
    if usinfo_dates:
        emp_at = nearest_usinfo(event_date, usinfo_dates, usinfo_data)
        emp_6m = employment_at_offset(event_date, 6, usinfo_dates, usinfo_data)
        summary["info_employment_at_event"] = emp_at
        summary["info_employment_6m_later"] = emp_6m
        summary["info_employment_delta_pct"] = (
            round((emp_6m - emp_at) / emp_at * 100, 2) if emp_at else None
        )

    output_events.append({
        "id": event["id"],
        "title": event["title"],
        "date": event["date"],
        "window": {
            "labels": list(SERIES.values()),
            "data": window_data,
        },
        "summary": summary,
    })

# Write output
output = {"events": output_events}

os.makedirs(OUT_PATH, exist_ok=True)
with open(f"{OUT_PATH}/event_study.json", "w") as f:
    json.dump(output, f, indent=2)

print(f"Exported {len(output_events)} event studies to {OUT_PATH}/event_study.json")
for ev in output_events:
    s = ev["summary"]
    emp_delta = s.get('info_employment_delta_pct', 'N/A')
    print(f"  {ev['id']}: SP500 10d={s['sp500_car_10d']}%, NASDAQ 10d={s['nasdaq_car_10d']}%, NVDA 10d={s['nvda_car_10d']}%, tech_premium={s['tech_premium_10d']}%, info_emp_delta_6m={emp_delta}%")
