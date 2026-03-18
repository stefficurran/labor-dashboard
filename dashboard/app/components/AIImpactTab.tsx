"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

interface EventSummary {
  sp500_car_1d: number;
  sp500_car_3d: number;
  sp500_car_10d: number;
  nasdaq_car_1d: number;
  nasdaq_car_3d: number;
  nasdaq_car_10d: number;
  nvda_car_1d: number;
  nvda_car_3d: number;
  nvda_car_10d: number;
  tech_premium_10d: number;
}

interface EventWindow {
  labels: string[];
  data: Record<string, number>[];
}

interface EventEntry {
  id: string;
  title: string;
  date: string;
  window: EventWindow;
  summary: EventSummary;
}

interface AIImpactTabProps {
  eventStudy: { events: EventEntry[] } | null;
}

function formatMonthYear(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

function formatCAR(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export default function AIImpactTab({ eventStudy }: AIImpactTabProps) {
  const events = eventStudy?.events ?? [];

  // Sort by date descending — most recent first
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const [selectedId, setSelectedId] = useState<string>(
    sortedEvents[0]?.id ?? ""
  );

  if (!eventStudy || events.length === 0) {
    return (
      <div className="text-center text-gray-400 py-12">
        AI release impact data is not available.
      </div>
    );
  }

  const selectedEvent = events.find((e) => e.id === selectedId) ?? events[0];

  return (
    <div className="space-y-6">
      {/* Explainer */}
      <div>
        <p className="text-sm text-gray-400 leading-relaxed">
          Each chart shows how stocks moved in the 5 trading days before and 10 days after a major AI release.
          The numbers in the table are <span className="text-gray-300">cumulative returns</span> — how much each index gained or lost
          over the window. &quot;Tech Premium&quot; is how much NASDAQ outperformed the S&amp;P 500, isolating the tech-specific reaction.
        </p>
      </div>

      {/* Event selector */}
      <div className="flex items-center gap-3">
        <label htmlFor="event-select" className="text-sm text-gray-400">
          Event:
        </label>
        <select
          id="event-select"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {sortedEvents.map((evt) => (
            <option key={evt.id} value={evt.id}>
              {evt.title} ({formatMonthYear(evt.date)})
            </option>
          ))}
        </select>
      </div>

      {/* Event-centered chart */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
        <h3 className="text-lg font-semibold text-gray-100">
          {selectedEvent.title}
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Cumulative returns around {formatMonthYear(selectedEvent.date)} release
        </p>
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={selectedEvent.window.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="day"
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              stroke="#374151"
              label={{
                value: "Trading Days from Release",
                position: "insideBottom",
                offset: -2,
                fill: "#9ca3af",
                fontSize: 12,
              }}
            />
            <YAxis
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              stroke="#374151"
              tickFormatter={(v: number) => `${v}%`}
              label={{
                value: "Cumulative Return (%)",
                angle: -90,
                position: "insideLeft",
                offset: 10,
                fill: "#9ca3af",
                fontSize: 12,
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111827",
                border: "1px solid #374151",
                borderRadius: "8px",
                color: "#f3f4f6",
              }}
              labelFormatter={(label) => `Day ${label}`}
              formatter={(value, name) => [
                `${Number(value).toFixed(2)}%`,
                name,
              ]}
            />
            <Legend />
            <ReferenceLine
              x={0}
              stroke="#6b7280"
              strokeDasharray="4 3"
              label={{
                value: "Release",
                position: "insideTopRight",
                fill: "#9ca3af",
                fontSize: 11,
              }}
            />
            <ReferenceLine y={0} stroke="#374151" />
            <Line
              type="monotone"
              dataKey="S&P 500"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="NASDAQ"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="NVDA"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary table */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">
            All AI Release Events
          </h3>
          <p className="text-sm text-gray-400">
            10-day cumulative abnormal returns around each release
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="text-left px-5 py-3 font-medium">Event</th>
                <th className="text-left px-5 py-3 font-medium">Date</th>
                <th className="text-right px-5 py-3 font-medium">
                  S&P 500 (10d)
                </th>
                <th className="text-right px-5 py-3 font-medium">
                  NASDAQ (10d)
                </th>
                <th className="text-right px-5 py-3 font-medium">
                  NVDA (10d)
                </th>
                <th className="text-right px-5 py-3 font-medium">
                  Tech Premium
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedEvents.map((evt) => {
                const isSelected = evt.id === selectedId;
                return (
                  <tr
                    key={evt.id}
                    onClick={() => setSelectedId(evt.id)}
                    className={`border-b border-gray-800/50 cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-blue-900/30"
                        : "hover:bg-gray-800/30"
                    }`}
                  >
                    <td className="px-5 py-3 font-medium text-white">
                      {evt.title}
                    </td>
                    <td className="px-5 py-3 text-gray-400">
                      {formatMonthYear(evt.date)}
                    </td>
                    <CARCell value={evt.summary.sp500_car_10d} />
                    <CARCell value={evt.summary.nasdaq_car_10d} />
                    <CARCell value={evt.summary.nvda_car_10d} />
                    <CARCell value={evt.summary.tech_premium_10d} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CARCell({ value }: { value: number }) {
  const color = value >= 0 ? "text-emerald-400" : "text-red-400";
  return (
    <td className={`px-5 py-3 text-right font-mono ${color}`}>
      {formatCAR(value)}
    </td>
  );
}
