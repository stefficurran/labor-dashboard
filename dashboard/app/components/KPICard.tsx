export default function KPICard({
  label,
  value,
  subvalue,
  trend,
}: {
  label: string;
  value: string;
  subvalue: string;
  trend?: "up" | "down";
}) {
  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 sm:p-5">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl sm:text-3xl font-bold mt-2 text-white">{value}</p>
      <p
        className={`text-sm mt-1 ${
          trend === "up"
            ? "text-emerald-400"
            : trend === "down"
            ? "text-red-400"
            : "text-gray-400"
        }`}
      >
        {subvalue}
      </p>
    </div>
  );
}
