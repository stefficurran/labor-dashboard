"use client";

import TimeSeriesChart from "./TimeSeriesChart";
import { Callout } from "./briefing-utils";

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

interface SpotlightChartProps {
  topCallout: Callout;
  labor: Record<string, SeriesGroup>;
  analytics: Record<string, AnalyticsGroup>;
}

// Map callout metrics to chart config
function getChartConfig(
  metric: string,
  labor: Record<string, SeriesGroup>,
  analytics: Record<string, AnalyticsGroup>
): {
  title: string;
  subtitle: string;
  data: Record<string, unknown>[];
  labels: string[];
  type: "line" | "area" | "bar";
} | null {
  switch (metric) {
    case "info_employment_yoy":
      return {
        title: analytics.info_employment_yoy.title,
        subtitle: analytics.info_employment_yoy.subtitle,
        data: analytics.info_employment_yoy.data,
        labels: ["yoy_pct"],
        type: "area",
      };
    case "tech_employment":
      return {
        ...labor.tech_employment,
        type: "area",
      };
    case "info_openings_hires_ratio":
      return {
        title: analytics.info_openings_hires_ratio.title,
        subtitle: analytics.info_openings_hires_ratio.subtitle,
        data: analytics.info_openings_hires_ratio.data,
        labels: ["ratio"],
        type: "area",
      };
    case "info_quits_rate":
      return {
        title: analytics.info_quits_rate.title,
        subtitle: analytics.info_quits_rate.subtitle,
        data: analytics.info_quits_rate.data,
        labels: ["quits_pct"],
        type: "area",
      };
    case "unemployment":
      return {
        ...labor.unemployment,
        type: "line",
      };
    case "jolts_info":
      return {
        ...labor.jolts_info,
        type: "line",
      };
    case "sector_rankings":
      // Fall through to employment YoY as a reasonable default for sector callouts
      return {
        title: analytics.info_employment_yoy.title,
        subtitle: analytics.info_employment_yoy.subtitle,
        data: analytics.info_employment_yoy.data,
        labels: ["yoy_pct"],
        type: "area",
      };
    default:
      return null;
  }
}

export default function SpotlightChart({ topCallout, labor, analytics }: SpotlightChartProps) {
  const metric = topCallout.metric;
  if (!metric) return null;

  const config = getChartConfig(metric, labor, analytics);
  if (!config) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-200 mb-1">Spotlight</h2>
      <p className="text-sm text-gray-400 mb-3">{topCallout.headline}</p>
      <TimeSeriesChart
        {...config}
        startYear={2021}
        height={240}
        compact
      />
    </div>
  );
}
