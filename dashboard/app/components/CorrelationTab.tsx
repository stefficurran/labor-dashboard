"use client";

import { useState } from "react";
import TimeSeriesChart from "./TimeSeriesChart";

interface CorrelationTabProps {
  correlation: Record<string, any> | null;
}

export default function CorrelationTab({ correlation }: CorrelationTabProps) {
  const [timeRange, setTimeRange] = useState<number>(2015);

  const ranges = [
    { label: "All", year: 2000 },
    { label: "10Y", year: 2016 },
    { label: "5Y", year: 2021 },
    { label: "3Y", year: 2023 },
    { label: "1Y", year: 2025 },
  ];

  if (!correlation) {
    return (
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-8 text-center">
        <p className="text-gray-400">Correlation data is not available yet.</p>
      </div>
    );
  }

  const marketVsEmployment = correlation.market_vs_employment;
  const layoffsVsJolts = correlation.layoffs_vs_jolts;
  const nasdaqVsOpenings = correlation.nasdaq_vs_openings;

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div>
        <h2 className="text-xl font-semibold text-gray-200 mb-1">Cross-Source Correlation</h2>
        <p className="text-sm text-gray-400">
          These charts overlay data from different sources to reveal relationships. When lines move
          together, there&apos;s correlation. When they diverge, something interesting is happening.
        </p>
      </div>

      {/* Time range selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400 mr-2">Time range:</span>
        {ranges.map((r) => (
          <button
            key={r.year}
            onClick={() => setTimeRange(r.year)}
            className={`px-3 py-1 rounded-md text-sm transition-colors ${
              timeRange === r.year
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Charts — full-width stacked */}
      <div className="space-y-6">
        {marketVsEmployment && (
          <TimeSeriesChart
            title={marketVsEmployment.title}
            subtitle={marketVsEmployment.subtitle}
            data={marketVsEmployment.data}
            labels={marketVsEmployment.labels}
            type="line"
            startYear={timeRange}
            explainer="Both series are indexed to 100 at the start of the visible range. The stock market tends to lead employment changes by 1-2 quarters. A sustained divergence — where stocks drop but employment holds steady — often resolves with employment catching down."
          />
        )}

        {layoffsVsJolts && (
          <TimeSeriesChart
            title={layoffsVsJolts.title}
            subtitle={layoffsVsJolts.subtitle}
            data={layoffsVsJolts.data}
            labels={layoffsVsJolts.labels}
            type="line"
            startYear={timeRange}
            explainer="Two different lenses on the same story. JOLTS is the official government survey of Information sector layoffs (in thousands). Layoffs.fyi is a crowdsourced tracker of announced tech layoffs. They measure different things — JOLTS captures all involuntary separations in the sector, while Layoffs.fyi tracks headline-making announcements."
          />
        )}

        {nasdaqVsOpenings && (
          <TimeSeriesChart
            title={nasdaqVsOpenings.title}
            subtitle={nasdaqVsOpenings.subtitle}
            data={nasdaqVsOpenings.data}
            labels={nasdaqVsOpenings.labels}
            type="line"
            startYear={timeRange}
            explainer="Both indexed to 100. The NASDAQ (tech-heavy stock index) and Information sector job openings tend to move together — when companies are optimistic enough to drive stock prices up, they're also optimistic enough to post new jobs. Divergences can signal that one metric is about to catch up to the other."
          />
        )}
      </div>
    </div>
  );
}
