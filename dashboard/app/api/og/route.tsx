import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { generatePromoCards, findCard, PromoCard } from "../../components/promo-utils";

export const runtime = "nodejs";

const DIMENSIONS = {
  landscape: { width: 1200, height: 630 },
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1920 },
} as const;

type Format = keyof typeof DIMENSIONS;

function loadDashboardData() {
  const dataDir = path.join(process.cwd(), "public", "data");
  const read = (file: string) => {
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  };
  return {
    labor: read("labor.json"),
    analytics: read("analytics.json"),
    sectors: read("sectors.json"),
    market: read("market.json"),
    layoffs: read("layoffs.json"),
    ai: read("ai.json"),
  };
}

function scaleFonts(format: Format) {
  // Scale up for square and portrait
  const multiplier = format === "portrait" ? 1.4 : format === "square" ? 1.2 : 1;
  return {
    headline: Math.round(42 * multiplier),
    body: Math.round(22 * multiplier),
    value: Math.round(120 * multiplier),
    label: Math.round(20 * multiplier),
    subvalue: Math.round(28 * multiplier),
    title: Math.round(48 * multiplier),
    footer: Math.round(16 * multiplier),
    padding: Math.round(60 * multiplier),
  };
}

function renderCalloutCard(card: PromoCard, format: Format) {
  const s = scaleFonts(format);
  const dim = DIMENSIONS[format];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: dim.width,
        height: dim.height,
        backgroundColor: "#030712",
        padding: `${s.padding}px`,
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          width: "8px",
          height: "100%",
          backgroundColor: card.accentColor,
          position: "absolute",
          left: "0",
          top: "0",
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: "center",
          paddingLeft: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: `${s.headline}px`,
            fontWeight: 700,
            color: "#f3f4f6",
            lineHeight: 1.2,
          }}
        >
          {card.headline}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: `${s.body}px`,
            color: "#9ca3af",
            marginTop: "20px",
            lineHeight: 1.5,
          }}
        >
          {card.body}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: `${s.footer}px`,
          color: "#4b5563",
        }}
      >
        Labor Dashboard · FRED/BLS
      </div>
    </div>
  );
}

function renderKPICard(card: PromoCard, format: Format) {
  const s = scaleFonts(format);
  const dim = DIMENSIONS[format];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: dim.width,
        height: dim.height,
        backgroundColor: "#030712",
        padding: `${s.padding}px`,
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: `${s.label}px`,
          color: "#9ca3af",
          textTransform: "uppercase",
          letterSpacing: "2px",
        }}
      >
        {card.headline}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: `${s.value}px`,
          fontWeight: 700,
          color: "#f3f4f6",
          marginTop: "10px",
        }}
      >
        {card.value}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginTop: "10px",
        }}
      >
        {card.trend && (
          <span
            style={{
              display: "flex",
              fontSize: `${s.subvalue}px`,
              color: card.accentColor,
              marginRight: "8px",
            }}
          >
            {card.trend === "up" ? "\u2191" : "\u2193"}
          </span>
        )}
        <span
          style={{
            display: "flex",
            fontSize: `${s.subvalue}px`,
            color: card.accentColor,
          }}
        >
          {card.subvalue}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: `${s.footer}px`,
          color: "#4b5563",
          marginTop: "40px",
        }}
      >
        Labor Dashboard · FRED/BLS
      </div>
    </div>
  );
}

function renderSummaryCard(card: PromoCard, allCards: PromoCard[], format: Format) {
  const s = scaleFonts(format);
  const dim = DIMENSIONS[format];
  const calloutCards = allCards.filter((c) => c.type === "callout").slice(0, 3);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: dim.width,
        height: dim.height,
        backgroundColor: "#030712",
        padding: `${s.padding}px`,
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "6px",
          backgroundColor: "#3b82f6",
          position: "absolute",
          top: "0",
          left: "0",
        }}
      />
      <div
        style={{
          display: "flex",
          fontSize: `${s.title}px`,
          fontWeight: 700,
          color: "#f3f4f6",
        }}
      >
        Weekly Labor Briefing
      </div>
      <div
        style={{
          display: "flex",
          fontSize: `${s.body}px`,
          color: "#6b7280",
          marginTop: "8px",
        }}
      >
        {card.subvalue}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: "40px",
        }}
      >
        {calloutCards.map((c) => (
          <div
            key={c.id}
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                width: "10px",
                height: "10px",
                borderRadius: "5px",
                backgroundColor: c.accentColor,
                marginRight: "16px",
                flexShrink: 0,
              }}
            />
            <div
              style={{
                display: "flex",
                fontSize: `${s.body}px`,
                color: "#d1d5db",
              }}
            >
              {c.headline}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flex: 1 }} />
      <div
        style={{
          display: "flex",
          fontSize: `${s.footer}px`,
          color: "#4b5563",
        }}
      >
        Labor Dashboard · FRED/BLS
      </div>
    </div>
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type") || "summary";
  const id = searchParams.get("id") || undefined;
  const format = (searchParams.get("format") || "landscape") as Format;

  if (!DIMENSIONS[format]) {
    return new Response("Invalid format. Use landscape, square, or portrait.", {
      status: 400,
    });
  }

  let fontData: ArrayBuffer | undefined;
  try {
    const fontResponse = await fetch(
      "https://cdn.jsdelivr.net/fontsource/fonts/geist-sans@latest/latin-700-normal.woff"
    );
    if (fontResponse.ok) {
      fontData = await fontResponse.arrayBuffer();
    }
  } catch {
    // Fall back to default font
  }

  const data = loadDashboardData();
  const cards = generatePromoCards(data);
  const card = findCard(cards, type, id);

  if (!card) {
    // Fall back to summary card
    const summaryCard = cards.find((c) => c.type === "summary");
    if (!summaryCard) {
      return new Response("No card data available", { status: 500 });
    }
    const element = renderSummaryCard(summaryCard, cards, format);
    const dim = DIMENSIONS[format];
    return new ImageResponse(element, {
      width: dim.width,
      height: dim.height,
      ...(fontData
        ? {
            fonts: [
              {
                name: "Geist",
                data: fontData,
                weight: 700 as const,
                style: "normal" as const,
              },
            ],
          }
        : {}),
    });
  }

  let element: React.ReactElement;
  if (card.type === "callout") {
    element = renderCalloutCard(card, format);
  } else if (card.type === "kpi") {
    element = renderKPICard(card, format);
  } else {
    element = renderSummaryCard(card, cards, format);
  }

  const dim = DIMENSIONS[format];
  return new ImageResponse(element, {
    width: dim.width,
    height: dim.height,
    ...(fontData
      ? {
          fonts: [
            {
              name: "Geist",
              data: fontData,
              weight: 700 as const,
              style: "normal" as const,
            },
          ],
        }
      : {}),
  });
}
