#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "=== Refreshing Labor Dashboard Data ==="
echo ""

echo "[1/15] Fetching FRED labor data..."
uv run python ingest.py

echo "[2/15] Fetching FRED sector data..."
uv run python ingest_sectors.py

echo "[3/15] Fetching WARN notices..."
if uv run python ingest_warn.py --dry-run; then
    uv run python ingest_warn.py
else
    echo "  -> Skipped (dry run failed — not burning API requests)"
fi

echo "[4/15] Scraping layoffs.fyi (live from Airtable)..."
uv run python ingest_layoffs_fyi.py || echo "  -> Skipped (Airtable may be unavailable)"

echo "[5/15] Ingesting NVDA stock data..."
uv run python ingest_nvda.py || echo "  -> Skipped"

echo "[6/15] Ingesting Indeed AI tracker..."
uv run python ingest_indeed_ai.py || echo "  -> Skipped"

echo "[7/15] Ingesting BTOS data..."
uv run python ingest_btos.py || echo "  -> Skipped"

echo "[8/15] Ingesting AI displacement data..."
uv run python ingest_ai_displacement.py || echo "  -> Skipped"

echo "[9/15] Exporting labor + analytics JSON..."
uv run python export_json.py

echo "[10/15] Exporting sector rankings JSON..."
uv run python export_sectors.py

echo "[11/15] Exporting market data JSON..."
uv run python export_market.py

echo "[12/15] Exporting layoffs + correlation JSON..."
uv run python export_layoffs.py
uv run python export_correlation.py

echo "[13/15] Exporting AI data JSON..."
uv run python export_ai.py

echo "[14/15] Exporting event study JSON..."
uv run python export_event_study.py

echo "[15/15] Generating AI-powered insights..."
uv run python generate_actions.py || echo "  -> Skipped (no OPENAI_API_KEY or API error)"

echo ""
echo "=== Done! All data refreshed. ==="
echo "Run 'cd ../dashboard && npm run dev' to see the updated dashboard."
