"""Generate AI-powered insight actions using OpenAI."""

import json
import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

DATA_PATH = "../dashboard/public/data"
OUT_PATH = f"{DATA_PATH}/ai_actions.json"


def load_data_summary():
    """Load all JSON data and extract key metrics for the prompt."""
    summary = {}

    # Labor data
    labor = json.load(open(f"{DATA_PATH}/labor.json"))
    emp_data = labor["tech_employment"]["data"]
    latest_emp = emp_data[-1]
    prev_year_emp = emp_data[-13] if len(emp_data) >= 13 else None

    unemp_data = labor["unemployment"]["data"]
    latest_unemp = unemp_data[-1]

    jolts = labor["jolts_info"]["data"]
    latest_jolts = jolts[-1]
    prev_jolts = jolts[-2] if len(jolts) >= 2 else None

    # Analytics
    analytics = json.load(open(f"{DATA_PATH}/analytics.json"))
    yoy = analytics["info_employment_yoy"]["data"][-1]
    ratio = analytics["info_openings_hires_ratio"]["data"][-1]
    quits = analytics["info_quits_rate"]["data"][-1]

    # Sectors
    sectors = json.load(open(f"{DATA_PATH}/sectors.json"))
    rankings = sorted(sectors["rankings"], key=lambda x: x.get("yoy_pct") or -999, reverse=True)

    # Market
    try:
        market = json.load(open(f"{DATA_PATH}/market.json"))
        mkt_data = market["stock_indices"]["data"]
        latest_mkt = mkt_data[-1] if mkt_data else None
        prev_mkt = mkt_data[-2] if len(mkt_data) >= 2 else None
    except:
        latest_mkt = prev_mkt = None

    # Layoffs
    try:
        layoffs = json.load(open(f"{DATA_PATH}/layoffs.json"))
        layoffs_monthly = layoffs["monthly"]["data"]
        latest_layoffs = layoffs_monthly[-1] if layoffs_monthly else None
        top_companies = layoffs.get("top_companies", [])[:10]
        top_industries = layoffs.get("by_industry", [])[:5]
    except:
        latest_layoffs = top_companies = top_industries = None

    # AI data
    try:
        ai = json.load(open(f"{DATA_PATH}/ai.json"))
        ai_share = ai["ai_job_share"]["data"][-1] if ai.get("ai_job_share", {}).get("data") else None
        sector_adoption = ai.get("sector_ai_adoption", [])[:5]
        semi = ai["semiconductor_production"]["data"][-1] if ai.get("semiconductor_production", {}).get("data") else None
    except:
        ai_share = sector_adoption = semi = None

    # Event study
    try:
        events = json.load(open(f"{DATA_PATH}/event_study.json"))
        recent_events = events["events"][:3] if events.get("events") else []
    except:
        recent_events = []

    # Build summary dict
    summary = {
        "data_date": latest_emp.get("date", "unknown"),
        "employment": {
            "info_sector": latest_emp.get("Information"),
            "yoy_pct": yoy.get("yoy_pct"),
            "yoy_change_thousands": yoy.get("yoy_change"),
        },
        "unemployment": {
            "info_rate": latest_unemp.get("Information Industry"),
            "national_rate": latest_unemp.get("National"),
        },
        "jolts": {
            "openings": latest_jolts.get("Job Openings"),
            "hires": latest_jolts.get("Hires"),
            "quits": latest_jolts.get("Quits"),
            "layoffs": latest_jolts.get("Layoffs"),
            "openings_hires_ratio": ratio.get("ratio"),
            "quits_rate_pct": quits.get("quits_pct"),
        },
        "sector_rankings": {
            "top_3": [{"sector": r["sector"], "yoy_pct": r["yoy_pct"]} for r in rankings[:3]],
            "bottom_3": [{"sector": r["sector"], "yoy_pct": r["yoy_pct"]} for r in rankings[-3:]],
            "info_rank": next((i+1 for i, r in enumerate(rankings) if r["sector"] == "Information"), None),
            "total_sectors": len(rankings),
        },
    }

    if latest_mkt and prev_mkt:
        sp_latest = latest_mkt.get("S&P 500")
        sp_prev = prev_mkt.get("S&P 500")
        summary["market"] = {
            "sp500": sp_latest,
            "sp500_mom_pct": round((sp_latest - sp_prev) / sp_prev * 100, 1) if sp_latest and sp_prev else None,
            "nasdaq": latest_mkt.get("NASDAQ"),
        }

    if latest_layoffs:
        summary["layoffs"] = {
            "latest_month_total": latest_layoffs.get("total"),
            "latest_month_date": latest_layoffs.get("date"),
            "top_companies": [{"company": c["company"], "total": c["total"]} for c in (top_companies or [])[:5]],
            "top_industries": [{"industry": i["industry"], "total": i["total"]} for i in (top_industries or [])[:5]],
        }

    if ai_share:
        summary["ai"] = {
            "job_share_pct": ai_share.get("AI Share"),
            "top_adoption_sectors": [{"sector": s["sector"], "pct": s["adoption_pct"]} for s in (sector_adoption or [])],
        }
        if semi:
            summary["ai"]["semiconductor_index"] = semi.get("index")

    if recent_events:
        summary["recent_ai_events"] = [
            {"title": e["title"], "date": e["date"],
             "nvda_car_10d": e["summary"].get("nvda_car_10d"),
             "tech_premium_10d": e["summary"].get("tech_premium_10d")}
            for e in recent_events
        ]

    # Add JOLTS MoM changes if we have previous month
    if prev_jolts:
        prev_layoffs_jolts = prev_jolts.get("Layoffs")
        curr_layoffs_jolts = latest_jolts.get("Layoffs")
        if prev_layoffs_jolts and curr_layoffs_jolts and prev_layoffs_jolts > 0:
            summary["jolts"]["layoffs_mom_pct"] = round((curr_layoffs_jolts - prev_layoffs_jolts) / prev_layoffs_jolts * 100, 1)

    return summary


SYSTEM_PROMPT = """You are a senior labor economist writing a weekly intelligence briefing for a tech professional who wants to understand how the labor market affects their career.

You will receive a JSON summary of the latest U.S. labor market data focused on the tech/Information sector (NAICS 51). Your job is to generate 10 actionable insights that synthesize across multiple data points.

Rules:
- Each insight should connect at least 2 data points (e.g., "employment is down AND quits are low, which means...")
- Be specific — use exact numbers from the data
- Write in plain English, no jargon
- Be honest about uncertainty — if the signal is weak, say so
- Mix categories: career advice, market analysis, sector watchlists, and forward-looking predictions
- The tone should be confident but not alarmist — like a smart friend who happens to be an economist
- Each insight should be 2-3 sentences max

Return valid JSON with this exact structure:
{
  "generated_at": "ISO date string",
  "actions": [
    {
      "id": "unique-slug",
      "category": "career" | "market" | "watchlist" | "prediction",
      "title": "Short punchy title (5-8 words)",
      "body": "2-3 sentence insight with specific numbers",
      "confidence": "high" | "medium" | "low",
      "data_points": ["employment_yoy", "quits_rate"]
    }
  ]
}

Return ONLY the JSON, no markdown fences or explanation."""


def generate():
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        print("OPENAI_API_KEY not set in .env — skipping AI action generation.")
        print("Add your OpenAI API key to .env to enable this feature.")
        return

    print("Loading data summary...")
    summary = load_data_summary()
    print(f"  Data date: {summary.get('data_date')}")
    print(f"  Keys: {list(summary.keys())}")

    print("Calling OpenAI (gpt-4o)...")
    client = OpenAI(api_key=api_key)

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Here is this week's data:\n\n{json.dumps(summary, indent=2)}"},
        ],
        temperature=0.7,
        max_tokens=3000,
    )

    raw = response.choices[0].message.content.strip()

    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]
        if raw.endswith("```"):
            raw = raw[:-3]

    try:
        result = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"  ERROR: Failed to parse OpenAI response as JSON: {e}")
        print(f"  Raw response: {raw[:500]}")
        return

    actions = result.get("actions", [])
    print(f"  Generated {len(actions)} actions")

    # Override generated_at with actual current time (LLM often uses data date)
    from datetime import datetime, timezone
    result["generated_at"] = datetime.now(timezone.utc).isoformat()

    # Save
    with open(OUT_PATH, "w") as f:
        json.dump(result, f, indent=2)

    print(f"  Written to {OUT_PATH}")

    # Preview
    for a in actions[:3]:
        print(f"\n  [{a['category']}] {a['title']}")
        print(f"  {a['body'][:120]}...")


if __name__ == "__main__":
    generate()
