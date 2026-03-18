"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import TimeSeriesChart from "./TimeSeriesChart";
import KPICard from "./KPICard";

interface AITabProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ai: Record<string, any> | null;
}

function interpolateColor(pct: number, min: number, max: number): string {
  const t = Math.max(0, Math.min(1, (pct - min) / (max - min)));
  // gray-500 (#6b7280) to cyan-400 (#22d3ee)
  const r = Math.round(107 + (34 - 107) * t);
  const g = Math.round(114 + (211 - 114) * t);
  const b = Math.round(128 + (238 - 128) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function AITab({ ai }: AITabProps) {
  const [timeRange, setTimeRange] = useState<number>(2019);

  if (!ai) return null;

  const ranges = [
    { label: "All", year: 2019 },
    { label: "3Y", year: 2023 },
    { label: "1Y", year: 2025 },
  ];

  // KPI values
  const aiJobData = ai.ai_job_share?.data ?? [];
  const latestAIShare = aiJobData.length > 0 ? aiJobData[aiJobData.length - 1]["AI Share"] : null;

  const swDevData = ai.software_dev_postings?.data ?? [];
  const latestSwDev = swDevData.length > 0 ? swDevData[swDevData.length - 1]["Software Dev"] : null;

  const semiData = ai.semiconductor_production?.data ?? [];
  const latestSemi = semiData.length > 0 ? semiData[semiData.length - 1]["index"] : null;

  const sectorAdoption: { sector: string; naics: string; adoption_pct: number }[] =
    ai.sector_ai_adoption ?? [];

  // Adoption range for color interpolation
  const adoptionValues = sectorAdoption.map((s) => s.adoption_pct);
  const minAdoption = Math.min(...adoptionValues);
  const maxAdoption = Math.max(...adoptionValues);

  // Sort descending for horizontal bar chart
  const sortedSectors = [...sectorAdoption].sort((a, b) => b.adoption_pct - a.adoption_pct);

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="AI Job Share"
          value={latestAIShare != null ? `${latestAIShare.toFixed(1)}%` : "--"}
          subvalue="% of postings"
        />
        <KPICard
          label="Software Dev Postings"
          value={latestSwDev != null ? latestSwDev.toFixed(1) : "--"}
          subvalue="Indeed index (Feb 2020 = 100)"
        />
        <KPICard
          label="Semiconductor Index"
          value={latestSemi != null ? latestSemi.toFixed(1) : "--"}
          subvalue="Industrial production (2017 = 100)"
        />
        <KPICard
          label="Sectors Tracking AI"
          value={String(sectorAdoption.length)}
          subvalue="Census Bureau BTOS"
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

      {/* Section: AI Job Market */}
      <div>
        <h2 className="text-xl font-semibold text-gray-200 mb-1">AI Job Market</h2>
        <p className="text-sm text-gray-400 mb-4">How AI is reshaping job postings and tech hiring demand</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TimeSeriesChart
          {...ai.ai_job_share}
          type="area"
          startYear={timeRange}
          explainer="The percentage of all US job postings on Indeed that mention AI or machine learning. A rising share means AI skills are becoming mainstream requirements, not just niche roles."
        />
        <TimeSeriesChart
          {...ai.software_dev_postings}
          type="line"
          startYear={timeRange}
          explainer="Indeed's software development postings index vs all jobs, both starting at 100 in Feb 2020. If the software dev line drops below all jobs, it means tech hiring is cooling relative to the broader market."
        />
      </div>

      {/* Section: AI Investment */}
      <div className="mt-2">
        <h2 className="text-xl font-semibold text-gray-200 mb-1">AI Investment</h2>
        <p className="text-sm text-gray-400 mb-4">Where the money is going: IT equipment, software, R&D, and chips</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TimeSeriesChart
          {...ai.it_investment}
          type="line"
          startYear={timeRange}
          explainer="Private sector spending on IT equipment, software, and R&D. These are quarterly BEA figures in billions of dollars. Rising investment typically precedes new hiring — companies buy tools before they hire people to use them."
        />
        <TimeSeriesChart
          {...ai.semiconductor_production}
          type="area"
          startYear={timeRange}
          explainer="The industrial production index for semiconductors (NAICS 3344). Chips power AI — when this index spikes, it signals surging demand for AI compute infrastructure."
        />
      </div>

      {/* Section: Investment vs Employment */}
      <div className="mt-2">
        <h2 className="text-xl font-semibold text-gray-200 mb-1">Investment vs Employment</h2>
        <p className="text-sm text-gray-400 mb-4">Is AI spending translating into jobs, or replacing them?</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TimeSeriesChart
          {...ai.investment_vs_hiring}
          type="line"
          startYear={timeRange}
          explainer="Both indexed to 100. When investment rises faster than employment, companies are spending on technology (including AI) but not proportionally hiring. This divergence is a key signal of automation and efficiency gains."
        />
        <TimeSeriesChart
          {...ai.nvda_vs_employment}
          type="line"
          startYear={timeRange}
          explainer="NVIDIA's stock price (an AI spending proxy) vs Information sector employment, both indexed to 100. NVIDIA's meteoric rise while employment flatlines tells the story of the AI era — massive investment, modest job growth."
        />
      </div>

      {/* Section: AI Adoption by Sector */}
      <div className="mt-2">
        <h2 className="text-xl font-semibold text-gray-200 mb-1">AI Adoption by Sector</h2>
        <p className="text-sm text-gray-400 mb-4">
          Percentage of businesses using AI in each sector. Curated from Census Bureau BTOS
          publications — not raw survey microdata. Information and Professional Services lead,
          while Agriculture and Construction trail.
        </p>
      </div>
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
        <ResponsiveContainer width="100%" height={sortedSectors.length * 36 + 20}>
          <BarChart
            data={sortedSectors}
            layout="vertical"
            margin={{ top: 5, right: 60, left: 10, bottom: 5 }}
          >
            <XAxis
              type="number"
              domain={[0, "auto"]}
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              stroke="#374151"
              tickFormatter={(v: number) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="sector"
              width={280}
              tick={{ fill: "#d1d5db", fontSize: 12 }}
              stroke="#374151"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111827",
                border: "1px solid #374151",
                borderRadius: "8px",
                color: "#f3f4f6",
              }}
              labelStyle={{ color: "#f3f4f6", fontWeight: 600 }}
              itemStyle={{ color: "#9ca3af" }}
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
              formatter={(value) => [`${value}%`, "Adoption"]}
            />
            <Bar dataKey="adoption_pct" radius={[0, 4, 4, 0]} label={{ position: "right", fill: "#9ca3af", fontSize: 12, formatter: (v) => `${v}%` }}>
              {sortedSectors.map((entry, i) => (
                <Cell key={i} fill={interpolateColor(entry.adoption_pct, minAdoption, maxAdoption)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
