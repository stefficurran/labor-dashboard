# Phase 2: Data Sources Research

Research completed 2026-03-17. Covers stock market indices, layoffs data, AI news, and cross-source correlation strategy.

---

## 1. Stock Market Data

### FRED (Primary — Zero New Code)

The existing `fred_client.py` can fetch these with no changes. Just add the series IDs.

| Index | Series ID | Frequency | History | URL |
|-------|-----------|-----------|---------|-----|
| S&P 500 | `SP500` | Daily (market close) | 1947–present | https://fred.stlouisfed.org/series/SP500 |
| NASDAQ Composite | `NASDAQCOM` | Daily (close) | 1971–present | https://fred.stlouisfed.org/series/NASDAQCOM |

**Caveat:** FRED's S&P 500 licensing (S&P Dow Jones Indices LLC) may limit daily data to **10 years** via the API.

**FRED stock market category:** https://fred.stlouisfed.org/categories/32255 (also has Dow Jones Industrial Average, NASDAQ-100, CBOE VIX)

### yfinance (Fallback — Only If FRED's 10Y Limit Is a Problem)

- Unofficial Yahoo Finance scraper, not a licensed API
- S&P 500: `^GSPC`, NASDAQ: `^IXIC`, S&P 500 ETF: `SPY`
- Returns DataFrame: `Open`, `High`, `Low`, `Close`, `Adj Close`, `Volume`
- `period="max"` goes back to full history
- No API key, free, but undocumented rate limits and IP bans
- Risk: no SLA, can break at any time

```python
import yfinance as yf
data = yf.download("^GSPC ^IXIC", start="2000-01-01", end="2026-03-17")
```

### Alpha Vantage (Tertiary Fallback)

- https://www.alphavantage.co/documentation/
- Free tier: 25 requests/day, 5 requests/minute
- 20+ years of history, JSON and CSV formats
- Licensed by NASDAQ as US market data provider
- **Too restrictive** for a pipeline that fetches multiple series — not recommended unless FRED and yfinance both fail

---

## 2. Layoffs Data

### layoffs.fyi (Crowdsourced)

- https://layoffs.fyi/ — created by Roger Lee
- **No public API.** Backend is Airtable.
- Best programmatic access: **Kaggle CSV mirrors**

**Kaggle datasets:**
- https://www.kaggle.com/datasets/swaptr/layoffs-2022
- https://www.kaggle.com/datasets/theakhilb/layoffs-data-2022
- https://www.kaggle.com/datasets/ulrikeherold/tech-layoffs-2020-2024

**CSV columns:**

| Column | Type | Notes |
|--------|------|-------|
| `company` | text | |
| `location` | text | HQ location |
| `industry` | text | |
| `total_laid_off` | integer | |
| `percentage_laid_off` | real | |
| `date` | date | |
| `stage` | text | Funding stage |
| `country` | text | |
| `funds_raised_millions` | real | |

**Coverage:** March 2020–present (Kaggle dumps may lag; site updates continuously)
**Sources aggregated:** Bloomberg, SF Business Times, TechCrunch, NY Times
**Data quality:** Duplicates and inconsistent formatting — needs cleaning

### WARN Act Sources (Government Data)

| Source | URL | Notes |
|--------|-----|-------|
| WARN Firehose | https://warnfirehose.com/ | REST API + CSV bulk export, free. Combines WARN notices, H-1B/LCA, unemployment claims, SEC 8-K, bankruptcy |
| WARN Tracker | https://www.warntracker.com/ | Individual WARN records, exact office/employee counts, full dataset downloads |
| Layoff Data | https://layoffdata.com/data/ | 81K+ notices, 8.7M+ workers, standardized from state WARN filings |

### Recommendation

Use **Kaggle CSV** for historical backfill (2020+), **WARN Firehose** for ongoing government-sourced data. Cross-reference both for coverage.

---

## 3. AI News / Announcements

### NewsData.io (Already Integrated)

- No standalone "AI" category. Use `category=technology` + AI keyword queries, or use the **tag** parameter (up to 5 tags per query, ~85 AI-related tags available)
- Free tier: last 48 hours only — no historical archive
- Already integrated: `NEWSDATA_API_KEY` in `dashboard/.env.local`, proxy at `dashboard/app/api/news/route.ts`

### RSS Feeds

| Source | Feed URL |
|--------|----------|
| TechCrunch AI | `https://techcrunch.com/category/artificial-intelligence/feed/` |
| TechCrunch (main) | `https://techcrunch.com/feed/` |
| The Verge AI | (use main feed, filter by AI category) |
| Ars Technica AI | (use main feed, filter by AI category) |

**Curated list:** https://github.com/foorilla/allainews_sources — AI/ML/Data Science sources with RSS URLs

**Dependency needed:** `feedparser` for Python RSS parsing

### Structured AI Model Timelines

| Source | URL | Coverage |
|--------|-----|----------|
| llm-timeline.com | https://llm-timeline.com/ | 194+ LLMs, 2017–2026 |
| LLM Stats | https://llm-stats.com/llm-updates | Real-time LLM release tracking |
| AI Flash Report | https://aiflashreport.com/model-releases | Specs, benchmarks, availability |
| Hugging Face 2024 Timeline | https://huggingface.co/spaces/reach-vb/2024-ai-timeline | 2024 focus |

### Recommendation

Extend `events.json` with structured data from llm-timeline.com. Add RSS parsing for ongoing AI news. NewsData.io already covers live search.

---

## 4. Cross-Source Correlation

### The Problem

| Source | Frequency |
|--------|-----------|
| BLS labor data | Monthly (first-of-month) |
| Stock indices | Daily (market close) |
| Layoffs | Irregular (event-based) |
| AI news/events | Irregular |

### Strategy

**Store at native frequency in DuckDB. Downsample to monthly at export time.**

### Alignment Convention

- **Stocks:** Month-end closing price (last trading day)
- **BLS data:** First-of-month reference date
- **Layoffs:** Sum `total_laid_off` per month
- **AI events:** Map to month

### Polars Resampling (Recommended)

```python
import polars as pl

# Downsample daily stock data to monthly (month-end close)
monthly = (
    daily_df
    .sort("date")
    .group_by_dynamic("date", every="1mo")
    .agg(pl.col("close").last().alias("month_end_close"))
)
```

- Monthly alias in Polars: `'1mo'` (not `'M'` like pandas)
- Buckets are left-closed, left-labelled by default
- Docs: https://docs.pola.rs/user-guide/transformations/time-series/resampling/

---

## 5. Pipeline Integration

### Current Architecture

```
FRED API → fred_client.py → DuckDB → export_json.py → JSON → Next.js
```

### Phase 2a: Stock Market (Lowest Effort)

1. Add `SP500` and `NASDAQCOM` to series list in `ingest.py`
2. Existing `fred_client.py` handles everything — zero client changes
3. New export (or extend `export_json.py`): downsample daily → monthly via Polars
4. Output: `market.json` in `dashboard/public/data/`
5. **No new dependencies**

### Phase 2b: Layoffs Data

1. Download Kaggle CSV (one-time backfill)
2. New `ingest_layoffs.py`: read CSV, clean, load into DuckDB `layoffs` table
3. New `export_layoffs.py`: query DuckDB, aggregate monthly, export JSON
4. DuckDB schema: `company TEXT, location TEXT, industry TEXT, total_laid_off INTEGER, percentage_laid_off REAL, date DATE, stage TEXT, country TEXT, funds_raised_millions REAL`

### Phase 2c: AI News/Events

1. Extend `events.json` with AI model release timeline data
2. Add RSS feed parsing (`feedparser`) for ongoing news
3. NewsData.io already integrated for live search — add AI tag filtering

### New Dependencies

| Package | Phase | Purpose |
|---------|-------|---------|
| `feedparser` | 2c | RSS feed parsing |
| `yfinance` | 2a (only if FRED 10Y limit is hit) | Yahoo Finance fallback |
