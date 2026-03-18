"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { LaborEvent } from "../types/events";

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

export interface DashboardData {
  labor: Record<string, SeriesGroup>;
  analytics: Record<string, AnalyticsGroup>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sectors: any;
  events: LaborEvent[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  market: Record<string, any> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layoffs: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  correlation: Record<string, any> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ai: Record<string, any> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eventStudy: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aiActions: any | null;
}

const DataContext = createContext<DashboardData | null>(null);

export function useData(): DashboardData | null {
  return useContext(DataContext);
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/data/labor.json").then((r) => r.json()),
      fetch("/data/analytics.json").then((r) => r.json()),
      fetch("/data/sectors.json").then((r) => r.json()),
      fetch("/data/events.json").then((r) => r.json()),
      fetch("/data/market.json").then((r) => r.json()).catch(() => null),
      fetch("/data/layoffs.json").then((r) => r.json()).catch(() => null),
      fetch("/data/correlation.json").then((r) => r.json()).catch(() => null),
      fetch("/data/ai.json").then((r) => r.json()).catch(() => null),
      fetch("/data/event_study.json").then((r) => r.json()).catch(() => null),
      fetch("/data/ai_actions.json").then((r) => r.json()).catch(() => null),
    ]).then(([labor, analytics, sectors, events, market, layoffs, correlation, ai, eventStudy, aiActions]) => {
      setData({ labor, analytics, sectors, events, market, layoffs, correlation, ai, eventStudy, aiActions });
    });
  }, []);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="text-gray-400 text-lg">Loading data...</div>
      </div>
    );
  }

  return <DataContext.Provider value={data}>{children}</DataContext.Provider>;
}
