"use client";

import { useData } from "../components/DataProvider";
import BackNav from "../components/BackNav";
import LayoffsTab from "../components/LayoffsTab";

export default function LayoffsPage() {
  const data = useData();
  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <BackNav title="Layoffs" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <LayoffsTab layoffs={data.layoffs} />
      </main>
    </div>
  );
}
