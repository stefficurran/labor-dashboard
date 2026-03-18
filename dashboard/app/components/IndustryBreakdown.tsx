"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export function aggregateByRange(
  data: Record<string, unknown>[] | undefined,
  labels: string[] | undefined,
  year: number
): { name: string; value: number }[] {
  if (!data || !labels) return [];
  const filtered = data.filter(
    (d) => new Date(d.date as string).getFullYear() >= year
  );
  const totals: Record<string, number> = {};
  for (const label of labels) {
    totals[label] = 0;
  }
  for (const row of filtered) {
    for (const label of labels) {
      totals[label] += (row[label] as number) || 0;
    }
  }
  return Object.entries(totals)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function IndustryBreakdown({
  title,
  subtitle,
  data,
  color,
}: {
  title: string;
  subtitle: string;
  data: { name: string; value: number }[];
  color: string;
}) {
  if (!data.length) return null;
  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="text-sm text-gray-400 mb-4">{subtitle}</p>
      <ResponsiveContainer width="100%" height={data.length * 36 + 20}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: "#9ca3af", fontSize: 12 }}
            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "#d1d5db", fontSize: 12 }}
            width={140}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }}
            labelStyle={{ color: "#f3f4f6" }}
            formatter={(value) => [Number(value).toLocaleString(), "Employees"]}
          />
          <Bar dataKey="value" fill={color} fillOpacity={0.7} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
