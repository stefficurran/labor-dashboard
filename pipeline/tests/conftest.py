import json
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent.parent / "dashboard" / "public" / "data"
DB_PATH = Path(__file__).parent.parent.parent / "data" / "labor.duckdb"

def load_json(name):
    with open(DATA_DIR / name) as f:
        return json.load(f)

def assert_series_group(group, min_rows=10):
    """Validate a SeriesGroup has the expected shape for the frontend."""
    assert "title" in group, "Missing title"
    assert "subtitle" in group, "Missing subtitle"
    assert "labels" in group, "Missing labels"
    assert "data" in group, "Missing data"
    assert isinstance(group["labels"], list)
    assert len(group["labels"]) >= 1, f"No labels: {group['title']}"
    assert len(group["data"]) >= min_rows, f"Only {len(group['data'])} rows in {group['title']}"
    for row in group["data"][:3]:
        assert "date" in row, f"Row missing date in {group['title']}"
