# Labor Economics Dashboard

A dashboard for tracking U.S. labor market trends, with a focus on tech sector hiring, AI adoption, and cross-source correlation. Built with Next.js and a Python/DuckDB data pipeline.

## Dashboard Tabs

- **Tech Sector** — KPIs, JOLTS breakdown, openings/hires ratio, quits rate, indexed sector vs national comparisons
- **Growing Markets** — sortable rankings table across 17 NAICS sectors, indexed employment comparison, YoY growth over time
- **News & Events** — curated historical events as clickable chart annotations, plus live news search via NewsData.io
- **AI & Automation** — AI job posting share, BTOS adoption survey data, NVIDIA/semiconductor proxies, event study analysis
- **Market & Layoffs** — stock indices, WARN Act notices, layoffs.fyi data, cross-source correlation charts

## Architecture

```
pipeline/           # Python data pipeline
  ingest*.py          # Fetch data from FRED, WARN Firehose, layoffs.fyi, etc.
  export*.py          # Query DuckDB -> write JSON for the frontend
  refresh_all.sh      # Run the full 15-step pipeline
data/
  labor.duckdb        # Local analytical database (gitignored)
dashboard/           # Next.js app (TypeScript, Tailwind, Recharts)
  app/                # Pages, API routes, components
  public/data/        # JSON files consumed by the frontend
```

## Data Flow

1. `pipeline/ingest*.py` scripts fetch from external APIs and store in `data/labor.duckdb`
2. `pipeline/export*.py` scripts query DuckDB and write JSON to `dashboard/public/data/`
3. Next.js frontend loads JSON at runtime and renders charts client-side

## Setup

### Prerequisites

- Python 3.12+ with [uv](https://docs.astral.sh/uv/)
- Node.js 20+ with npm

### Environment Variables

Copy `.env.example` to `.env` at the project root, and `dashboard/.env.local.example` to `dashboard/.env.local`:

```bash
# .env (project root)
FRED_API_KEY=your_key_here          # Required — https://fred.stlouisfed.org/docs/api/api_key.html
WARN_API_KEY=your_key_here          # Optional — https://warnfirehose.com (free starter tier, 200 req/day)
OPENAI_API_KEY=your_key_here        # Optional — powers AI-generated insights

# dashboard/.env.local
NEWSDATA_API_KEY=your_key_here      # Optional — https://newsdata.io (live news search, free tier)
```

### Install Dependencies

```bash
# Python (from project root)
uv sync

# Node (from dashboard/)
cd dashboard && npm install
```

### Populate Data

```bash
# Run the full pipeline (fetches all sources, exports JSON)
cd pipeline && bash refresh_all.sh

# Or run individual steps
uv run python ingest.py              # FRED core data
uv run python ingest_sectors.py      # FRED sector data
uv run python ingest_warn.py         # WARN Act notices (use --dry-run to validate first)
uv run python export_json.py         # Export to JSON
```

### Run the Dashboard

```bash
cd dashboard && npm run dev
```

## Data Sources

| Source | What it provides | Frequency | API key required |
|---|---|---|---|
| [FRED](https://fred.stlouisfed.org/) | Employment, JOLTS, unemployment, stock indices, Indeed postings | Monthly/Daily | Yes |
| [WARN Firehose](https://warnfirehose.com/) | WARN Act layoff notices (government-sourced) | Event-based | Yes (free tier) |
| [layoffs.fyi](https://layoffs.fyi/) | Crowdsourced tech layoff tracker | Event-based | No (scraped) |
| [Census BTOS](https://www.census.gov/data/experimental-data-products/business-trends-and-outlook-survey.html) | AI adoption rates by sector | Quarterly | No |
| [NewsData.io](https://newsdata.io/) | Live news search (last 48 hours) | Live | Yes (free tier) |

## NAICS Sector Notes

- "Information" (NAICS 51) = software, streaming, search, cloud, telecom — the core "tech" proxy
- Does NOT include: Apple/Amazon (retail), Intel/Nvidia (manufacturing), Accenture (professional services)
- "Professional & Technical Services" catches IT consulting, computer systems design

## Deployment

Designed for Cloud Run:

```bash
gcloud run deploy labor-dashboard \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi
```

Set `NEWSDATA_API_KEY` as an env var on the service for live news search.
