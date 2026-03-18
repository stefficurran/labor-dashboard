import Link from "next/link";

interface NavItem {
  href: string;
  title: string;
  description: string;
}

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Labor & Markets",
    items: [
      { href: "/tech", title: "Tech Sector", description: "Employment, JOLTS, openings/hires ratio, quits rate" },
      { href: "/growth", title: "Growing Markets", description: "17-sector rankings, indexed comparisons" },
      { href: "/market", title: "Stock Market", description: "S&P 500, NASDAQ, employment overlays" },
      { href: "/layoffs", title: "Layoffs", description: "Tech layoff trends by company and industry" },
      { href: "/correlation", title: "Cross-Source", description: "Market vs employment, layoffs vs JOLTS" },
    ],
  },
  {
    label: "AI",
    items: [
      { href: "/ai", title: "AI Across Industries", description: "Job trends, investment, sector adoption" },
      { href: "/ai-impact", title: "AI Release Impact", description: "How model releases move markets" },
      { href: "/news", title: "News & Events", description: "Historical timeline, live news search" },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/share", title: "Share Cards", description: "Download promo cards for text or social" },
    ],
  },
];

export default function DeepDiveNav() {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-200 mb-4">Deep Dive</h2>
      <div className="space-y-4">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{group.label}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {group.items.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className="text-left rounded-xl border bg-gray-900 border-gray-800 hover:border-gray-700 hover:bg-gray-800/50 p-4 sm:p-5 transition-colors"
                >
                  <h3 className="text-sm font-semibold text-white">{t.title}</h3>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">{t.description}</p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
