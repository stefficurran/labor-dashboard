"use client";

import { useData } from "../components/DataProvider";
import BackNav from "../components/BackNav";
import GrowthTab from "../components/GrowthTab";

export default function GrowthPage() {
  const data = useData();
  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <BackNav title="Growing Markets" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <GrowthTab sectors={data.sectors} />
      </main>
    </div>
  );
}
