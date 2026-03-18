"use client";

import { useData } from "../components/DataProvider";
import BackNav from "../components/BackNav";
import TechTab from "../components/TechTab";

export default function TechPage() {
  const data = useData();
  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <BackNav title="Tech Sector" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <TechTab labor={data.labor} analytics={data.analytics} />
      </main>
    </div>
  );
}
