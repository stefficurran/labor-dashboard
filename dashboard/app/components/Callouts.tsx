import { Callout } from "./briefing-utils";
import CalloutCard from "./CalloutCard";

export default function Callouts({ callouts }: { callouts: Callout[] }) {
  if (callouts.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-200">What Changed</h2>
      {callouts.map((c) => (
        <CalloutCard key={c.id} callout={c} />
      ))}
    </div>
  );
}
