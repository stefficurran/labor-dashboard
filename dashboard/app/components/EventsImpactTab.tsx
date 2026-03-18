"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
import TimeSeriesChart from "./TimeSeriesChart";
import {
  LaborEvent,
  EventCategory,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
} from "../types/events";

interface SeriesGroup {
  title: string;
  subtitle: string;
  labels: string[];
  data: Record<string, unknown>[];
}

interface NewsResult {
  article_id: string;
  title: string;
  link: string;
  source_id: string;
  source_name?: string;
  pubDate: string;
  description?: string;
}

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

interface EventsImpactTabProps {
  labor: Record<string, SeriesGroup>;
  events: LaborEvent[];
  eventStudy: { events: EventEntry[] } | null;
}

const ALL_CATEGORIES: EventCategory[] = [
  "economic_crisis",
  "tech_layoffs",
  "hiring_boom",
  "policy",
  "industry_shift",
  "company_event",
  "ai_release",
];

const ranges = [
  { label: "All", year: 2000 },
  { label: "10Y", year: 2016 },
  { label: "5Y", year: 2021 },
  { label: "3Y", year: 2023 },
];

function formatMonthYear(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

function formatCAR(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function CARCell({ value }: { value: number }) {
  const color = value >= 0 ? "text-emerald-400" : "text-red-400";
  return (
    <td className={`px-5 py-3 text-right font-mono ${color}`}>
      {formatCAR(value)}
    </td>
  );
}

export default function EventsImpactTab({
  labor,
  events,
  eventStudy,
}: EventsImpactTabProps) {
  const [activeCategories, setActiveCategories] = useState<Set<EventCategory>>(
    new Set(ALL_CATEGORIES)
  );
  const [showModerate, setShowModerate] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<LaborEvent | null>(null);
  const [timeRange, setTimeRange] = useState(2015);

  // AI Impact state
  const studyEvents = useMemo(
    () => eventStudy?.events ?? [],
    [eventStudy]
  );
  const sortedStudyEvents = useMemo(
    () =>
      [...studyEvents].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    [studyEvents]
  );
  const [selectedStudyId, setSelectedStudyId] = useState<string>(
    sortedStudyEvents[0]?.id ?? ""
  );
  const selectedStudyEvent = useMemo(
    () => studyEvents.find((e) => e.id === selectedStudyId) ?? studyEvents[0],
    [studyEvents, selectedStudyId]
  );

  // Lookup map from eventStudy for inline CAR summaries
  const studyMap = useMemo(() => {
    if (!eventStudy?.events) return new Map<string, EventEntry>();
    return new Map(eventStudy.events.map((e) => [e.id, e]));
  }, [eventStudy]);

  // Live news state
  const [newsQuery, setNewsQuery] = useState("");
  const [newsCategory, setNewsCategory] = useState("");
  const [newsResults, setNewsResults] = useState<NewsResult[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const chartRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  const toggleCategory = (cat: EventCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const filteredEvents = events.filter(
    (e) =>
      activeCategories.has(e.category) &&
      (showModerate || e.impact === "major")
  );

  const sortedEvents = [...filteredEvents].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  // Auto-scroll the list to the selected event
  useEffect(() => {
    if (selectedEvent && selectedItemRef.current && listRef.current) {
      const container = listRef.current;
      const item = selectedItemRef.current;
      const containerRect = container.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      if (
        itemRect.top < containerRect.top ||
        itemRect.bottom > containerRect.bottom
      ) {
        item.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [selectedEvent]);

  const handleEventSelect = useCallback(
    (event: LaborEvent) => {
      setSelectedEvent((prev) => (prev?.id === event.id ? null : event));
      // If it's an AI release event with study data, also update the CAR chart
      if (event.category === "ai_release" && studyMap.has(event.id)) {
        setSelectedStudyId(event.id);
      }
    },
    [studyMap]
  );

  const handleChartEventClick = useCallback(
    (event: LaborEvent) => {
      handleEventSelect(event);
    },
    [handleEventSelect]
  );

  const searchNews = async () => {
    if (!newsQuery && !newsCategory) return;
    setNewsLoading(true);
    setNewsError("");
    setHasSearched(true);
    try {
      const params = new URLSearchParams();
      if (newsQuery) params.set("q", newsQuery);
      if (newsCategory) params.set("category", newsCategory);
      const res = await fetch(`/api/news?${params.toString()}`);
      const data = await res.json();
      if (data.error) {
        setNewsError(data.error);
        setNewsResults([]);
      } else {
        setNewsResults(data.results || []);
      }
    } catch {
      setNewsError("Failed to fetch news");
      setNewsResults([]);
    } finally {
      setNewsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ── EVENT TIMELINE ── */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
          Event Timeline
        </h2>

        {/* Time range + filters */}
        <div ref={chartRef}>
          <div className="flex flex-wrap items-center gap-2 mb-4">
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
            <span className="mx-2 text-gray-700">|</span>
            <label className="flex items-center gap-1.5 text-sm text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showModerate}
                onChange={(e) => setShowModerate(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-600"
              />
              Show moderate events
            </label>
          </div>

          {/* Category filter pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                  activeCategories.has(cat)
                    ? "border-transparent text-white"
                    : "border-gray-700 text-gray-500 bg-transparent"
                }`}
                style={
                  activeCategories.has(cat)
                    ? {
                        backgroundColor: CATEGORY_COLORS[cat] + "33",
                        color: CATEGORY_COLORS[cat],
                        borderColor: CATEGORY_COLORS[cat] + "66",
                      }
                    : undefined
                }
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                />
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          <TimeSeriesChart
            {...labor.tech_employment}
            type="area"
            startYear={timeRange}
            events={filteredEvents}
            selectedEventId={selectedEvent?.id ?? null}
            onEventClick={handleChartEventClick}
            explainer="Tech sector employment with historical event markers. Click any colored dot on the chart to select an event and see details below."
          />
        </div>

        {/* Event timeline list with inline expansion */}
        <div className="mt-6 rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-300">
              Event Timeline ({filteredEvents.length} events)
            </h3>
            {selectedEvent && (
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Clear selection
              </button>
            )}
          </div>
          <div ref={listRef} className="max-h-[480px] overflow-y-auto">
            {sortedEvents.map((event) => {
              const isSelected = selectedEvent?.id === event.id;
              const study = event.category === "ai_release" ? studyMap.get(event.id) : undefined;
              return (
                <div
                  key={event.id}
                  ref={isSelected ? selectedItemRef : undefined}
                  className={`border-b border-gray-800/50 last:border-b-0 transition-colors ${
                    isSelected ? "bg-gray-800/70" : "hover:bg-gray-800/30"
                  }`}
                >
                  <button
                    onClick={() => handleEventSelect(event)}
                    className="w-full text-left px-5 py-3 flex items-start gap-3"
                  >
                    <span
                      className={`mt-1 flex-shrink-0 rounded-full transition-all ${
                        isSelected ? "w-3 h-3" : "w-2 h-2"
                      }`}
                      style={{
                        backgroundColor: CATEGORY_COLORS[event.category],
                        boxShadow: isSelected
                          ? `0 0 8px ${CATEGORY_COLORS[event.category]}80`
                          : "none",
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p
                          className={`text-sm font-medium truncate ${
                            isSelected ? "text-white" : "text-gray-200"
                          }`}
                        >
                          {event.title}
                        </p>
                        {isSelected && (
                          <svg
                            className="w-3 h-3 text-gray-400 flex-shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 15l7-7 7 7"
                            />
                          </svg>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(event.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                        })}
                        {" · "}
                        {CATEGORY_LABELS[event.category]}
                        {event.impact === "major" && " · Major"}
                      </p>
                      {study && (
                        <div className="flex gap-3 text-xs mt-1">
                          <span className={study.summary.sp500_car_10d >= 0 ? "text-green-400" : "text-red-400"}>
                            S&P {study.summary.sp500_car_10d >= 0 ? "+" : ""}{study.summary.sp500_car_10d}%
                          </span>
                          <span className={study.summary.nasdaq_car_10d >= 0 ? "text-green-400" : "text-red-400"}>
                            NASDAQ {study.summary.nasdaq_car_10d >= 0 ? "+" : ""}{study.summary.nasdaq_car_10d}%
                          </span>
                          <span className={study.summary.nvda_car_10d >= 0 ? "text-green-400" : "text-red-400"}>
                            NVDA {study.summary.nvda_car_10d >= 0 ? "+" : ""}{study.summary.nvda_car_10d}%
                          </span>
                          <span className="text-gray-500">(10-day)</span>
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isSelected && (
                    <div className="px-5 pb-4 pl-11">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            backgroundColor:
                              CATEGORY_COLORS[event.category] + "22",
                            color: CATEGORY_COLORS[event.category],
                          }}
                        >
                          {CATEGORY_LABELS[event.category]}
                        </span>
                        <span className="text-xs text-gray-500">
                          {event.impact === "major"
                            ? "Major impact"
                            : "Moderate impact"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 leading-relaxed">
                        {event.description}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── AI RELEASE IMPACT ── */}
      {eventStudy && studyEvents.length > 0 && selectedStudyEvent && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
            AI Release Impact
          </h2>

          {/* Explainer */}
          <p className="text-sm text-gray-400 leading-relaxed mb-4">
            Each chart shows how stocks moved in the 5 trading days before and 10 days after a major AI release.
            The numbers in the table are <span className="text-gray-300">cumulative returns</span> — how much each index gained or lost
            over the window. &quot;Tech Premium&quot; is how much NASDAQ outperformed the S&amp;P 500, isolating the tech-specific reaction.
          </p>

          {/* Event selector */}
          <div className="flex items-center gap-3 mb-4">
            <label htmlFor="study-event-select" className="text-sm text-gray-400">
              Event:
            </label>
            <select
              id="study-event-select"
              value={selectedStudyId}
              onChange={(e) => setSelectedStudyId(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {sortedStudyEvents.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.title} ({formatMonthYear(evt.date)})
                </option>
              ))}
            </select>
          </div>

          {/* Event-centered chart */}
          <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
            <h3 className="text-lg font-semibold text-gray-100">
              {selectedStudyEvent.title}
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Cumulative returns around {formatMonthYear(selectedStudyEvent.date)} release
            </p>
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={selectedStudyEvent.window.data}>
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
          <div className="mt-6 rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
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
                  {sortedStudyEvents.map((evt) => {
                    const isSelected = evt.id === selectedStudyId;
                    return (
                      <tr
                        key={evt.id}
                        onClick={() => setSelectedStudyId(evt.id)}
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
      )}

      {/* ── LIVE NEWS ── */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
          Live News
        </h2>

        <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
          <h3 className="text-lg font-semibold text-gray-100 mb-1">
            Live News Search
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            Live headlines from the last 48 hours via NewsData.io, filtered to
            top-tier sources (Reuters, AP, BBC, NYT, etc.)
          </p>

          <div className="flex flex-wrap gap-3 mb-4">
            <input
              type="text"
              value={newsQuery}
              onChange={(e) => setNewsQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchNews()}
              placeholder="tech employment, AI hiring..."
              className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-600"
            />
            <select
              value={newsCategory}
              onChange={(e) => setNewsCategory(e.target.value)}
              className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-blue-600"
            >
              <option value="">All categories</option>
              <option value="business">Business</option>
              <option value="technology">Technology</option>
            </select>
            <button
              onClick={searchNews}
              disabled={newsLoading || (!newsQuery && !newsCategory)}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {newsLoading ? "Searching..." : "Search"}
            </button>
          </div>

          {newsError && (
            <p className="text-sm text-red-400 mb-4">{newsError}</p>
          )}

          {newsResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {newsResults.map((article) => (
                <a
                  key={article.article_id}
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg bg-gray-800/50 border border-gray-700/50 p-4 hover:border-gray-600 transition-colors"
                >
                  <h4 className="text-sm font-medium text-gray-200 mb-2 line-clamp-2">
                    {article.title}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 font-medium">
                      {article.source_name || article.source_id}
                    </span>
                    <span>
                      {new Date(article.pubDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}

          {hasSearched && !newsLoading && newsResults.length === 0 && !newsError && (
            <p className="text-sm text-gray-500 text-center py-4">
              No results found. Try different search terms.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
