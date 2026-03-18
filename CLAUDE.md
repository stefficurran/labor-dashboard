# Labor Economics Dashboard

## What this is
A personal dashboard for tracking U.S. labor market trends, with a focus on tech sector hiring, layoffs, AI adoption, and cross-source correlation. Built as a data exploration tool, not production software.

## Architecture

```
labor-dashboard/
├── pipeline/                # Python data scripts
│   ├── fred_client.py           # FRED API wrapper
│   ├── ingest.py                # Core JOLTS/employment data (includes JTSLDL)
│   ├── ingest_sectors.py        # 17 NAICS sector employment
│   ├── ingest_warn.py           # WARN Firehose API (--dry-run flag, starter tier 1yr history)
│   ├── ingest_layoffs_fyi.py    # Airtable scraper (supplemental, capped at 1500 rows)
│   ├── ingest_layoffs.py        # Kaggle CSV ingest (primary layoffs.fyi source, 4300+ rows)
│   ├── ingest_nvda.py           # NVIDIA stock via yfinance
│   ├── ingest_indeed_ai.py      # Indeed AI job posting tracker
│   ├── ingest_btos.py           # Census BTOS AI adoption survey
│   ├── ingest_ai_displacement.py # AI displacement tracker (orphaned, repo not found)
│   ├── export_json.py           # labor.json + analytics.json (10 analytics incl. net flow, MoM delta)
│   ├── export_sectors.py        # sectors.json
│   ├── export_layoffs.py        # layoffs.json (US-only, includes WARN, recent_events)
│   ├── export_market.py         # market.json
│   ├── export_correlation.py    # correlation.json
│   ├── export_ai.py             # ai.json
│   ├── export_event_study.py    # event_study.json (with employment context)
│   ├── generate_actions.py      # ai_actions.json (OpenAI gpt-4o)
│   ├── refresh_all.sh           # Full 15-step pipeline with WARN dry-run validation
│   └── tests/
├── data/
│   ├── labor.duckdb             # Local analytical database (all ingested data)
│   └── layoffs.csv              # Kaggle layoffs.fyi export (primary source)
├── dashboard/                   # Next.js app (TypeScript, Tailwind, Recharts)
│   ├── app/
│   │   ├── api/news/route.ts        # NewsData.io proxy (live news search)
│   │   ├── types/events.ts          # LaborEvent type, category colors/labels
│   │   └── components/
│   │       └── TimeSeriesChart.tsx   # Recharts wrapper (supports event markers)
│   ├── public/data/
│   │   ├── labor.json           # Tech employment, JOLTS, unemployment
│   │   ├── analytics.json       # Calculated metrics (net flow, MoM delta, etc.)
│   │   ├── sectors.json         # 17 NAICS sector rankings
│   │   ├── events.json          # ~65 curated labor/tech events (2000–2025)
│   │   ├── market.json          # Stock indices
│   │   ├── layoffs.json         # US-only layoffs (WARN + layoffs.fyi + recent events)
│   │   ├── correlation.json     # Cross-source correlations
│   │   ├── ai.json              # AI adoption and job posting data
│   │   ├── event_study.json     # AI release CAR analysis
│   │   └── ai_actions.json      # AI-generated insights
│   └── .env.local               # NEWSDATA_API_KEY (never commit)
├── .env                         # FRED_API_KEY, WARN_API_KEY, OPENAI_API_KEY (never commit)
└── pyproject.toml               # Python deps (uv)
```

## Data flow
1. `pipeline/ingest*.py` scripts fetch from FRED, WARN Firehose, Kaggle, Census, yfinance → store in `data/labor.duckdb`
2. `pipeline/export*.py` scripts query DuckDB → write JSON to `dashboard/public/data/`
3. `pipeline/generate_actions.py` calls OpenAI to produce AI-generated insights
4. Next.js frontend loads JSON at runtime and renders charts client-side

## Key commands

```bash
# Full data refresh (all sources + exports)
cd pipeline && bash refresh_all.sh

# Individual ingest
cd pipeline && uv run python ingest.py          # FRED core data
cd pipeline && uv run python ingest_sectors.py   # FRED sectors
cd pipeline && uv run python ingest_warn.py --dry-run  # Validate before real run
cd pipeline && uv run python ingest_warn.py      # WARN Firehose
cd pipeline && uv run python ingest_layoffs.py   # Kaggle CSV layoffs

# Export JSON for dashboard
cd pipeline && uv run python export_json.py      # labor.json + analytics.json
cd pipeline && uv run python export_layoffs.py   # layoffs.json
cd pipeline && uv run python export_sectors.py   # sectors.json

# Run tests
uv run pytest pipeline/tests/ -v

# Run the dashboard
cd dashboard && npm run dev
```

## Data sources
- **FRED API** (api.stlouisfed.org) — all BLS data, stock indices, Indeed indices. Key stored in `.env`
- **WARN Firehose** (warnfirehose.com) — government WARN Act notices. Starter tier: 200 req/day, ~1yr history. Has `--dry-run` flag.
- **Layoffs.fyi** — via Kaggle CSV export (primary, 4300+ rows) + Airtable scraper (supplemental, capped at 1500)
- **Census BTOS** — AI adoption rates by sector (quarterly)
- **NewsData.io** — live news search (last 48 hours only). Key in `dashboard/.env.local`
- **OpenAI** — AI-generated insights via gpt-4o. Key in `.env`
- Key FRED series: USINFO (tech employment), JTU5100* (JOLTS info sector), UNRATE, LNU04032237
- 17 major NAICS sectors for the Growth tab
- All data goes back to 2000, monthly frequency

## Dashboard tabs
1. **Tech Employment** (`/tech`) — Employment overview (levels, unemployment, MoM delta, YoY change), JOLTS breakdown (net flow, openings/hires/quits/layoffs, ratios), Tech vs Economy (indexed comparisons including layoffs), Layoffs Detail (layoffs.fyi monthly + industry, WARN monthly + industry, recent events table, largest events table)
2. **Growing Markets** (`/growth`) — 17 NAICS sector rankings, indexed employment comparison, YoY growth over time
3. **Events & Impact** (`/events`) — Curated event timeline (~65 events) with chart annotations, AI release CAR analysis (stock impact), live news search via NewsData.io
4. **Stock Market** (`/market`) — Stock indices, indexed comparison, market-employment overlay, NASDAQ vs job openings correlation
5. **AI & Automation** (`/ai`) — AI job posting share, software dev postings, IT investment, semiconductor production, NVIDIA vs employment, sector AI adoption rates

Old tabs that redirect: `/layoffs` → `/tech`, `/correlation` → `/market`, `/news` → `/events`, `/ai-impact` → `/events`

## .env keys
- `FRED_API_KEY` — required (root `.env`)
- `WARN_API_KEY` — optional, for WARN Firehose (root `.env`)
- `OPENAI_API_KEY` — optional, for AI insights (root `.env`)
- `NEWSDATA_API_KEY` — optional, for live news (`dashboard/.env.local`)

## News & Events details
- `events.json` is hand-curated (~65 events), not fetched from an API. To add events, edit the JSON directly.
- `TimeSeriesChart` accepts optional `events` and `selectedEventId` props to render `ReferenceLine` markers with clickable dot labels.
- Live news search requires `NEWSDATA_API_KEY` in `dashboard/.env.local`. Uses `prioritydomain=top` to filter to top-tier sources.
- NewsData.io free tier only covers the last 48 hours — no historical archive.

## NAICS sector notes
- "Information" (NAICS 51) = software, streaming, search, cloud, telecom — the core "tech" proxy
- Does NOT include: Apple/Amazon (retail), Intel/Nvidia (manufacturing), Accenture (professional services)
- "Professional & Technical Services" catches IT consulting, computer systems design

## Deployment
- Deploy from `./dashboard` (root has pyproject.toml which confuses Cloud Run buildpacks)
```bash
gcloud run deploy labor-dashboard --source ./dashboard --region us-central1 --allow-unauthenticated --port 3000 --memory 512Mi --project labor-data-dashboard --clear-base-image
```
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
