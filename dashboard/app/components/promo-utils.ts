import { detectCallouts, getDataFreshness, Callout, Severity } from "./briefing-utils";

export interface PromoCard {
  id: string;
  type: "callout" | "kpi" | "summary";
  headline: string;
  body: string;
  value?: string;
  subvalue?: string;
  accentColor: string;
  trend?: "up" | "down";
}

const SEVERITY_COLORS: Record<Severity, string> = {
  alert: "#ef4444",
  notable: "#f59e0b",
  info: "#3b82f6",
};

export function generatePromoCards(data: any): PromoCard[] {
  const cards: PromoCard[] = [];

  // Callout cards
  const callouts = detectCallouts(data);
  for (const c of callouts) {
    cards.push({
      id: `callout-${c.id}`,
      type: "callout",
      headline: c.headline,
      body: c.body,
      accentColor: SEVERITY_COLORS[c.severity],
    });
  }

  // KPI cards - compute same as page.tsx
  const labor = data.labor;
  if (labor) {
    const latestInfo = labor.tech_employment?.data?.at(-1);
    const prevYearInfo = labor.tech_employment?.data?.at(-13);
    const latestOpenings = labor.jolts_info?.data?.at(-1);
    const latestUnemployment = labor.unemployment?.data?.at(-1);

    const infoEmpNow = latestInfo?.["Information"] as number;
    const infoEmpPrev = prevYearInfo?.["Information"] as number;
    const yoyPct = infoEmpPrev ? ((infoEmpNow - infoEmpPrev) / infoEmpPrev * 100) : null;

    if (infoEmpNow) {
      cards.push({
        id: "kpi-employment",
        type: "kpi",
        headline: "Info Sector Employment",
        body: "U.S. Information sector, seasonally adjusted",
        value: `${infoEmpNow.toFixed(0)}K`,
        subvalue: yoyPct != null ? `${yoyPct >= 0 ? "+" : ""}${yoyPct.toFixed(1)}% YoY` : undefined,
        accentColor: yoyPct != null && yoyPct >= 0 ? "#10b981" : "#ef4444",
        trend: yoyPct != null ? (yoyPct >= 0 ? "up" : "down") : undefined,
      });
    }

    const openings = latestOpenings?.["Job Openings"] as number;
    if (openings) {
      cards.push({
        id: "kpi-openings",
        type: "kpi",
        headline: "Job Openings (Info)",
        body: "JOLTS Information sector openings",
        value: `${openings.toFixed(0)}K`,
        subvalue: "Latest month",
        accentColor: "#3b82f6",
      });
    }

    const infoUnemp = latestUnemployment?.["Information Industry"] as number;
    const natUnemp = latestUnemployment?.["National"] as number;
    if (infoUnemp) {
      cards.push({
        id: "kpi-unemployment",
        type: "kpi",
        headline: "Unemployment (Info)",
        body: "Information sector vs national rate",
        value: `${infoUnemp.toFixed(1)}%`,
        subvalue: natUnemp ? `National: ${natUnemp.toFixed(1)}%` : undefined,
        accentColor: natUnemp && infoUnemp > natUnemp ? "#ef4444" : "#10b981",
        trend: natUnemp ? (infoUnemp > natUnemp ? "down" : "up") : undefined,
      });
    }
  }

  // S&P 500 KPI
  const mktData = data.market?.stock_indices?.data;
  if (mktData?.length >= 2) {
    const latest = mktData.at(-1)?.["S&P 500"] as number;
    const prev = mktData.at(-2)?.["S&P 500"] as number;
    if (latest && prev) {
      const momPct = ((latest - prev) / prev * 100);
      cards.push({
        id: "kpi-sp500",
        type: "kpi",
        headline: "S&P 500",
        body: "Month-end closing price",
        value: latest.toFixed(0),
        subvalue: `${momPct >= 0 ? "+" : ""}${momPct.toFixed(1)}% MoM`,
        accentColor: momPct >= 0 ? "#10b981" : "#ef4444",
        trend: momPct >= 0 ? "up" : "down",
      });
    }
  }

  // Tech Layoffs KPI
  const layoffsData = data.layoffs?.monthly?.data;
  if (layoffsData?.length) {
    const latest = layoffsData.at(-1)?.total as number;
    if (latest) {
      cards.push({
        id: "kpi-layoffs",
        type: "kpi",
        headline: "Tech Layoffs",
        body: "Monthly total from Layoffs.fyi",
        value: `${(latest / 1000).toFixed(1)}K`,
        subvalue: "Latest month",
        accentColor: "#ef4444",
        trend: "down",
      });
    }
  }

  // AI Job Share KPI
  const aiData = data.ai?.ai_job_share?.data;
  if (aiData?.length) {
    const latest = aiData.at(-1)?.["AI Share"] as number;
    if (latest) {
      cards.push({
        id: "kpi-ai-share",
        type: "kpi",
        headline: "AI Job Share",
        body: "% of Indeed postings mentioning AI",
        value: `${latest.toFixed(1)}%`,
        subvalue: "of all job postings",
        accentColor: "#06b6d4",
        trend: "up",
      });
    }
  }

  // Summary card (always last)
  const dataDate = labor ? getDataFreshness(labor) : "Unknown";
  const topCallouts = callouts.slice(0, 3);
  cards.push({
    id: "summary",
    type: "summary",
    headline: "Weekly Labor Briefing",
    body: topCallouts.map(c => c.headline).join(" · "),
    subvalue: `Data through ${dataDate}`,
    accentColor: "#3b82f6",
  });

  return cards;
}

export function findCard(cards: PromoCard[], type: string, id?: string): PromoCard | undefined {
  if (type === "summary") return cards.find(c => c.type === "summary");
  if (type === "callout" && id) return cards.find(c => c.id === `callout-${id}`);
  if (type === "kpi" && id) return cards.find(c => c.id === `kpi-${id}`);
  return undefined;
}
