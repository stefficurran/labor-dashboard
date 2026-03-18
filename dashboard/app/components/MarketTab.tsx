"use client";

import { useState } from "react";
import TimeSeriesChart from "./TimeSeriesChart";
import KPICard from "./KPICard";

interface SeriesGroup {
  title: string;
  subtitle: string;
  labels: string[];
  data: Record<string, unknown>[];
}

interface MarketTabProps {
  market: Record<string, SeriesGroup> | null;
}

export default function MarketTab({ market }: MarketTabProps) {
  const [timeRange, setTimeRange] = useState<number>(2016);

  if (!market) {
    return (
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-8 text-center">
        <p className="text-gray-400">Stock market data is not available yet. Run the market export pipeline to generate market.json.</p>
      </div>
    );
  }

  const ranges = [
    { label: "All", year: 2016 },
    { label: "5Y", year: 2021 },
    { label: "3Y", year: 2023 },
    { label: "1Y", year: 2025 },
  ];

  // Compute KPIs from stock_indices data
  const indicesData = market.stock_indices?.data ?? [];
  const latest = indicesData.at(-1);
  const sp500Latest = latest?.["S&P 500"] as number | undefined;
  const nasdaqLatest = latest?.["NASDAQ"] as number | undefined;

  // Find first data point of current year for YTD calc
  const currentYear = new Date().getFullYear();
  const ytdBaseline = indicesData.find(
    (d) => new Date(d.date as string).getFullYear() === currentYear
  );
  const sp500Ytd = sp500Latest && ytdBaseline
    ? ((sp500Latest - (ytdBaseline["S&P 500"] as number)) / (ytdBaseline["S&P 500"] as number)) * 100
    : undefined;

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          label="S&P 500"
          value={sp500Latest != null ? sp500Latest.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"}
          subvalue={latest ? `as of ${new Date(latest.date as string).toLocaleDateString("en-US", { month: "short", year: "numeric" })}` : ""}
        />
        <KPICard
          label="NASDAQ"
          value={nasdaqLatest != null ? nasdaqLatest.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"}
          subvalue={latest ? `as of ${new Date(latest.date as string).toLocaleDateString("en-US", { month: "short", year: "numeric" })}` : ""}
        />
        <KPICard
          label="S&P 500 YTD"
          value={sp500Ytd != null ? `${sp500Ytd >= 0 ? "+" : ""}${sp500Ytd.toFixed(1)}%` : "—"}
          subvalue={`${currentYear} year-to-date`}
          trend={sp500Ytd != null ? (sp500Ytd >= 0 ? "up" : "down") : undefined}
        />
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

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TimeSeriesChart
          {...market.stock_indices}
          type="line"
          startYear={timeRange}
          explainer="Monthly closing prices for the S&P 500 (broad market) and NASDAQ (tech-heavy). When the NASDAQ drops faster than the S&P, it signals tech-specific trouble rather than a general downturn."
        />
        <TimeSeriesChart
          {...market.stock_indexed}
          type="line"
          startYear={timeRange}
          explainer="Both indices start at 100. When the lines diverge, one market is outperforming the other. The NASDAQ typically runs hotter than the S&P 500 in tech booms and falls harder in busts."
        />
      </div>

      {/* Full-width overlay chart */}
      <TimeSeriesChart
        {...market.market_employment_overlay}
        type="line"
        startYear={timeRange}
        explainer="Both indexed to 100. Stock prices tend to lead employment by 1-2 quarters — when the market drops, hiring freezes follow. When the lines diverge significantly, it often signals a coming correction in the lagging metric."
      />
    </div>
  );
}
