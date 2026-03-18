"use client";

import { useState } from "react";
import KPICard from "./KPICard";
import TimeSeriesChart from "./TimeSeriesChart";

interface LayoffsTabProps {
  layoffs: any | null;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

export default function LayoffsTab({ layoffs }: LayoffsTabProps) {
  const [startYear, setStartYear] = useState(2023);

  if (!layoffs) {
    return (
      <div className="text-center text-gray-400 py-12">
        Layoffs data is not available.
      </div>
    );
  }

  const { monthly, cumulative, by_industry, top_companies } = layoffs;

  // Determine available year range from data
  const firstYear = monthly?.data?.[0]?.date
    ? new Date(monthly.data[0].date).getFullYear()
    : 2023;

  const ranges = [
    { label: "All", year: firstYear },
    ...(firstYear <= 2023 ? [{ label: "2Y", year: 2024 }] : []),
    { label: "1Y", year: 2025 },
  ];

  // KPI calculations (always over full range)
  const totalLayoffs = cumulative?.data?.at(-1)?.cumulative ?? 0;

  const peakMonth = monthly?.data?.reduce(
    (max: { total: number; date: string }, d: { total: number; date: string }) =>
      d.total > max.total ? d : max,
    { total: 0, date: "" }
  );

  const companiesAffected = top_companies?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          label="Total Layoffs"
          value={totalLayoffs.toLocaleString()}
          subvalue={`Since ${formatDate(monthly?.data?.[0]?.date ?? "")}`}
        />
        <KPICard
          label="Peak Month"
          value={peakMonth?.total?.toLocaleString() ?? "—"}
          subvalue={peakMonth?.date ? formatDate(peakMonth.date) : "—"}
          trend="down"
        />
        <KPICard
          label="Companies Tracked"
          value={companiesAffected.toLocaleString()}
          subvalue="Top companies by total layoffs"
        />
      </div>

      {/* Time range selector */}
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

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TimeSeriesChart
          {...monthly}
          type="bar"
          startYear={startYear}
          explainer="The number of people laid off each month from tech companies tracked by Layoffs.fyi. Spikes often cluster around earnings seasons when companies announce restructuring. This is crowdsourced data — actual numbers may be higher."
        />
        <TimeSeriesChart
          {...cumulative}
          type="area"
          startYear={startYear}
          explainer="Running total of all tracked tech layoffs. The steeper the curve, the faster layoffs are accumulating. Flat periods mean the pace has slowed."
        />
      </div>

      {/* WARN Act data — only show if it has meaningful data (3+ months) */}
      {layoffs.warn_monthly?.data?.length >= 3 && (
        <TimeSeriesChart
          {...layoffs.warn_monthly}
          type="bar"
          startYear={startYear}
          explainer="Official WARN Act notices filed with state governments. These are legally required for layoffs of 100+ employees. Unlike Layoffs.fyi (crowdsourced tech announcements), WARN covers all industries and is government-sourced. Updated daily."
        />
      )}

      {/* Top Industries table */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">Top Industries</h3>
          <p className="text-sm text-gray-400">Industries with the most tracked layoffs</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="text-left px-5 py-3 font-medium">#</th>
                <th className="text-left px-5 py-3 font-medium">Industry</th>
                <th className="text-right px-5 py-3 font-medium">Total Laid Off</th>
                <th className="text-right px-5 py-3 font-medium">Companies</th>
              </tr>
            </thead>
            <tbody>
              {by_industry?.slice(0, 10).map(
                (row: { industry: string; total: number; companies: number }, i: number) => (
                  <tr
                    key={row.industry}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-5 py-3 text-gray-500">{i + 1}</td>
                    <td className="px-5 py-3 font-medium text-white">{row.industry}</td>
                    <td className="px-5 py-3 text-right text-gray-300">
                      {row.total.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-400">{row.companies}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Companies table */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">Top Companies</h3>
          <p className="text-sm text-gray-400">Companies with the largest total layoffs</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="text-left px-5 py-3 font-medium">#</th>
                <th className="text-left px-5 py-3 font-medium">Company</th>
                <th className="text-right px-5 py-3 font-medium">Total Laid Off</th>
                <th className="text-right px-5 py-3 font-medium">Rounds</th>
              </tr>
            </thead>
            <tbody>
              {top_companies?.slice(0, 15).map(
                (row: { company: string; total: number; rounds: number }, i: number) => (
                  <tr
                    key={row.company}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-5 py-3 text-gray-500">{i + 1}</td>
                    <td className="px-5 py-3 font-medium text-white">{row.company}</td>
                    <td className="px-5 py-3 text-right text-gray-300">
                      {row.total.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-400">{row.rounds}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
