"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Area,
  AreaChart,
  ComposedChart,
  Bar,
  ReferenceLine,
} from "recharts";
import { LaborEvent, CATEGORY_COLORS } from "../types/events";

const COLORS = [
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#6366f1", // indigo
  "#84cc16", // lime
];

interface TimeSeriesChartProps {
  title: string;
  subtitle: string;
  data: Record<string, unknown>[];
  labels: string[];
  type?: "line" | "area" | "bar";
  height?: number;
  startYear?: number;
  explainer?: string;
  colorMap?: Record<string, string>;
  events?: LaborEvent[];
  selectedEventId?: string | null;
  onEventClick?: (event: LaborEvent) => void;
  compact?: boolean;
  stacked?: boolean;
}

// Clickable marker rendered at the top of each event reference line
function EventMarker({
  event,
  selected,
  onClick,
  viewBox,
}: {
  event: LaborEvent;
  selected: boolean;
  onClick: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  viewBox?: any;
}) {
  if (!viewBox) return null;
  const { x } = viewBox;
  const y = viewBox.y + 4;
  return (
    <g onClick={onClick} style={{ cursor: "pointer" }}>
      {/* Wide invisible hit area */}
      <rect x={x - 8} y={viewBox.y} width={16} height={viewBox.height} fill="transparent" />
      {/* Marker dot at top */}
      <circle
        cx={x}
        cy={y}
        r={selected ? 6 : 4}
        fill={CATEGORY_COLORS[event.category]}
        fillOpacity={selected ? 1 : 0.8}
        stroke={selected ? "#fff" : "none"}
        strokeWidth={selected ? 2 : 0}
      />
    </g>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "2-digit", month: "short" });
}

function formatValue(value: number) {
  if (value >= 100000) return `${(value / 1000).toFixed(0)}K`;
  if (value >= 10000) return `${(value / 1000).toFixed(1)}K`;
  if (value >= 1000) return `${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex ml-2 cursor-help">
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-700 text-gray-400 text-xs font-medium hover:bg-gray-600 hover:text-gray-200 transition-colors">
        ?
      </span>
      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 shadow-xl">
        {text}
      </span>
    </span>
  );
}

export default function TimeSeriesChart({
  title,
  subtitle,
  data,
  labels,
  type = "line",
  height = 320,
  startYear,
  explainer,
  colorMap,
  events,
  selectedEventId,
  onEventClick,
  compact = false,
  stacked = false,
}: TimeSeriesChartProps) {
  const filtered = startYear
    ? data.filter((d) => new Date(d.date as string).getFullYear() >= startYear)
    : data;

  // Thin the data for x-axis labels (show every 12th point)
  const ticks = filtered
    .filter((_, i) => i % 12 === 0)
    .map((d) => d.date as string);

  // Filter events to visible date range
  const visibleEvents = events?.filter((e) => {
    const eventYear = new Date(e.date).getFullYear();
    if (startYear && eventYear < startYear) return false;
    const lastDate = filtered.at(-1)?.date as string | undefined;
    if (lastDate && e.date > lastDate) return false;
    return true;
  });

  const ChartComponent = type === "area" ? AreaChart : type === "bar" ? ComposedChart : LineChart;

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
      <div className="flex items-start">
        <h3 className="text-lg font-semibold text-gray-100">{title}</h3>
        {explainer && <InfoTooltip text={explainer} />}
      </div>
      <p className="text-sm text-gray-400 mb-4">{subtitle}</p>
      <ResponsiveContainer width="100%" height={compact ? Math.min(height, 240) : height}>
        <ChartComponent data={filtered}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            ticks={ticks}
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            stroke="#374151"
          />
          <YAxis
            tickFormatter={formatValue}
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            stroke="#374151"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#111827",
              border: "1px solid #374151",
              borderRadius: "8px",
              color: "#f3f4f6",
            }}
            labelFormatter={(label) => formatDate(String(label))}
            formatter={(value) => [formatValue(Number(value)), ""]}
          />
          <Legend />
          {visibleEvents?.map((event) => {
            const isSelected = selectedEventId === event.id;
            return (
              <ReferenceLine
                key={event.id}
                x={event.date}
                stroke={CATEGORY_COLORS[event.category]}
                strokeWidth={isSelected ? 3 : event.impact === "major" ? 2 : 1}
                strokeDasharray={isSelected ? undefined : event.impact === "major" ? undefined : "4 3"}
                strokeOpacity={isSelected ? 1 : 0.5}
                ifOverflow="extendDomain"
                label={
                  <EventMarker
                    event={event}
                    selected={isSelected}
                    onClick={() => onEventClick?.(event)}
                  />
                }
              />
            );
          })}
          {labels.map((label, i) => {
            const color = colorMap?.[label] || COLORS[i % COLORS.length];
            return type === "area" ? (
              <Area
                key={label}
                type="monotone"
                dataKey={label}
                stroke={color}
                fill={color}
                fillOpacity={0.15}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ) : type === "bar" ? (
              <Bar
                key={label}
                dataKey={label}
                fill={color}
                fillOpacity={0.7}
                stackId={stacked ? "stack" : undefined}
              />
            ) : (
              <Line
                key={label}
                type="monotone"
                dataKey={label}
                stroke={color}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            );
          })}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}
