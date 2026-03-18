"use client";

import { useMemo } from "react";
import { useData } from "./components/DataProvider";
import BriefingHeader from "./components/BriefingHeader";
import KPICard from "./components/KPICard";
import Callouts from "./components/Callouts";
import SpotlightChart from "./components/SpotlightChart";
import SectorMovers from "./components/SectorMovers";
import SuggestedActions from "./components/SuggestedActions";
import DeepDiveNav from "./components/DeepDiveNav";
import {
  detectCallouts,
  generateActions,
  getSectorMovers,
  getDataFreshness,
} from "./components/briefing-utils";

export default function Home() {
  const data = useData();

  const callouts = useMemo(
    () => (data ? detectCallouts({ ...data }) : []),
    [data]
  );
  const actions = useMemo(
    () => (data ? generateActions({ ...data }) : []),
    [data]
  );
  const movers = useMemo(
    () => (data ? getSectorMovers(data.sectors) : { gainers: [], decliners: [] }),
    [data]
  );

  if (!data) return null; // DataProvider shows loading state

  const { labor, analytics } = data;

  // Compute latest stats for KPIs
  const latestInfo = labor.tech_employment.data.at(-1);
  const prevYearInfo = labor.tech_employment.data.at(-13);
  const latestOpenings = labor.jolts_info.data.at(-1);
  const latestUnemployment = labor.unemployment.data.at(-1);

  const infoEmpNow = latestInfo?.["Information"] as number;
  const infoEmpPrev = prevYearInfo?.["Information"] as number;
  const yoyChange = infoEmpPrev
    ? (((infoEmpNow - infoEmpPrev) / infoEmpPrev) * 100).toFixed(1)
    : "—";

  const dataDate = getDataFreshness(labor);

  // Format "as of" dates for KPI subvalues
  const fmtAsOf = (dateStr?: string) => {
    if (!dateStr) return "";
    const [y, m] = dateStr.split("-");
    const month = new Date(Number(y), Number(m) - 1).toLocaleDateString("en-US", { month: "short" });
    return `${month} ${y}`;
  };
  const empAsOf = fmtAsOf(latestInfo?.date as string);
  const joltsAsOf = fmtAsOf(latestOpenings?.date as string);
  const unempAsOf = fmtAsOf(latestUnemployment?.date as string);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 px-4 sm:px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <BriefingHeader dataDate={dataDate} />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* KPI Cards — Labor */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Labor</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <KPICard
              label="Employment"
              value={`${infoEmpNow?.toFixed(0)}K`}
              subvalue={`${Number(yoyChange) >= 0 ? "+" : ""}${yoyChange}% YoY · ${empAsOf}`}
              trend={Number(yoyChange) >= 0 ? "up" : "down"}
            />
            <KPICard
              label="Unemployment"
              value={`${(latestUnemployment?.["Information Industry"] as number)?.toFixed(1)}%`}
              subvalue={`Nat'l: ${(latestUnemployment?.["National"] as number)?.toFixed(1)}% · ${unempAsOf}`}
            />
            <KPICard
              label="Job Openings"
              value={`${(latestOpenings?.["Job Openings"] as number)?.toFixed(0)}K`}
              subvalue={`As of ${joltsAsOf}`}
            />
            <KPICard
              label="Hires"
              value={`${(latestOpenings?.["Hires"] as number)?.toFixed(0)}K`}
              subvalue={`As of ${joltsAsOf}`}
            />
          </div>
        </div>

        {/* KPI Cards — Markets */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Markets</p>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <KPICard
              label="S&P 500"
            value={data.market?.stock_indices?.data?.length
              ? `${(data.market.stock_indices.data.at(-1)?.["S&P 500"] as number)?.toFixed(0)}`
              : "—"}
            subvalue={(() => {
              const d = data.market?.stock_indices?.data;
              if (!d || d.length < 2) return "—";
              const latest = d.at(-1)?.["S&P 500"] as number;
              const prev = d.at(-2)?.["S&P 500"] as number;
              if (!latest || !prev) return "—";
              const pct = ((latest - prev) / prev * 100).toFixed(1);
              return `${Number(pct) >= 0 ? "+" : ""}${pct}% MoM`;
            })()}
            trend={(() => {
              const d = data.market?.stock_indices?.data;
              if (!d || d.length < 2) return undefined;
              const latest = d.at(-1)?.["S&P 500"] as number;
              const prev = d.at(-2)?.["S&P 500"] as number;
              if (!latest || !prev) return undefined;
              return latest >= prev ? "up" : "down";
            })()}
          />
          <KPICard
            label="Tech Layoffs"
            value={data.layoffs?.monthly?.data?.length
              ? `${((data.layoffs.monthly.data.at(-1)?.total as number) / 1000).toFixed(1)}K`
              : "—"}
            subvalue={(() => {
              const d = data.layoffs?.monthly?.data;
              if (!d || d.length < 2) return "Latest month";
              const latest = d.at(-1)?.total as number;
              const prev = d.at(-2)?.total as number;
              if (!latest || !prev) return "Latest month";
              const pct = ((latest - prev) / prev * 100).toFixed(0);
              return `${Number(pct) >= 0 ? "+" : ""}${pct}% vs prior month`;
            })()}
            trend={(() => {
              const d = data.layoffs?.monthly?.data;
              if (!d || d.length < 2) return undefined;
              const latest = d.at(-1)?.total as number;
              const prev = d.at(-2)?.total as number;
              if (!latest || !prev) return undefined;
              return latest <= prev ? "up" : "down"; // fewer layoffs = good = up
            })()}
          />
          </div>
        </div>

        <Callouts callouts={callouts} />

        {callouts.length > 0 && callouts[0].metric && (
          <SpotlightChart
            topCallout={callouts[0]}
            labor={labor}
            analytics={analytics}
          />
        )}

        <SectorMovers gainers={movers.gainers} decliners={movers.decliners} />

        <SuggestedActions actions={actions} aiActions={data.aiActions} />

        <DeepDiveNav />

        <footer className="border-t border-gray-800 pt-4 pb-8 text-sm text-gray-500">
          Data from FRED (Federal Reserve Economic Data) / Bureau of Labor Statistics.
          Updated through {(labor.tech_employment.data.at(-1)?.date as string)?.slice(0, 7)}.
        </footer>
      </main>
    </div>
  );
}
