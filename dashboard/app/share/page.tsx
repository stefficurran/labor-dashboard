"use client";

import { useState, useMemo } from "react";
import { useData } from "../components/DataProvider";
import BackNav from "../components/BackNav";
import { generatePromoCards, PromoCard } from "../components/promo-utils";

type Format = "landscape" | "square" | "portrait";

const formats: { label: string; value: Format }[] = [
  { label: "Landscape", value: "landscape" },
  { label: "Square", value: "square" },
  { label: "Portrait", value: "portrait" },
];

function getApiUrl(card: PromoCard, format: Format): string {
  if (card.type === "summary") return `/api/og?type=summary&format=${format}`;
  const id = card.id.replace(`${card.type}-`, "");
  return `/api/og?type=${card.type}&id=${id}&format=${format}`;
}

async function downloadCard(card: PromoCard, format: Format) {
  const url = getApiUrl(card, format);
  const response = await fetch(url);
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = `labor-dashboard-${card.id}-${format}.png`;
  a.click();
  URL.revokeObjectURL(blobUrl);
}

const aspectRatios: Record<Format, string> = {
  landscape: "1200 / 630",
  square: "1 / 1",
  portrait: "1080 / 1920",
};

const maxHeights: Record<Format, string> = {
  landscape: "none",
  square: "none",
  portrait: "480px",
};

export default function SharePage() {
  const data = useData();
  const [format, setFormat] = useState<Format>("landscape");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const cards = useMemo(() => {
    if (!data) return [];
    return generatePromoCards(data);
  }, [data]);

  async function copyLink(card: PromoCard) {
    const url = `${window.location.origin}${getApiUrl(card, format)}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(card.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const summaryCards = cards.filter((c) => c.type === "summary");
  const kpiCards = cards.filter((c) => c.type === "kpi");
  const calloutCards = cards.filter((c) => c.type === "callout");

  const sections = [
    { title: "Weekly Summary", cards: summaryCards },
    { title: "Key Metrics", cards: kpiCards },
    { title: "What Changed", cards: calloutCards },
  ].filter((s) => s.cards.length > 0);

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <BackNav title="Share Cards" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-center py-24">
            <div className="text-gray-400 text-lg">Loading share cards...</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <BackNav title="Share Cards" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">Share Your Insights</h2>
          <p className="mt-1 text-gray-400">
            Download or share promo cards with the latest labor market data.
          </p>
        </div>

        {/* Format toggle */}
        <div className="flex gap-1 mb-8 bg-gray-900 rounded-lg p-1 w-fit">
          {formats.map((f) => (
            <button
              key={f.value}
              onClick={() => setFormat(f.value)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                format === f.value
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Card sections */}
        {sections.map((section) => (
          <div key={section.title} className="mb-10">
            <h3 className="text-lg font-semibold text-gray-300 mb-4">
              {section.title}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {section.cards.map((card) => (
                <div
                  key={card.id}
                  className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden"
                >
                  {/* Image preview */}
                  <div
                    className="w-full overflow-hidden"
                    style={{
                      aspectRatio: aspectRatios[format],
                      maxHeight: maxHeights[format],
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getApiUrl(card, format)}
                      alt={card.headline}
                      className="w-full h-full object-cover rounded-t-xl"
                    />
                  </div>

                  {/* Card info + actions */}
                  <div className="p-4">
                    <p className="text-sm text-gray-300 mb-3">{card.headline}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => downloadCard(card, format)}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
                      >
                        Download
                      </button>
                      <button
                        onClick={() => copyLink(card)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          copiedId === card.id
                            ? "bg-emerald-900/50 text-emerald-400"
                            : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                        }`}
                      >
                        {copiedId === card.id ? "Copied!" : "Copy Link"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {cards.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            No share cards available yet.
          </div>
        )}
      </main>
    </div>
  );
}
