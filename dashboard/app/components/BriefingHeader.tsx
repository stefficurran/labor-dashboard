interface BriefingHeaderProps {
  dataDate: string; // e.g. "February 2026"
}

export default function BriefingHeader({ dataDate }: BriefingHeaderProps) {
  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
        Weekly Labor Briefing
      </h1>
      <p className="text-gray-400 mt-1 text-sm sm:text-base">
        U.S. tech labor market intelligence · Data through {dataDate}
      </p>
      <p className="text-gray-500 mt-0.5 text-xs">
        Information sector = software, data processing, telecom, cloud, streaming (NAICS 51)
      </p>
    </div>
  );
}
