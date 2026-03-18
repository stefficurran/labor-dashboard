"use client";

import { useData } from "../components/DataProvider";
import BackNav from "../components/BackNav";
import CorrelationTab from "../components/CorrelationTab";

export default function CorrelationPage() {
  const data = useData();
  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <BackNav title="Cross-Source Correlation" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <CorrelationTab correlation={data.correlation} />
      </main>
    </div>
  );
}
