"""Export DuckDB data as JSON for the Next.js dashboard."""

import json
import duckdb

DB_PATH = "../data/labor.duckdb"
OUT_PATH = "../dashboard/public/data"

con = duckdb.connect(DB_PATH, read_only=True)

# Export each series as part of a grouped structure for the dashboard
series_groups = {
    "tech_employment": {
        "title": "Tech Sector Employment",
        "subtitle": "Thousands of employees, seasonally adjusted",
        "series": {
            "USINFO": "Information",
            "CES6054000001": "Professional & Technical Services",
        },
    },
    "employment_context": {
        "title": "Total Nonfarm Employment",
        "subtitle": "Thousands of employees, seasonally adjusted",
        "series": {
            "PAYEMS": "Total Nonfarm",
        },
    },
    "jolts_info": {
        "title": "JOLTS: Information Sector",
        "subtitle": "Thousands, seasonally adjusted",
        "series": {
            "JTU5100JOL": "Job Openings",
            "JTU5100HIL": "Hires",
            "JTU5100QUL": "Quits",
            "JTU5100LDL": "Layoffs",
        },
    },
    "jolts_probus": {
        "title": "JOLTS: Professional & Business Services",
        "subtitle": "Thousands, seasonally adjusted",
        "series": {
            "JTU540099JOL": "Job Openings",
            "JTU540099HIL": "Hires",
        },
    },
    "jolts_total": {
        "title": "JOLTS: Total Nonfarm (Comparison)",
        "subtitle": "Thousands, seasonally adjusted",
        "series": {
            "JTSJOL": "Job Openings",
            "JTSHIL": "Hires",
            "JTSQUL": "Quits",
        },
    },
    "unemployment": {
        "title": "Unemployment Rate",
        "subtitle": "Percent, seasonally adjusted",
        "series": {
            "LNU04032237": "Information Industry",
            "UNRATE": "National",
        },
    },
}

import os
os.makedirs(OUT_PATH, exist_ok=True)

all_data = {}

for group_key, group in series_groups.items():
    # Build a date-indexed dataset for each group
    series_ids = list(group["series"].keys())

    # Get all dates across all series in this group
    dates_query = " UNION ".join(
        [f"SELECT DISTINCT date FROM observations WHERE series_id = '{sid}'" for sid in series_ids]
    )
    dates = [row[0].isoformat() for row in con.execute(f"SELECT DISTINCT date FROM ({dates_query}) ORDER BY date").fetchall()]

    # Build data points
    data_points = []
    for date in dates:
        point = {"date": date}
        for sid in series_ids:
            result = con.execute(
                "SELECT value FROM observations WHERE series_id = ? AND date = ?",
                [sid, date]
            ).fetchone()
            label = group["series"][sid]
            point[label] = result[0] if result else None
        data_points.append(point)

    all_data[group_key] = {
        "title": group["title"],
        "subtitle": group["subtitle"],
        "labels": list(group["series"].values()),
        "data": data_points,
    }

# Write combined JSON
with open(f"{OUT_PATH}/labor.json", "w") as f:
    json.dump(all_data, f)

# Also compute some derived analytics
analytics = {}

# YoY change in info sector employment
info_emp = con.execute("""
    SELECT date, value,
           value - LAG(value, 12) OVER (ORDER BY date) as yoy_change,
           ROUND((value - LAG(value, 12) OVER (ORDER BY date)) / LAG(value, 12) OVER (ORDER BY date) * 100, 2) as yoy_pct
    FROM observations WHERE series_id = 'USINFO' ORDER BY date
""").fetchall()

analytics["info_employment_yoy"] = {
    "title": "Information Sector: Year-over-Year Employment Change",
    "subtitle": "Thousands & percent change",
    "data": [
        {"date": r[0].isoformat(), "employment": r[1], "yoy_change": r[2], "yoy_pct": r[3]}
        for r in info_emp if r[2] is not None
    ],
}

# Job openings to hires ratio (info sector) — indicates labor market tightness
ratio = con.execute("""
    SELECT o1.date,
           o1.value as openings,
           o2.value as hires,
           ROUND(o1.value / NULLIF(o2.value, 0), 2) as ratio
    FROM observations o1
    JOIN observations o2 ON o1.date = o2.date
    WHERE o1.series_id = 'JTU5100JOL' AND o2.series_id = 'JTU5100HIL'
    ORDER BY o1.date
""").fetchall()

analytics["info_openings_hires_ratio"] = {
    "title": "Information Sector: Job Openings to Hires Ratio",
    "subtitle": "Higher = tighter labor market (harder to fill positions)",
    "data": [
        {"date": r[0].isoformat(), "openings": r[1], "hires": r[2], "ratio": r[3]}
        for r in ratio
    ],
}

# Quits rate as % of employment (info sector) — worker confidence indicator
quits = con.execute("""
    SELECT q.date, q.value as quits, e.value as employment,
           ROUND(q.value / NULLIF(e.value, 0) * 100, 2) as quits_pct
    FROM observations q
    JOIN observations e ON q.date = e.date
    WHERE q.series_id = 'JTU5100QUL' AND e.series_id = 'USINFO'
    ORDER BY q.date
""").fetchall()

analytics["info_quits_rate"] = {
    "title": "Information Sector: Quits as % of Employment",
    "subtitle": "Higher quits = more worker confidence in finding new jobs",
    "data": [
        {"date": r[0].isoformat(), "quits": r[1], "employment": r[2], "quits_pct": r[3]}
        for r in quits
    ],
}

# Indexed JOLTS comparisons: Info sector vs Total Nonfarm (base = first observation = 100)
jolts_comparisons = {
    "jolts_openings_comparison": {
        "title": "Job Openings: Info Sector vs All Industries",
        "subtitle": "Indexed to 100 at start of period — compare the trend, not the level",
        "info_series": "JTU5100JOL",
        "total_series": "JTSJOL",
        "info_label": "Information",
        "total_label": "All Industries",
    },
    "jolts_hires_comparison": {
        "title": "Hires: Info Sector vs All Industries",
        "subtitle": "Indexed to 100 at start of period — compare the trend, not the level",
        "info_series": "JTU5100HIL",
        "total_series": "JTSHIL",
        "info_label": "Information",
        "total_label": "All Industries",
    },
    "jolts_quits_comparison": {
        "title": "Quits: Info Sector vs All Industries",
        "subtitle": "Indexed to 100 at start of period — compare the trend, not the level",
        "info_series": "JTU5100QUL",
        "total_series": "JTSQUL",
        "info_label": "Information",
        "total_label": "All Industries",
    },
}

for key, comp in jolts_comparisons.items():
    rows = con.execute("""
        SELECT i.date, i.value as info_val, t.value as total_val
        FROM observations i
        JOIN observations t ON i.date = t.date
        WHERE i.series_id = ? AND t.series_id = ?
        ORDER BY i.date
    """, [comp["info_series"], comp["total_series"]]).fetchall()

    if rows:
        info_base = rows[0][1]
        total_base = rows[0][2]
        analytics[key] = {
            "title": comp["title"],
            "subtitle": comp["subtitle"],
            "labels": [comp["info_label"], comp["total_label"]],
            "data": [
                {
                    "date": r[0].isoformat(),
                    comp["info_label"]: round(r[1] / info_base * 100, 1) if info_base else None,
                    comp["total_label"]: round(r[2] / total_base * 100, 1) if total_base else None,
                }
                for r in rows
            ],
        }

with open(f"{OUT_PATH}/analytics.json", "w") as f:
    json.dump(analytics, f)

con.close()
print(f"Exported to {OUT_PATH}/labor.json and analytics.json")
print(f"Groups: {list(all_data.keys())}")
print(f"Analytics: {list(analytics.keys())}")
