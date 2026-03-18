"""FRED API client for fetching economic time series data."""

import os
import httpx
from dotenv import load_dotenv

load_dotenv()

FRED_API_KEY = os.environ["FRED_API_KEY"]
BASE_URL = "https://api.stlouisfed.org/fred"


def get_series(series_id: str, start_date: str = "2000-01-01") -> list[dict]:
    """Fetch a single FRED time series."""
    url = f"{BASE_URL}/series/observations"
    params = {
        "series_id": series_id,
        "api_key": FRED_API_KEY,
        "file_type": "json",
        "observation_start": start_date,
    }
    resp = httpx.get(url, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()["observations"]


def get_series_info(series_id: str) -> dict:
    """Fetch metadata about a FRED series."""
    url = f"{BASE_URL}/series"
    params = {
        "series_id": series_id,
        "api_key": FRED_API_KEY,
        "file_type": "json",
    }
    resp = httpx.get(url, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()["seriess"][0]


def search_series(query: str, limit: int = 20) -> list[dict]:
    """Search FRED for series matching a query."""
    url = f"{BASE_URL}/series/search"
    params = {
        "search_text": query,
        "api_key": FRED_API_KEY,
        "file_type": "json",
        "limit": limit,
    }
    resp = httpx.get(url, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()["seriess"]
