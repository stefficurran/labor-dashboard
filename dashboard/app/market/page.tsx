"use client";

import { useData } from "../components/DataProvider";
import BackNav from "../components/BackNav";
import MarketTab from "../components/MarketTab";

export default function MarketPage() {
  const data = useData();
  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <BackNav title="Stock Market" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <MarketTab market={data.market} />
      </main>
    </div>
  );
}
