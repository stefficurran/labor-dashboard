import { Callout, Severity } from "./briefing-utils";

const SEVERITY_STYLES: Record<Severity, { border: string; icon: string; iconBg: string }> = {
  alert: {
    border: "border-red-500/40",
    icon: "!",
    iconBg: "bg-red-500/20 text-red-400",
  },
  notable: {
    border: "border-amber-500/40",
    icon: "~",
    iconBg: "bg-amber-500/20 text-amber-400",
  },
  info: {
    border: "border-blue-500/40",
    icon: "i",
    iconBg: "bg-blue-500/20 text-blue-400",
  },
};

export default function CalloutCard({ callout }: { callout: Callout }) {
  const style = SEVERITY_STYLES[callout.severity];

  return (
    <div className={`rounded-xl bg-gray-900 border-l-4 ${style.border} border border-gray-800 p-4 sm:p-5`}>
      <div className="flex items-start gap-3">
        <span
          className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${style.iconBg}`}
        >
          {style.icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-sm sm:text-base font-semibold text-white leading-snug">
            {callout.headline}
          </h3>
          <p className="text-sm text-gray-400 mt-1 leading-relaxed">
            {callout.body}
          </p>
        </div>
      </div>
    </div>
  );
}
