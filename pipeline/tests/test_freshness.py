from datetime import date, timedelta
from conftest import load_json

def test_labor_data_recent():
    """FRED data should be within 3 months of today."""
    data = load_json("labor.json")
    latest = data["tech_employment"]["data"][-1]["date"]
    assert date.fromisoformat(latest) > date.today() - timedelta(days=90), f"Labor data stale: latest is {latest}"

def test_layoffs_data_recent():
    """Layoffs data should be within 60 days."""
    data = load_json("layoffs.json")
    latest = data["recent_events"][0]["date"]
    assert date.fromisoformat(latest) > date.today() - timedelta(days=60), f"Layoffs data stale: latest is {latest}"

def test_market_data_recent():
    """Market data should be within 45 days (monthly FRED series lag)."""
    data = load_json("market.json")
    latest = data["stock_indices"]["data"][-1]["date"]
    assert date.fromisoformat(latest) > date.today() - timedelta(days=45), f"Market data stale: latest is {latest}"
