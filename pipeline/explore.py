"""Explore FRED series to find the best data for our dashboard."""

from fred_client import search_series, get_series_info, get_series

# Search for tech/information sector employment and hiring data
queries = [
    "information sector employment",
    "JOLTS job openings information",
    "JOLTS hires information",
    "professional technical services employment",
    "technology sector unemployment",
]

for q in queries:
    print(f"\n{'='*60}")
    print(f"SEARCH: {q}")
    print('='*60)
    results = search_series(q, limit=5)
    for s in results:
        print(f"  {s['id']:30s} | {s['title'][:70]}")
        print(f"  {'':30s} | freq={s['frequency_short']} | {s['observation_start']} to {s['observation_end']}")

# Also check some known series
print(f"\n{'='*60}")
print("KNOWN SERIES")
print('='*60)

known = {
    "CES5000000001": "Information sector employment (CES)",
    "CES5400000001": "Professional/technical services employment (CES)",
    "PAYEMS": "Total nonfarm payroll employment",
    "UNRATE": "Unemployment rate (national)",
    "LNU04032237": "Unemployment rate - Information industry",
    "JTS510000000000000JOL": "JOLTS job openings - Information",
    "JTS510000000000000HIR": "JOLTS hires - Information",
    "JTS510000000000000QUL": "JOLTS quits - Information",
    "JTS510000000000000LDL": "JOLTS layoffs - Information",
    "JTS540000000000000JOL": "JOLTS job openings - Prof/Tech Services",
    "JTS540000000000000HIR": "JOLTS hires - Prof/Tech Services",
    "JTS000000000000000JOL": "JOLTS job openings - Total nonfarm",
    "JTS000000000000000HIR": "JOLTS hires - Total nonfarm",
}

for sid, label in known.items():
    try:
        info = get_series_info(sid)
        obs = get_series(sid)
        valid_obs = [o for o in obs if o["value"] != "."]
        print(f"  OK  {sid:40s} | {label}")
        print(f"      {info['observation_start']} to {info['observation_end']} | {len(valid_obs)} observations")
    except Exception as e:
        print(f"  ERR {sid:40s} | {label} | {e}")
