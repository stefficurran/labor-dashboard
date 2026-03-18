interface SectorRanking {
  series_id: string;
  sector: string;
  latest_value: number;
  yoy_pct: number | null;
  yoy_change: number | null;
  three_year_pct: number | null;
  five_year_pct: number | null;
}

interface SectorMoversProps {
  gainers: SectorRanking[];
  decliners: SectorRanking[];
}

function MoverRow({ sector, isGainer }: { sector: SectorRanking; isGainer: boolean }) {
  const pct = sector.yoy_pct ?? 0;
  const maxBar = 5; // cap bar width at 5% for visual consistency
  const barWidth = Math.min(Math.abs(pct) / maxBar * 100, 100);

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-sm text-gray-200 flex-1 min-w-0 truncate">{sector.sector}</span>
      <div className="w-20 sm:w-28 flex-shrink-0">
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${isGainer ? "bg-emerald-500" : "bg-red-500"}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>
      <span
        className={`text-sm font-medium w-16 text-right flex-shrink-0 ${
          isGainer ? "text-emerald-400" : "text-red-400"
        }`}
      >
        {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
      </span>
    </div>
  );
}

export default function SectorMovers({ gainers, decliners }: SectorMoversProps) {
  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-gray-200 mb-3">Sector Movers</h2>
      <p className="text-xs text-gray-500 mb-3">Year-over-year employment growth</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
        <div>
          <p className="text-xs font-medium text-emerald-400 uppercase tracking-wide mb-1">Top Gainers</p>
          <div className="divide-y divide-gray-800/50">
            {gainers.map((s) => (
              <MoverRow key={s.series_id} sector={s} isGainer />
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-red-400 uppercase tracking-wide mb-1">Biggest Decliners</p>
          <div className="divide-y divide-gray-800/50">
            {decliners.map((s) => (
              <MoverRow key={s.series_id} sector={s} isGainer={false} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
