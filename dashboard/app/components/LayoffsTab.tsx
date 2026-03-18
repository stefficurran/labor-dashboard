"use client";

import { useState } from "react";
import KPICard from "./KPICard";
import TimeSeriesChart from "./TimeSeriesChart";
import { IndustryBreakdown, aggregateByRange } from "./IndustryBreakdown";

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

  const { monthly, industry_monthly, top_events } = layoffs;

  // Determine available year range from data
  const firstYear = monthly?.data?.[0]?.date
    ? new Date(monthly.data[0].date).getFullYear()
    : 2023;

  const ranges = [
    { label: "All", year: firstYear },
    ...(firstYear <= 2023 ? [{ label: "2Y", year: 2024 }] : []),
    { label: "1Y", year: 2025 },
  ];

  // KPI calculations
  const totalLayoffs = monthly?.data?.reduce(
    (sum: number, d: { total: number }) => sum + d.total,
    0
  ) ?? 0;

  const peakMonth = monthly?.data?.reduce(
    (max: { total: number; date: string }, d: { total: number; date: string }) =>
      d.total > max.total ? d : max,
    { total: 0, date: "" }
  );

  // Latest month vs prior month
  const latestMonth = monthly?.data?.at(-1);
  const priorMonth = monthly?.data?.at(-2);
  const momChange = latestMonth && priorMonth
    ? Math.round(((latestMonth.total - priorMonth.total) / priorMonth.total) * 100)
    : null;

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          label="Total US Layoffs"
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
          label="Latest Month"
          value={latestMonth?.total?.toLocaleString() ?? "—"}
          subvalue={
            momChange !== null
              ? `${momChange > 0 ? "+" : ""}${momChange}% vs prior month`
              : "—"
          }
          trend={momChange !== null ? (momChange > 0 ? "down" : "up") : undefined}
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
          explainer="Monthly layoffs from US tech companies tracked by Layoffs.fyi. Spikes often cluster around earnings seasons when companies announce restructuring. This is crowdsourced data — actual numbers may be higher."
        />
        <IndustryBreakdown
          title="Layoffs by Industry"
          subtitle="Layoffs.fyi (crowdsourced, US only)"
          data={aggregateByRange(industry_monthly?.data, industry_monthly?.labels, startYear)}
          color="#3b82f6"
        />
      </div>

      {/* WARN Act section */}
      {(layoffs.warn_monthly?.data?.length >= 3 || layoffs.warn_industry?.data?.length >= 3) && (
        <>
          <h2 className="text-lg font-semibold text-white pt-2">
            WARN Act Notices
            <span className="text-sm font-normal text-gray-400 ml-2">
              Government-sourced, all industries
            </span>
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {layoffs.warn_monthly?.data?.length >= 3 && (() => {
              const warnData = layoffs.warn_monthly.data;
              const firstDate = formatDate(warnData[0].date);
              const lastDate = formatDate(warnData[warnData.length - 1].date);
              return (
                <TimeSeriesChart
                  {...layoffs.warn_monthly}
                  type="bar"
                  startYear={startYear}
                  explainer={`Official WARN Act notices filed with state governments. Required for layoffs of 100+ employees. Coverage: ${firstDate} to ${lastDate}.`}
                />
              );
            })()}
            {layoffs.warn_industry?.labels?.length > 0 && (
              <IndustryBreakdown
                title="WARN Notices by Industry"
                subtitle="Government-sourced, all industries"
                data={aggregateByRange(layoffs.warn_industry?.data, layoffs.warn_industry?.labels, startYear)}
                color="#f59e0b"
              />
            )}
          </div>
        </>
      )}

      {/* Top layoff events — individual rounds with dates */}
      {top_events?.length > 0 && (
        <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h3 className="text-lg font-semibold text-white">Largest Layoff Events (US)</h3>
            <p className="text-sm text-gray-400">
              Individual layoff rounds ranked by size — Layoffs.fyi
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="text-left px-5 py-3 font-medium">#</th>
                  <th className="text-left px-5 py-3 font-medium">Company</th>
                  <th className="text-left px-5 py-3 font-medium">Date</th>
                  <th className="text-left px-5 py-3 font-medium">Industry</th>
                  <th className="text-right px-5 py-3 font-medium">Laid Off</th>
                  <th className="text-right px-5 py-3 font-medium">% of Co.</th>
                </tr>
              </thead>
              <tbody>
                {top_events.map(
                  (
                    row: {
                      company: string;
                      date: string;
                      laid_off: number;
                      industry: string | null;
                      percentage: number | null;
                    },
                    i: number
                  ) => (
                    <tr
                      key={`${row.company}-${row.date}`}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="px-5 py-3 text-gray-500">{i + 1}</td>
                      <td className="px-5 py-3 font-medium text-white">
                        {row.company}
                      </td>
                      <td className="px-5 py-3 text-gray-400">
                        {formatDate(row.date)}
                      </td>
                      <td className="px-5 py-3 text-gray-400">
                        {row.industry ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-300">
                        {row.laid_off.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-400">
                        {row.percentage ? `${row.percentage}%` : "—"}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
