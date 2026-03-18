interface ActionCardProps {
  action: {
    id: string;
    category: string;
    title: string;
    body: string;
  };
  confidence?: "high" | "medium" | "low";
  aiGenerated?: boolean;
}

const CATEGORY_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  career: {
    label: "Career",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  market: {
    label: "Market",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  watchlist: {
    label: "Watchlist",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  info: {
    label: "Info",
    color: "text-gray-400",
    bg: "bg-gray-500/10",
  },
  prediction: {
    label: "Prediction",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
};

const DEFAULT_STYLE = { label: "Info", color: "text-gray-400", bg: "bg-gray-500/10" };

export default function ActionCard({ action, confidence, aiGenerated }: ActionCardProps) {
  const style = CATEGORY_STYLES[action.category] || DEFAULT_STYLE;

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 sm:p-5">
      <span
        className={`inline-block text-xs font-medium uppercase tracking-wide px-2 py-0.5 rounded ${style.bg} ${style.color} mb-2`}
      >
        {style.label}
      </span>
      <h3 className="text-sm sm:text-base font-semibold text-white mb-1">
        {action.title}
      </h3>
      <p className="text-sm text-gray-400 leading-relaxed">
        {action.body}
      </p>
      {(confidence || aiGenerated) && (
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-800/50">
          {confidence && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <span className={`w-1.5 h-1.5 rounded-full ${
                confidence === "high" ? "bg-emerald-400" : confidence === "medium" ? "bg-amber-400" : "bg-gray-500"
              }`} />
              {confidence} confidence
            </span>
          )}
          {aiGenerated && (
            <span className="text-xs text-gray-600 ml-auto">AI-generated</span>
          )}
        </div>
      )}
    </div>
  );
}
