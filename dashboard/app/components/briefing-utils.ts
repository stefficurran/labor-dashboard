// Callout detection and action generation for the weekly briefing view.
// All functions are pure — they take data in and return results.

export type Severity = "alert" | "notable" | "info";
export type ActionCategory = "career" | "market" | "watchlist" | "info";

export interface Callout {
  id: string;
  severity: Severity;
  headline: string;
  body: string;
  priority: number; // higher = more important
  metric?: string; // which chart/metric this relates to
}

export interface Action {
  id: string;
  category: ActionCategory;
  title: string;
  body: string;
}

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

interface SectorRanking {
  series_id: string;
  sector: string;
  latest_value: number;
  yoy_pct: number | null;
  yoy_change: number | null;
  three_year_pct: number | null;
  five_year_pct: number | null;
}

interface SectorsData {
  rankings: SectorRanking[];
  sector_labels: string[];
  timeseries: Record<string, { date: string; value: number }[]>;
  growth_over_time: Record<string, unknown>[];
}

interface BriefingData {
  labor: Record<string, SeriesGroup>;
  analytics: Record<string, AnalyticsGroup>;
  sectors: SectorsData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  market?: Record<string, any> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layoffs?: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ai?: Record<string, any> | null;
}

function severityScore(s: Severity): number {
  return s === "alert" ? 10 : s === "notable" ? 5 : 2;
}

export function detectCallouts(data: BriefingData): Callout[] {
  const callouts: Callout[] = [];
  const { labor, analytics, sectors } = data;

  // 1. Employment YoY swing
  const yoyData = analytics.info_employment_yoy?.data;
  if (yoyData?.length) {
    const latest = yoyData.at(-1);
    const yoyPct = latest?.yoy_pct as number;
    if (yoyPct != null) {
      const absYoy = Math.abs(yoyPct);
      if (absYoy > 1) {
        const sev: Severity = absYoy > 3 ? "alert" : "notable";
        const direction = yoyPct > 0 ? "grew" : "shrank";
        callouts.push({
          id: "emp-yoy",
          severity: sev,
          headline: `Tech employment ${direction} ${absYoy.toFixed(1)}% year-over-year`,
          body: `The Information sector ${direction} by ${absYoy.toFixed(1)}% compared to 12 months ago (${(latest?.yoy_change as number)?.toFixed(0)}K jobs). ${yoyPct < 0 ? "This ongoing contraction signals continued headwinds for tech workers." : "The sector is adding jobs at a meaningful clip."}`,
          priority: severityScore(sev) + absYoy,
          metric: "info_employment_yoy",
        });
      }
    }
  }

  // 2. Employment MoM change
  const empData = labor.tech_employment?.data;
  if (empData?.length >= 2) {
    const latest = empData.at(-1)?.["Information"] as number;
    const prev = empData.at(-2)?.["Information"] as number;
    if (latest != null && prev != null && prev > 0) {
      const momPct = ((latest - prev) / prev) * 100;
      if (Math.abs(momPct) > 1) {
        const direction = momPct > 0 ? "jumped" : "dropped";
        callouts.push({
          id: "emp-mom",
          severity: "notable",
          headline: `Info sector employment ${direction} ${Math.abs(momPct).toFixed(1)}% month-over-month`,
          body: `Employment moved from ${prev.toFixed(0)}K to ${latest.toFixed(0)}K in a single month. ${momPct < 0 ? "A sharp monthly decline worth monitoring." : "A strong monthly gain."}`,
          priority: severityScore("notable") + Math.abs(momPct),
          metric: "tech_employment",
        });
      }
    }
  }

  // 3 & 4. Openings/hires ratio
  const ratioData = analytics.info_openings_hires_ratio?.data;
  if (ratioData?.length >= 2) {
    const latest = ratioData.at(-1);
    const prev = ratioData.at(-2);
    const latestRatio = latest?.ratio as number;
    const prevRatio = prev?.ratio as number;

    // Crossed 1.0 between months
    if (latestRatio != null && prevRatio != null) {
      if ((prevRatio >= 1.0 && latestRatio < 1.0) || (prevRatio < 1.0 && latestRatio >= 1.0)) {
        const direction = latestRatio >= 1.0 ? "above" : "below";
        callouts.push({
          id: "ratio-cross",
          severity: "alert",
          headline: `Openings-to-hires ratio crossed ${direction} 1.0`,
          body: `The ratio moved from ${prevRatio.toFixed(2)} to ${latestRatio.toFixed(2)}. ${latestRatio < 1.0 ? "More people are being hired than there are open positions — a very tight market." : "There are now more openings than hires, suggesting employers are struggling to fill roles."}`,
          priority: severityScore("alert") + 3,
          metric: "info_openings_hires_ratio",
        });
      }
    }

    // Ratio level check
    if (latestRatio != null) {
      let ratioSev: Severity | null = null;
      let ratioMsg = "";
      if (latestRatio > 2.0) {
        ratioSev = "alert";
        ratioMsg = `At ${latestRatio.toFixed(2)}, there are 2+ openings per hire — employers are desperate for talent.`;
      } else if (latestRatio < 1.0) {
        ratioSev = "alert";
        ratioMsg = `At ${latestRatio.toFixed(2)}, there are fewer openings than hires — an unusually tight market.`;
      } else if (latestRatio > 1.5) {
        ratioSev = "notable";
        ratioMsg = `At ${latestRatio.toFixed(2)}, openings meaningfully exceed hires — demand is outpacing supply.`;
      } else if (latestRatio < 1.1) {
        ratioSev = "notable";
        ratioMsg = `At ${latestRatio.toFixed(2)}, openings barely exceed hires — the market is close to balanced.`;
      }
      if (ratioSev) {
        callouts.push({
          id: "ratio-level",
          severity: ratioSev,
          headline: `Openings-to-hires ratio at ${latestRatio.toFixed(2)}`,
          body: ratioMsg,
          priority: severityScore(ratioSev) + Math.abs(latestRatio - 1.0),
          metric: "info_openings_hires_ratio",
        });
      }
    }
  }

  // 5. Quits rate extreme
  const quitsData = analytics.info_quits_rate?.data;
  if (quitsData?.length) {
    const latest = quitsData.at(-1);
    const quitsPct = latest?.quits_pct as number;
    if (quitsPct != null) {
      if (quitsPct < 1.5) {
        callouts.push({
          id: "quits-low",
          severity: "notable",
          headline: `Quits rate unusually low at ${quitsPct.toFixed(2)}%`,
          body: `Only ${quitsPct.toFixed(2)}% of tech workers quit voluntarily this month. Low quits typically signal weak worker confidence — people are staying put because they don't see better options.`,
          priority: severityScore("notable") + (1.5 - quitsPct),
          metric: "info_quits_rate",
        });
      } else if (quitsPct > 2.5) {
        callouts.push({
          id: "quits-high",
          severity: "notable",
          headline: `Quits rate elevated at ${quitsPct.toFixed(2)}%`,
          body: `${quitsPct.toFixed(2)}% of tech workers quit this month — well above normal. High quits mean workers are confident enough to leave for better opportunities.`,
          priority: severityScore("notable") + (quitsPct - 2.5),
          metric: "info_quits_rate",
        });
      }
    }
  }

  // 6. Sector ranking: Info position
  if (sectors.rankings?.length) {
    const sorted = [...sectors.rankings].sort((a, b) => (b.yoy_pct ?? -999) - (a.yoy_pct ?? -999));
    const infoIdx = sorted.findIndex((s) => s.sector === "Information");
    if (infoIdx >= 0) {
      const rank = infoIdx + 1;
      const total = sorted.length;
      const infoYoy = sorted[infoIdx].yoy_pct;
      if (rank > total - 3) {
        callouts.push({
          id: "sector-rank",
          severity: "alert",
          headline: `Information sector ranked #${rank} of ${total} in YoY growth`,
          body: `At ${infoYoy != null ? infoYoy.toFixed(1) : "N/A"}% year-over-year, tech is in the bottom 3 of all major sectors. ${rank === total ? "Dead last." : "Near the bottom."} This is a structural concern, not just a blip.`,
          priority: severityScore("alert") + (total - rank === 0 ? 3 : 1),
          metric: "sector_rankings",
        });
      } else if (rank > total - 5) {
        callouts.push({
          id: "sector-rank",
          severity: "notable",
          headline: `Information sector ranked #${rank} of ${total} in YoY growth`,
          body: `At ${infoYoy != null ? infoYoy.toFixed(1) : "N/A"}% year-over-year, tech is in the bottom half of sectors. Not the worst, but underperforming relative to the broader economy.`,
          priority: severityScore("notable") + 1,
          metric: "sector_rankings",
        });
      }
    }
  }

  // 7. Sector big movers (5+ position change between YoY rank and 3Y rank)
  if (sectors.rankings?.length) {
    const byYoy = [...sectors.rankings].sort((a, b) => (b.yoy_pct ?? -999) - (a.yoy_pct ?? -999));
    const by3y = [...sectors.rankings].sort((a, b) => (b.three_year_pct ?? -999) - (a.three_year_pct ?? -999));
    for (const sector of sectors.rankings) {
      const yoyRank = byYoy.findIndex((s) => s.sector === sector.sector) + 1;
      const threeYRank = by3y.findIndex((s) => s.sector === sector.sector) + 1;
      const move = Math.abs(yoyRank - threeYRank);
      if (move >= 5) {
        const direction = yoyRank < threeYRank ? "climbed" : "fell";
        callouts.push({
          id: `sector-mover-${sector.sector.replace(/\s+/g, "-").toLowerCase()}`,
          severity: "notable",
          headline: `${sector.sector} ${direction} ${move} positions (YoY vs 3Y ranking)`,
          body: `Ranked #${yoyRank} by recent growth but #${threeYRank} over 3 years. ${direction === "climbed" ? "A sector gaining momentum." : "A sector losing steam."}`,
          priority: severityScore("notable") + move * 0.5,
          metric: "sector_rankings",
        });
      }
    }
  }

  // 8. Unemployment gap
  const unempData = labor.unemployment?.data;
  if (unempData?.length) {
    const latest = unempData.at(-1);
    const infoUnemp = latest?.["Information Industry"] as number;
    const natUnemp = latest?.["National"] as number;
    if (infoUnemp != null && natUnemp != null) {
      const gap = infoUnemp - natUnemp;
      if (gap > 1.5) {
        callouts.push({
          id: "unemp-gap",
          severity: "alert",
          headline: `Tech unemployment ${gap.toFixed(1)}pp above national rate`,
          body: `Information sector unemployment is ${infoUnemp.toFixed(1)}% vs ${natUnemp.toFixed(1)}% nationally — a ${gap.toFixed(1)} percentage point gap. Tech workers are having a significantly harder time finding work than the average American.`,
          priority: severityScore("alert") + gap,
          metric: "unemployment",
        });
      } else if (gap > 0) {
        callouts.push({
          id: "unemp-gap",
          severity: "notable",
          headline: `Tech unemployment above national rate (${infoUnemp.toFixed(1)}% vs ${natUnemp.toFixed(1)}%)`,
          body: `The Information sector unemployment rate exceeds the national average by ${gap.toFixed(1)}pp. Not a crisis, but worth watching.`,
          priority: severityScore("notable") + gap,
          metric: "unemployment",
        });
      }
    }
  }

  // 9. Unemployment trend (3 consecutive months rising)
  if (unempData && unempData.length >= 3) {
    const last3 = unempData.slice(-3);
    const vals = last3.map((d) => d["Information Industry"] as number).filter((v) => v != null);
    if (vals.length === 3 && vals[1] > vals[0] && vals[2] > vals[1]) {
      callouts.push({
        id: "unemp-trend",
        severity: "notable",
        headline: "Tech unemployment rising for 3+ months",
        body: `Information sector unemployment has risen for three consecutive months: ${vals.map((v) => v.toFixed(1) + "%").join(" → ")}. A sustained upward trend signals growing difficulty for job seekers.`,
        priority: severityScore("notable") + 2,
        metric: "unemployment",
      });
    }
  }

  // 10. JOLTS layoffs spike
  const joltsData = labor.jolts_info?.data;
  if (joltsData && joltsData.length >= 2) {
    const latest = joltsData.at(-1);
    const prev = joltsData.at(-2);
    const latestLayoffs = latest?.["Layoffs"] as number;
    const prevLayoffs = prev?.["Layoffs"] as number;
    if (latestLayoffs != null && prevLayoffs != null && prevLayoffs > 0) {
      const momChange = ((latestLayoffs - prevLayoffs) / prevLayoffs) * 100;
      if (momChange >= 15) {
        const sev: Severity = momChange >= 30 ? "alert" : "notable";
        callouts.push({
          id: "layoffs-spike",
          severity: sev,
          headline: `Tech layoffs surged ${momChange.toFixed(0)}% month-over-month`,
          body: `Layoffs jumped from ${prevLayoffs.toFixed(0)}K to ${latestLayoffs.toFixed(0)}K in the Information sector. ${momChange >= 30 ? "A dramatic spike that often precedes broader workforce reductions." : "A meaningful increase worth monitoring."}`,
          priority: severityScore(sev) + momChange * 0.1,
          metric: "jolts_info",
        });
      }
    }
  }

  // 11. S&P 500 monthly drop
  if (data.market?.stock_indices?.data?.length >= 2) {
    const mktData = data.market!.stock_indices.data;
    const latest = mktData.at(-1)?.["S&P 500"] as number;
    const prev = mktData.at(-2)?.["S&P 500"] as number;
    if (latest != null && prev != null && prev > 0) {
      const momPct = ((latest - prev) / prev) * 100;
      if (momPct < -5) {
        callouts.push({
          id: "sp500-drop",
          severity: "alert",
          headline: `S&P 500 fell ${Math.abs(momPct).toFixed(1)}% last month`,
          body: `The S&P 500 dropped from ${prev.toFixed(0)} to ${latest.toFixed(0)}. A drop of this magnitude often precedes hiring slowdowns.`,
          priority: severityScore("alert") + Math.abs(momPct) * 0.5,
          metric: "stock_indices",
        });
      } else if (momPct < -3) {
        callouts.push({
          id: "sp500-decline",
          severity: "notable",
          headline: `S&P 500 down ${Math.abs(momPct).toFixed(1)}% last month`,
          body: `The S&P 500 declined from ${prev.toFixed(0)} to ${latest.toFixed(0)}. Worth monitoring for potential hiring impacts.`,
          priority: severityScore("notable") + Math.abs(momPct) * 0.3,
          metric: "stock_indices",
        });
      }
    }
  }

  // 12. Layoff spike from layoffs.fyi data
  if (data.layoffs?.monthly?.data?.length >= 2) {
    const monthlyData = data.layoffs.monthly.data;
    const latest = monthlyData.at(-1);
    const prev = monthlyData.at(-2);
    const latestTotal = latest?.total as number;
    const prevTotal = prev?.total as number;
    if (latestTotal != null) {
      if (latestTotal > 10000) {
        callouts.push({
          id: "layoffs-fyi-spike",
          severity: "alert",
          headline: `${(latestTotal / 1000).toFixed(1)}K layoffs reported last month`,
          body: `Layoffs.fyi tracked ${latestTotal.toLocaleString()} layoffs in the latest month. A significant wave affecting multiple companies.`,
          priority: severityScore("alert") + latestTotal / 5000,
          metric: "layoffs_monthly",
        });
      } else if (latestTotal > 5000) {
        callouts.push({
          id: "layoffs-fyi-elevated",
          severity: "notable",
          headline: `${(latestTotal / 1000).toFixed(1)}K layoffs tracked last month`,
          body: `Layoffs.fyi reported ${latestTotal.toLocaleString()} layoffs. Elevated but not at crisis levels.`,
          priority: severityScore("notable") + latestTotal / 5000,
          metric: "layoffs_monthly",
        });
      }
    }
  }

  // 13. AI job share trend
  if (data.ai?.ai_job_share?.data?.length >= 2) {
    const shareData = data.ai!.ai_job_share.data;
    const latest = shareData.at(-1)?.["AI Share"] as number;
    const prev = shareData.at(-2)?.["AI Share"] as number;
    if (latest != null && prev != null) {
      const change = latest - prev;
      if (Math.abs(change) > 0.3) {
        const direction = change > 0 ? "rising" : "falling";
        callouts.push({
          id: "ai-job-share",
          severity: "notable",
          headline: `AI job postings ${direction} — now ${latest.toFixed(1)}% of all listings`,
          body: `The share of Indeed postings mentioning AI moved from ${prev.toFixed(1)}% to ${latest.toFixed(1)}%. ${change > 0 ? "AI skills are becoming more mainstream in hiring requirements." : "Demand for explicitly AI-branded roles may be normalizing."}`,
          priority: severityScore("notable") + Math.abs(change),
          metric: "ai_job_share",
        });
      }
    }
  }

  // 14. Semiconductor production spike/drop
  if (data.ai?.semiconductor_production?.data?.length >= 2) {
    const semData = data.ai!.semiconductor_production.data;
    const latest = semData.at(-1)?.index as number;
    const prev = semData.at(-2)?.index as number;
    if (latest != null && prev != null && prev > 0) {
      const momPct = ((latest - prev) / prev) * 100;
      if (Math.abs(momPct) > 3) {
        const direction = momPct > 0 ? "surged" : "dropped";
        callouts.push({
          id: "semiconductor-production",
          severity: momPct > 5 || momPct < -5 ? "alert" : "notable",
          headline: `Semiconductor production ${direction} ${Math.abs(momPct).toFixed(1)}%`,
          body: `The semiconductor production index moved from ${prev.toFixed(1)} to ${latest.toFixed(1)}. ${momPct > 0 ? "Rising chip demand signals growing AI infrastructure investment." : "A pullback in chip production could signal cooling AI spending."}`,
          priority: severityScore(momPct > 5 || momPct < -5 ? "alert" : "notable") + Math.abs(momPct) * 0.3,
          metric: "semiconductor_production",
        });
      }
    }
  }

  // Sort by priority (highest first) and return top 5
  return callouts.sort((a, b) => b.priority - a.priority).slice(0, 5);
}

export function generateActions(data: BriefingData): Action[] {
  const actions: Action[] = [];
  const { analytics, labor, sectors } = data;

  // Helper to get latest values
  const yoyPct = (analytics.info_employment_yoy?.data.at(-1)?.yoy_pct as number) ?? null;
  const ratio = (analytics.info_openings_hires_ratio?.data.at(-1)?.ratio as number) ?? null;
  const quitsPct = (analytics.info_quits_rate?.data.at(-1)?.quits_pct as number) ?? null;
  const latestUnemp = labor.unemployment?.data.at(-1);
  const infoUnemp = (latestUnemp?.["Information Industry"] as number) ?? null;
  const natUnemp = (latestUnemp?.["National"] as number) ?? null;

  // Sector rank
  const sorted = sectors.rankings ? [...sectors.rankings].sort((a, b) => (b.yoy_pct ?? -999) - (a.yoy_pct ?? -999)) : [];
  const infoRank = sorted.findIndex((s) => s.sector === "Information") + 1;
  const totalSectors = sorted.length;

  // Layoffs spike
  const joltsData = labor.jolts_info?.data;
  let layoffsSpike = false;
  if (joltsData && joltsData.length >= 2) {
    const latest = joltsData.at(-1)?.["Layoffs"] as number;
    const prev = joltsData.at(-2)?.["Layoffs"] as number;
    if (latest != null && prev != null && prev > 0) {
      layoffsSpike = ((latest - prev) / prev) * 100 >= 15;
    }
  }

  // Unemployment trend
  const unempData = labor.unemployment?.data;
  let risingUnemp = false;
  if (unempData && unempData.length >= 3) {
    const vals = unempData.slice(-3).map((d) => d["Information Industry"] as number).filter((v) => v != null);
    risingUnemp = vals.length === 3 && vals[1] > vals[0] && vals[2] > vals[1];
  }

  // Career actions
  if (yoyPct != null && yoyPct < -2) {
    actions.push({
      id: "career-strengthen",
      category: "career",
      title: "Strengthen your position",
      body: `Tech employment is down ${Math.abs(yoyPct).toFixed(1)}% year-over-year. Focus on in-demand skills (AI/ML, cloud infrastructure, security). Update your resume and LinkedIn. Build relationships with recruiters before you need them.`,
    });
  }
  if (yoyPct != null && yoyPct > 2) {
    actions.push({
      id: "career-explore",
      category: "career",
      title: "Explore opportunities",
      body: `Tech employment grew ${yoyPct.toFixed(1)}% year-over-year. Companies are expanding. If you've been waiting for the right time to make a move, this is a strong hiring environment.`,
    });
  }
  if (ratio != null && ratio < 1.1) {
    actions.push({
      id: "career-competition",
      category: "career",
      title: "Competition is stiff",
      body: `With an openings-to-hires ratio of ${ratio.toFixed(2)}, every open role has plenty of applicants. Differentiate yourself: target niche skills, network directly with hiring managers, and tailor each application.`,
    });
  }
  if (ratio != null && ratio > 1.8) {
    actions.push({
      id: "career-leverage",
      category: "career",
      title: "Employers are desperate",
      body: `The ratio of ${ratio.toFixed(2)} openings per hire means employers can't fill roles fast enough. You have leverage — negotiate compensation, remote flexibility, and role scope.`,
    });
  }
  if (infoUnemp != null && natUnemp != null && infoUnemp > natUnemp) {
    actions.push({
      id: "career-underperform",
      category: "career",
      title: "Tech is underperforming",
      body: `Tech unemployment (${infoUnemp.toFixed(1)}%) exceeds the national rate (${natUnemp.toFixed(1)}%). Consider broadening your search to adjacent sectors that value tech skills — healthcare, fintech, and government are all hiring.`,
    });
  }
  if (layoffsSpike) {
    const latest = joltsData!.at(-1)?.["Layoffs"] as number;
    actions.push({
      id: "career-layoffs",
      category: "career",
      title: "Layoff wave in progress",
      body: `Tech layoffs spiked to ${latest.toFixed(0)}K this month. If your company is showing signs (hiring freezes, reorgs, missed targets), update your emergency fund and start networking now — don't wait for the email.`,
    });
  }

  // Market actions
  if (quitsPct != null && quitsPct < 1.5) {
    actions.push({
      id: "market-holding",
      category: "market",
      title: "Workers are holding tight",
      body: `The quits rate of ${quitsPct.toFixed(2)}% is below normal. Workers aren't confident enough to leave — a sign of caution across the industry. Expect less attrition on your team but also less movement in the market.`,
    });
  }
  if (quitsPct != null && quitsPct > 2.5) {
    actions.push({
      id: "market-reshuffle",
      category: "market",
      title: "The Great Reshuffle continues",
      body: `At ${quitsPct.toFixed(2)}%, voluntary quits are elevated. Workers feel confident moving. If you're hiring, expect counter-offers and higher salary expectations. If you're job-seeking, there's plenty of movement.`,
    });
  }

  // Watchlist actions
  if (infoRank > 0 && infoRank > totalSectors - 3) {
    actions.push({
      id: "watchlist-sector",
      category: "watchlist",
      title: "Watch the sector rankings",
      body: `Information is ranked #${infoRank} of ${totalSectors} sectors by YoY growth. Check the Growing Markets tab to see which sectors are outperforming — and whether your skills transfer.`,
    });
  }
  if (risingUnemp) {
    actions.push({
      id: "watchlist-trend",
      category: "watchlist",
      title: "Trend worth watching",
      body: `Tech unemployment has risen for 3+ consecutive months. It's not a crisis yet, but sustained increases often precede broader downturns. Keep an eye on next month's numbers.`,
    });
  }

  // Market actions (stock market)
  if (data.market?.stock_indices?.data?.length >= 2) {
    const mktData = data.market!.stock_indices.data;
    const latest = mktData.at(-1)?.["S&P 500"] as number;
    const prev = mktData.at(-2)?.["S&P 500"] as number;
    if (latest != null && prev != null && prev > 0) {
      const momPct = ((latest - prev) / prev) * 100;
      if (momPct < -5) {
        actions.push({
          id: "market-downturn",
          category: "market",
          title: "Market downturn in progress",
          body: `The S&P 500 dropped ${Math.abs(momPct).toFixed(1)}% last month. Market downturns often precede hiring freezes by 1-2 quarters. Review your financial position and equity exposure.`,
        });
      }
    }
  }

  if (data.layoffs?.by_industry?.length > 0) {
    const topIndustry = data.layoffs.by_industry[0];
    actions.push({
      id: "watchlist-layoffs",
      category: "watchlist",
      title: `Layoffs concentrated in ${topIndustry.industry}`,
      body: `${topIndustry.industry} leads with ${topIndustry.total.toLocaleString()} layoffs across ${topIndustry.companies} companies. Check if your sector or employer is affected.`,
    });
  }

  // Fallback: no significant triggers
  if (actions.length === 0) {
    actions.push({
      id: "info-steady",
      category: "info",
      title: "All clear — steady state",
      body: "No major signals this week. The labor market is in a holding pattern. Keep building skills and stay connected to your network — opportunities favor the prepared.",
    });
  }

  // Enforce limits: at least 1 career, max 2 per category, max 4 total
  const byCategory = new Map<ActionCategory, Action[]>();
  for (const a of actions) {
    const list = byCategory.get(a.category) || [];
    list.push(a);
    byCategory.set(a.category, list);
  }

  const result: Action[] = [];
  // First pass: take up to 2 from each category
  for (const [, list] of byCategory) {
    result.push(...list.slice(0, 2));
  }

  return result.slice(0, 4);
}

// Get the top 3 gaining and top 3 declining sectors by YoY
export function getSectorMovers(sectors: SectorsData): {
  gainers: SectorRanking[];
  decliners: SectorRanking[];
} {
  const sorted = [...sectors.rankings]
    .filter((s) => s.yoy_pct != null)
    .sort((a, b) => (b.yoy_pct ?? 0) - (a.yoy_pct ?? 0));

  return {
    gainers: sorted.slice(0, 3),
    decliners: sorted.slice(-3).reverse(),
  };
}

// Get the latest data date from labor data
export function getDataFreshness(labor: Record<string, SeriesGroup>): string {
  const latestDate = labor.tech_employment?.data.at(-1)?.date as string;
  if (!latestDate) return "Unknown";
  // Parse as YYYY-MM-DD parts to avoid timezone shift (dates are UTC but toLocaleDateString uses local tz)
  const [year, month] = latestDate.split("-");
  const monthName = new Date(Number(year), Number(month) - 1).toLocaleDateString("en-US", { month: "long" });
  return `${monthName} ${year}`;
}

// Determine which chart to spotlight based on the top callout
export function getSpotlightMetric(callouts: Callout[]): string | null {
  if (callouts.length === 0) return null;
  return callouts[0].metric ?? null;
}
