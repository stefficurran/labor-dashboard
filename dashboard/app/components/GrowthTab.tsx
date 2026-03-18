"use client";

import { useState } from "react";
import TimeSeriesChart from "./TimeSeriesChart";

interface SectorRanking {
  series_id: string;
  sector: string;
  latest_value: number;
  yoy_pct: number | null;
  yoy_change: number | null;
  three_year_pct: number | null;
  five_year_pct: number | null;
}

interface SectorsData {
  rankings: SectorRanking[];
  sector_labels: string[];
  timeseries: Record<string, { date: string; value: number }[]>;
  growth_over_time: Record<string, unknown>[];
}

const SECTOR_COLORS: Record<string, string> = {
  "Health Care": "#10b981",
  "Education & Health": "#34d399",
  "Construction": "#f59e0b",
  "Prof & Business Services": "#3b82f6",
  "Professional & Technical": "#60a5fa",
  "Leisure & Hospitality": "#ec4899",
  "Accommodation & Food": "#f472b6",
  "Transportation & Warehousing": "#8b5cf6",
  "Government": "#6b7280",
  "Financial Activities": "#14b8a6",
  "Information": "#ef4444",
  "Manufacturing": "#a78bfa",
  "Mining & Logging": "#78716c",
  "Wholesale Trade": "#fb923c",
  "Other Services": "#94a3b8",
  "Admin & Support": "#38bdf8",
  "Arts & Entertainment": "#e879f9",
};

function GrowthBar({ value, max }: { value: number; max: number }) {
  const width = Math.abs(value) / max * 100;
  const isPositive = value >= 0;
  return (
    <div className="flex items-center gap-2 w-40">
      <div className="relative w-full h-4 bg-gray-800 rounded overflow-hidden">
        {isPositive ? (
          <div
            className="absolute left-1/2 h-full bg-emerald-500/60 rounded-r"
            style={{ width: `${width / 2}%` }}
          />
        ) : (
          <div
            className="absolute right-1/2 h-full bg-red-500/60 rounded-l"
            style={{ width: `${width / 2}%` }}
          />
        )}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-600" />
      </div>
    </div>
  );
}

type SortField = "yoy_pct" | "three_year_pct" | "five_year_pct" | "latest_value";

export default function GrowthTab({ sectors }: { sectors: SectorsData }) {
  const [sortBy, setSortBy] = useState<SortField>("yoy_pct");
  const [selectedSectors, setSelectedSectors] = useState<string[]>([
    "Information", "Health Care", "Construction", "Prof & Business Services", "Leisure & Hospitality",
  ]);
  const [startYear, setStartYear] = useState(2015);

  const sorted = [...sectors.rankings].sort((a, b) => {
    const av = a[sortBy] ?? -999;
    const bv = b[sortBy] ?? -999;
    return (bv as number) - (av as number);
  });

  const maxGrowth = Math.max(...sorted.map((s) => Math.abs(s[sortBy] ?? 0)));

  const toggleSector = (label: string) => {
    setSelectedSectors((prev) =>
      prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label]
    );
  };

  // Build indexed comparison data for selected sectors
  const indexedData = (() => {
    if (selectedSectors.length === 0) return [];

    // Find common dates
    const firstSeries = sectors.timeseries[selectedSectors[0]];
    if (!firstSeries) return [];

    const filtered = firstSeries.filter(
      (d) => new Date(d.date).getFullYear() >= startYear
    );

    // Get base values (first point in filtered range)
    const bases: Record<string, number> = {};
    for (const label of selectedSectors) {
      const series = sectors.timeseries[label];
      if (!series) continue;
      const first = series.find(
        (d) => new Date(d.date).getFullYear() >= startYear
      );
      if (first) bases[label] = first.value;
    }

    return filtered.map((point) => {
      const row: Record<string, unknown> = { date: point.date };
      for (const label of selectedSectors) {
        const series = sectors.timeseries[label];
        if (!series) continue;
        const match = series.find((d) => d.date === point.date);
        if (match && bases[label]) {
          row[label] = Math.round((match.value / bases[label]) * 1000) / 10;
        }
      }
      return row;
    });
  })();

  // Build YoY growth over time for selected sectors
  const growthFiltered = sectors.growth_over_time.filter(
    (d) => new Date(d.date as string).getFullYear() >= startYear
  );

  const ranges = [
    { label: "All", year: 2000 },
    { label: "10Y", year: 2016 },
    { label: "5Y", year: 2021 },
    { label: "3Y", year: 2023 },
  ];

  return (
    <div className="space-y-6">
      {/* Time range */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400 mr-2">Time range:</span>
        {ranges.map((r) => (
          <button
            key={r.year}
            onClick={() => setStartYear(r.year)}
            className={`px-3 py-1 rounded-md text-sm transition-colors ${
              startYear === r.year
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Rankings table */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">Sector Growth Rankings</h3>
          <p className="text-sm text-gray-400">Click a row to add/remove it from the charts below</p>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left px-5 py-3 font-medium">Sector</th>
              <th className="text-left px-5 py-3 font-medium">
                Employment
              </th>
              <th
                className={`text-right px-5 py-3 font-medium cursor-pointer hover:text-gray-200 ${sortBy === "yoy_pct" ? "text-blue-400" : ""}`}
                onClick={() => setSortBy("yoy_pct")}
              >
                1Y Growth {sortBy === "yoy_pct" && "▼"}
              </th>
              <th
                className={`text-right px-5 py-3 font-medium cursor-pointer hover:text-gray-200 ${sortBy === "three_year_pct" ? "text-blue-400" : ""}`}
                onClick={() => setSortBy("three_year_pct")}
              >
                3Y Growth {sortBy === "three_year_pct" && "▼"}
              </th>
              <th
                className={`text-right px-5 py-3 font-medium cursor-pointer hover:text-gray-200 ${sortBy === "five_year_pct" ? "text-blue-400" : ""}`}
                onClick={() => setSortBy("five_year_pct")}
              >
                5Y Growth {sortBy === "five_year_pct" && "▼"}
              </th>
              <th className="px-5 py-3 w-44"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => {
              const isSelected = selectedSectors.includes(s.sector);
              const displayVal = s[sortBy];
              return (
                <tr
                  key={s.series_id}
                  onClick={() => toggleSector(s.sector)}
                  className={`border-b border-gray-800/50 cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-gray-800/50"
                      : "hover:bg-gray-800/30"
                  }`}
                >
                  <td className="px-5 py-3 font-medium text-white">
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: isSelected
                            ? SECTOR_COLORS[s.sector] || "#6b7280"
                            : "transparent",
                          border: isSelected
                            ? "none"
                            : `2px solid ${SECTOR_COLORS[s.sector] || "#6b7280"}`,
                        }}
                      />
                      {s.sector}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400">
                    {(s.latest_value / 1000).toFixed(1)}M
                  </td>
                  <td className={`px-5 py-3 text-right ${(s.yoy_pct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {s.yoy_pct != null ? `${s.yoy_pct >= 0 ? "+" : ""}${s.yoy_pct}%` : "—"}
                  </td>
                  <td className={`px-5 py-3 text-right ${(s.three_year_pct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {s.three_year_pct != null ? `${s.three_year_pct >= 0 ? "+" : ""}${s.three_year_pct}%` : "—"}
                  </td>
                  <td className={`px-5 py-3 text-right ${(s.five_year_pct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {s.five_year_pct != null ? `${s.five_year_pct >= 0 ? "+" : ""}${s.five_year_pct}%` : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <GrowthBar value={displayVal ?? 0} max={maxGrowth || 1} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Indexed comparison chart */}
      {selectedSectors.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TimeSeriesChart
            title="Employment: Indexed Comparison"
            subtitle="All selected sectors indexed to 100 at start of period"
            data={indexedData}
            labels={selectedSectors}
            colorMap={SECTOR_COLORS}
            type="line"
            height={400}
            explainer="Each sector starts at 100. A value of 110 means that sector grew 10% since the start of the time range. This lets you compare growth rates across sectors that have very different total sizes — you're comparing the shape of the growth, not the raw numbers."
          />
          <TimeSeriesChart
            title="Year-over-Year Growth Rate"
            subtitle="12-month rolling employment growth, percent"
            data={growthFiltered}
            labels={selectedSectors}
            colorMap={SECTOR_COLORS}
            type="line"
            height={400}
            explainer="How fast each sector is growing right now compared to 12 months ago. Positive = adding jobs, negative = shrinking. This is the best way to spot which sectors are accelerating or decelerating — look for lines crossing zero or diverging from each other."
          />
        </div>
      )}
    </div>
  );
}
