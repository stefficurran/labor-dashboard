export type EventCategory =
  | "economic_crisis"
  | "tech_layoffs"
  | "hiring_boom"
  | "policy"
  | "industry_shift"
  | "company_event"
  | "ai_release";

export interface LaborEvent {
  id: string;
  date: string; // "YYYY-MM-01" aligned to labor data months
  title: string;
  description: string;
  category: EventCategory;
  impact: "major" | "moderate";
}

export const CATEGORY_COLORS: Record<EventCategory, string> = {
  economic_crisis: "#ef4444", // red
  tech_layoffs: "#f59e0b", // amber
  hiring_boom: "#10b981", // emerald
  policy: "#8b5cf6", // violet
  industry_shift: "#3b82f6", // blue
  company_event: "#ec4899", // pink
  ai_release: "#06b6d4", // cyan
};

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  economic_crisis: "Economic Crisis",
  tech_layoffs: "Tech Layoffs",
  hiring_boom: "Hiring Boom",
  policy: "Policy",
  industry_shift: "Industry Shift",
  company_event: "Company Event",
  ai_release: "AI Release",
};
