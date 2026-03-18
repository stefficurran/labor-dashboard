"use client";

import { useState } from "react";
import TimeSeriesChart from "./TimeSeriesChart";

interface SeriesGroup {
  title: string;
  subtitle: string;
  labels: string[];
  data: Record<string, unknown>[];
}

interface AnalyticsGroup {
  title: string;
  subtitle: string;
  data: Record<string, unknown>[];
  labels?: string[];
}

interface TechTabProps {
  labor: Record<string, SeriesGroup>;
  analytics: Record<string, AnalyticsGroup>;
}

export default function TechTab({ labor, analytics }: TechTabProps) {
  const [timeRange, setTimeRange] = useState<number>(2015);

  const ranges = [
    { label: "All", year: 2000 },
    { label: "10Y", year: 2016 },
    { label: "5Y", year: 2021 },
    { label: "3Y", year: 2023 },
    { label: "1Y", year: 2025 },
  ];

  return (
    <div className="space-y-6">
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
          {...labor.tech_employment}
          type="area"
          startYear={timeRange}
          explainer="How many people work in tech. The 'Information' sector covers software, data, telecom, and media. 'Professional & Technical Services' includes IT consulting, computer systems design, and engineering firms. When these lines go up, tech is hiring. When they go down, it's shrinking."
        />
        <TimeSeriesChart
          {...labor.unemployment}
          type="line"
          startYear={timeRange}
          explainer="The percentage of tech workers who are actively looking for a job but can't find one, compared to the national average. When the blue line (tech) is above the orange line (national), tech workers are having a harder time than the rest of the economy."
        />
        <TimeSeriesChart
          {...labor.jolts_info}
          type="line"
          startYear={timeRange}
          explainer="JOLTS = Job Openings and Labor Turnover Survey. It's a monthly survey by the government that counts how many positions companies are trying to fill (openings), how many people they actually hired (hires), how many people quit voluntarily (quits), and how many were let go (layoffs). This chart shows all of those for the tech/information sector."
        />
        <TimeSeriesChart
          title={analytics.info_openings_hires_ratio.title}
          subtitle={analytics.info_openings_hires_ratio.subtitle}
          data={analytics.info_openings_hires_ratio.data}
          labels={["ratio"]}
          type="area"
          startYear={timeRange}
          explainer="This divides job openings by actual hires. A ratio of 2.0 means there are 2 open positions for every 1 person hired — companies are struggling to find people. A ratio near 1.0 means supply and demand are balanced. Below 1.0 is rare and means more people are being hired than there are listed openings."
        />
        <TimeSeriesChart
          title={analytics.info_employment_yoy.title}
          subtitle={analytics.info_employment_yoy.subtitle}
          data={analytics.info_employment_yoy.data}
          labels={["yoy_pct"]}
          type="area"
          startYear={timeRange}
          explainer="This compares tech employment now to exactly 12 months ago. Positive means the sector added jobs over the past year. Negative means it shrank. This smooths out month-to-month noise and shows the real trend — is tech growing or contracting?"
        />
        <TimeSeriesChart
          {...labor.jolts_probus}
          type="line"
          startYear={timeRange}
          explainer="Same JOLTS data but for the broader 'Professional and Business Services' sector. This includes IT consulting, accounting, legal, and management firms. It's a wider lens on white-collar hiring trends beyond just pure tech companies."
        />
        <TimeSeriesChart
          title={analytics.info_quits_rate.title}
          subtitle={analytics.info_quits_rate.subtitle}
          data={analytics.info_quits_rate.data}
          labels={["quits_pct"]}
          type="area"
          startYear={timeRange}
          explainer="The percentage of tech workers who voluntarily quit their jobs each month. High quit rates are actually a good sign — it means workers are confident enough to leave for better opportunities. When quits drop, people are 'staying put' because they're worried about finding something new. It's a worker-confidence barometer."
        />

        {/* Sector vs All comparison charts */}
        <div className="lg:col-span-2 mt-2">
          <h2 className="text-xl font-semibold text-gray-200 mb-1">Info Sector vs All Industries</h2>
          <p className="text-sm text-gray-400 mb-4">Both lines start at 100 — when they diverge, one sector is outpacing the other</p>
        </div>
        <TimeSeriesChart
          title={analytics.jolts_openings_comparison.title}
          subtitle={analytics.jolts_openings_comparison.subtitle}
          data={analytics.jolts_openings_comparison.data}
          labels={analytics.jolts_openings_comparison.labels!}
          type="line"
          startYear={timeRange}
          explainer="Both lines start at 100. If the blue line (tech) drops to 50 while the orange line (all industries) is at 80, that means tech job openings fell twice as much as the overall economy. This lets you compare trends even though the raw numbers are very different in scale."
        />
        <TimeSeriesChart
          title={analytics.jolts_hires_comparison.title}
          subtitle={analytics.jolts_hires_comparison.subtitle}
          data={analytics.jolts_hires_comparison.data}
          labels={analytics.jolts_hires_comparison.labels!}
          type="line"
          startYear={timeRange}
          explainer="Same indexed comparison but for actual hires. If the tech line drops faster than the all-industries line, it means tech hiring is slowing down more than the broader economy — a sign of sector-specific trouble, not just a general recession."
        />
        <TimeSeriesChart
          title={analytics.jolts_quits_comparison.title}
          subtitle={analytics.jolts_quits_comparison.subtitle}
          data={analytics.jolts_quits_comparison.data}
          labels={analytics.jolts_quits_comparison.labels!}
          type="line"
          startYear={timeRange}
          explainer="Indexed quits comparison. If tech workers are quitting less than the national trend, it suggests tech workers specifically feel less confident about their job prospects — even if the rest of the economy is fine."
        />
      </div>
    </div>
  );
}
