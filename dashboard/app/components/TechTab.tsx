"use client";

import { useState, useMemo } from "react";
import TimeSeriesChart from "./TimeSeriesChart";
import KPICard from "./KPICard";
import { IndustryBreakdown, aggregateByRange } from "./IndustryBreakdown";

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
  layoffs: any | null;
  correlation: Record<string, any> | null;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

export default function TechTab({ labor, analytics, layoffs, correlation }: TechTabProps) {
  const [timeRange, setTimeRange] = useState<number>(2015);
  const [layoffsRange, setLayoffsRange] = useState<number>(2023);

  const ranges = [
    { label: "All", year: 2000 },
    { label: "10Y", year: 2016 },
    { label: "5Y", year: 2021 },
    { label: "3Y", year: 2023 },
    { label: "1Y", year: 2025 },
  ];

  // Net Flow Comparison: merge info and total net flow
  const netFlowComparison = useMemo(() => {
    const infoData = analytics?.info_net_flow?.data;
    const totalData = analytics?.total_net_flow?.data;
    if (!infoData || !totalData) return null;
    const totalMap = new Map(totalData.map((d: any) => [d.date, d.net_flow_pct]));
    return infoData
      .filter((d: any) => totalMap.has(d.date))
      .map((d: any) => ({
        date: d.date,
        Information: d.net_flow_pct,
        "All Industries": totalMap.get(d.date),
      }));
  }, [analytics]);

  // Layoffs data calculations
  const monthly = layoffs?.monthly;
  const industryMonthly = layoffs?.industry_monthly;
  const topEvents = layoffs?.top_events;

  const layoffsFirstYear = monthly?.data?.[0]?.date
    ? new Date(monthly.data[0].date).getFullYear()
    : 2023;

  const layoffsRanges = [
    { label: "All", year: layoffsFirstYear },
    ...(layoffsFirstYear <= 2023 ? [{ label: "2Y", year: 2024 }] : []),
    { label: "1Y", year: 2025 },
  ];

  const totalLayoffs = monthly?.data?.reduce(
    (sum: number, d: { total: number }) => sum + d.total,
    0
  ) ?? 0;

  const peakMonth = monthly?.data?.reduce(
    (max: { total: number; date: string }, d: { total: number; date: string }) =>
      d.total > max.total ? d : max,
    { total: 0, date: "" }
  );

  const latestMonth = monthly?.data?.at(-1);
  const priorMonth = monthly?.data?.at(-2);
  const momChange = latestMonth && priorMonth
    ? Math.round(((latestMonth.total - priorMonth.total) / priorMonth.total) * 100)
    : null;

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

      {/* ── EMPLOYMENT OVERVIEW ── */}
      <div>
        <h2 className="text-lg font-semibold text-white">
          Employment Overview
          <span className="text-sm font-normal text-gray-400 ml-2">
            BLS employment & unemployment data
          </span>
        </h2>
      </div>

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

        {analytics?.info_employment_mom && (
          <TimeSeriesChart
            title={analytics.info_employment_mom.title}
            subtitle={analytics.info_employment_mom.subtitle}
            data={analytics.info_employment_mom.data}
            labels={analytics.info_employment_mom.labels || ["mom_change"]}
            type="bar"
            startYear={timeRange}
            explainer="How many jobs the Information sector gained or lost compared to the prior month. Positive bars mean the sector added jobs; negative bars mean it shrank."
          />
        )}

        <TimeSeriesChart
          title={analytics.info_employment_yoy.title}
          subtitle={analytics.info_employment_yoy.subtitle}
          data={analytics.info_employment_yoy.data}
          labels={["yoy_pct"]}
          type="area"
          startYear={timeRange}
          explainer="This compares tech employment now to exactly 12 months ago. Positive means the sector added jobs over the past year. Negative means it shrank. This smooths out month-to-month noise and shows the real trend — is tech growing or contracting?"
        />
      </div>

      {/* ── JOLTS BREAKDOWN ── */}
      <div className="pt-4">
        <h2 className="text-lg font-semibold text-white">
          JOLTS Breakdown
          <span className="text-sm font-normal text-gray-400 ml-2">
            Job Openings & Labor Turnover Survey
          </span>
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {analytics?.info_net_flow && (
          <TimeSeriesChart
            title={analytics.info_net_flow.title}
            subtitle={analytics.info_net_flow.subtitle}
            data={analytics.info_net_flow.data}
            labels={["net_flow_pct"]}
            type="bar"
            startYear={timeRange}
            explainer="The net result of all worker movement: hires minus quits minus layoffs. Positive means more people are entering the sector than leaving. Negative means the sector is contracting even before counting job eliminations."
          />
        )}

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
          title={analytics.info_quits_rate.title}
          subtitle={analytics.info_quits_rate.subtitle}
          data={analytics.info_quits_rate.data}
          labels={["quits_pct"]}
          type="area"
          startYear={timeRange}
          explainer="The percentage of tech workers who voluntarily quit their jobs each month. High quit rates are actually a good sign — it means workers are confident enough to leave for better opportunities. When quits drop, people are 'staying put' because they're worried about finding something new. It's a worker-confidence barometer."
        />
        <TimeSeriesChart
          {...labor.jolts_probus}
          type="line"
          startYear={timeRange}
          explainer="Same JOLTS data but for the broader 'Professional and Business Services' sector. This includes IT consulting, accounting, legal, and management firms. It's a wider lens on white-collar hiring trends beyond just pure tech companies."
        />
      </div>

      {/* ── TECH vs ECONOMY ── */}
      <div className="pt-4">
        <h2 className="text-lg font-semibold text-white">
          Tech vs Economy
          <span className="text-sm font-normal text-gray-400 ml-2">
            Both lines start at 100 — when they diverge, one sector is outpacing the other
          </span>
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {netFlowComparison && (
          <TimeSeriesChart
            title="Net Employment Flow: Info vs All Industries"
            subtitle="Net flow as % of sector employment — normalized for sector size"
            data={netFlowComparison}
            labels={["Information", "All Industries"]}
            type="line"
            startYear={timeRange}
            explainer="Compares net worker flow in tech vs the overall economy. When tech is below the national line, the sector is losing workers at a faster rate relative to its size."
          />
        )}

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
        {analytics?.jolts_layoffs_comparison && (
          <TimeSeriesChart
            title={analytics.jolts_layoffs_comparison.title}
            subtitle={analytics.jolts_layoffs_comparison.subtitle}
            data={analytics.jolts_layoffs_comparison.data}
            labels={analytics.jolts_layoffs_comparison.labels || ["Information", "All Industries"]}
            type="line"
            startYear={timeRange}
            explainer="Are tech layoffs rising faster or slower than the national average? When the Information line is above All Industries, tech is seeing relatively more layoffs."
          />
        )}
        {correlation?.layoffs_vs_jolts && (
          <TimeSeriesChart
            {...correlation.layoffs_vs_jolts}
            type="line"
            startYear={timeRange}
            explainer="How do crowdsourced layoff reports (Layoffs.fyi) compare to official government data (JOLTS)? Divergence may indicate that media-reported tech layoffs don't fully reflect the broader Information sector measured by BLS."
          />
        )}
      </div>

      {/* ── LAYOFFS DETAIL ── */}
      {layoffs && (
        <>
          <div className="pt-4">
            <h2 className="text-lg font-semibold text-white">
              Layoffs Detail
              <span className="text-sm font-normal text-gray-400 ml-2">
                Crowdsourced & government data
              </span>
            </h2>
          </div>

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

          {/* Layoffs time range selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400 mr-2">Time range:</span>
            {layoffsRanges.map((r) => (
              <button
                key={r.year}
                onClick={() => setLayoffsRange(r.year)}
                className={`px-3 py-1 rounded-md text-sm transition-colors ${
                  layoffsRange === r.year
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
            {monthly && (
              <TimeSeriesChart
                {...monthly}
                type="bar"
                startYear={layoffsRange}
                explainer="Monthly layoffs from US tech companies tracked by Layoffs.fyi. Spikes often cluster around earnings seasons when companies announce restructuring. This is crowdsourced data — actual numbers may be higher."
              />
            )}
            {industryMonthly && (
              <IndustryBreakdown
                title="Layoffs by Industry"
                subtitle="Layoffs.fyi (crowdsourced, US only)"
                data={aggregateByRange(industryMonthly.data, industryMonthly.labels, layoffsRange)}
                color="#3b82f6"
              />
            )}
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
                      startYear={layoffsRange}
                      explainer={`Official WARN Act notices filed with state governments. Required for layoffs of 100+ employees. Coverage: ${firstDate} to ${lastDate}.`}
                    />
                  );
                })()}
                {layoffs.warn_industry?.labels?.length > 0 && (
                  <IndustryBreakdown
                    title="WARN Notices by Industry"
                    subtitle="Government-sourced, all industries"
                    data={aggregateByRange(layoffs.warn_industry?.data, layoffs.warn_industry?.labels, layoffsRange)}
                    color="#f59e0b"
                  />
                )}
              </div>
            </>
          )}

          {/* Recent layoff events */}
          {layoffs?.recent_events?.length > 0 && (
            <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800">
                <h3 className="text-lg font-semibold text-white">Recent Layoffs (US)</h3>
                <p className="text-sm text-gray-400">
                  Most recent layoff rounds — Layoffs.fyi
                  {layoffs.recent_events?.[0]?.date && (
                    <span className="ml-1">(data through {formatDate(layoffs.recent_events[0].date)})</span>
                  )}
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
                    {layoffs.recent_events.map(
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
                          key={`recent-${row.company}-${row.date}`}
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

          {/* Top layoff events */}
          {topEvents?.length > 0 && (
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
                    {topEvents.map(
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
        </>
      )}
    </div>
  );
}
