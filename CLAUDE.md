# Labor Economics Dashboard

## What this is
A personal dashboard for tracking U.S. labor market trends, with a focus on tech sector hiring. Built as a data exploration tool, not production software.

## Architecture

```
labor-dashboard/
├── pipeline/          # Python data scripts
│   ├── fred_client.py     # FRED API wrapper
│   ├── ingest.py          # Fetch core JOLTS/employment data into DuckDB
│   ├── ingest_sectors.py  # Fetch all major NAICS sector employment data
│   ├── export_json.py     # Export tech tab data (labor.json, analytics.json)
│   └── export_sectors.py  # Export growth tab data (sectors.json)
├── data/
│   └── labor.duckdb       # Local analytical database (all FRED data)
├── dashboard/             # Next.js app (TypeScript, Tailwind, Recharts)
│   ├── app/
│   │   ├── api/news/route.ts    # NewsData.io proxy (live news search)
│   │   ├── types/events.ts      # LaborEvent type, category colors/labels
│   │   └── components/
│   │       ├── TimeSeriesChart.tsx   # Recharts wrapper (supports event markers)
│   │       ├── GrowthTab.tsx        # Growth tab
│   │       └── NewsEventsTab.tsx    # News & Events tab
│   ├── public/data/
│   │   ├── labor.json       # Tech employment, JOLTS, unemployment
│   │   ├── analytics.json   # Calculated metrics
│   │   ├── sectors.json     # 17 NAICS sector rankings
│   │   └── events.json      # ~40 curated labor/tech events (2000–2025)
│   └── .env.local           # NEWSDATA_API_KEY (never commit)
└── .env                   # FRED_API_KEY (never commit)
```

## Data flow
1. `pipeline/ingest*.py` scripts fetch from FRED API → store in `data/labor.duckdb`
2. `pipeline/export*.py` scripts query DuckDB → write JSON to `dashboard/public/data/`
3. Next.js frontend loads JSON at runtime and renders charts client-side

## Key commands

```bash
# Refresh data from FRED
cd pipeline && uv run python ingest.py && uv run python ingest_sectors.py

# Re-export JSON for the dashboard
cd pipeline && uv run python export_json.py && uv run python export_sectors.py

# Run the dashboard
cd dashboard && npm run dev
```

## Data sources
- **FRED API** (api.stlouisfed.org) — mirrors all BLS data. Key stored in `.env`
- Key series: USINFO (tech employment), JTU5100* (JOLTS info sector), UNRATE, LNU04032237
- 17 major NAICS sectors for the Growth tab
- All data goes back to 2000, monthly frequency

## Dashboard tabs
- **Tech Sector** — KPIs, JOLTS breakdown, openings/hires ratio, quits rate, sector vs all indexed comparisons
- **Growing Markets** — sortable rankings table, indexed employment comparison, YoY growth over time. Rows are clickable to toggle sectors on/off in charts.
- **News & Events** — curated historical events as clickable chart annotations on the tech employment timeline, plus live news search via NewsData.io. Events are filterable by category and impact level. Clicking a marker on the chart expands the event inline in the timeline list below.

## News & Events details
- `events.json` is hand-curated (~40 events), not fetched from an API. To add events, edit the JSON directly.
- `TimeSeriesChart` accepts optional `events` and `selectedEventId` props to render `ReferenceLine` markers with clickable dot labels.
- Live news search requires `NEWSDATA_API_KEY` in `dashboard/.env.local`. Uses `prioritydomain=top` to filter to top-tier sources.
- NewsData.io free tier only covers the last 48 hours — no historical archive.

## NAICS sector notes
- "Information" (NAICS 51) = software, streaming, search, cloud, telecom — the core "tech" proxy
- Does NOT include: Apple/Amazon (retail), Intel/Nvidia (manufacturing), Accenture (professional services)
- "Professional & Technical Services" catches IT consulting, computer systems design

## Deployment
- Cloud Run: `gcloud run deploy labor-dashboard --source . --region us-central1 --allow-unauthenticated --port 3000 --memory 512Mi`
- Service URL: https://labor-dashboard-444079131902.us-central1.run.app
- GCP project: `labor-data-dashboard`
- For live news on Cloud Run, set `NEWSDATA_API_KEY` as an env var on the service

## Project Tracking
- **Linear project:** [Labor Dashboard](https://linear.app/steffis-world/project/labor-dashboard-459b109bc390)

## Conventions
- Python managed via `uv` (pyproject.toml at root)
- Node managed via `nvm` (dashboard has its own package.json)
- Charts use Recharts with a dark theme (gray-900 cards, gray-950 background)
- Every chart has an `explainer` prop — plain-English tooltip for non-economists
- DuckDB is the analytical layer; JSON export is the interface between Python and Next.js
