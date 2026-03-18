import duckdb
from conftest import DB_PATH

def test_db_exists():
    assert DB_PATH.exists(), f"DuckDB not found at {DB_PATH}"

def test_tables_exist():
    con = duckdb.connect(str(DB_PATH), read_only=True)
    tables = [r[0] for r in con.execute("SHOW TABLES").fetchall()]
    for table in ["observations", "series_meta", "layoffs", "warn_notices"]:
        assert table in tables, f"Missing table: {table}"
    con.close()

def test_key_fred_series_have_data():
    con = duckdb.connect(str(DB_PATH), read_only=True)
    key_series = ["USINFO", "PAYEMS", "JTU5100JOL", "JTU5100HIL", "JTU5100QUL", "JTU5100LDL", "JTSLDL", "UNRATE", "SP500", "NASDAQCOM"]
    for series in key_series:
        count = con.execute(f"SELECT COUNT(*) FROM observations WHERE series_id = ?", [series]).fetchone()[0]
        assert count > 100, f"{series} only has {count} rows"
    con.close()

def test_layoffs_table_populated():
    con = duckdb.connect(str(DB_PATH), read_only=True)
    count = con.execute("SELECT COUNT(*) FROM layoffs").fetchone()[0]
    assert count > 1000, f"Layoffs table only has {count} rows"
    con.close()

def test_warn_table_populated():
    con = duckdb.connect(str(DB_PATH), read_only=True)
    count = con.execute("SELECT COUNT(*) FROM warn_notices").fetchone()[0]
    assert count > 100, f"WARN table only has {count} rows"
    con.close()
