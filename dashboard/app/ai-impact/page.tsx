"use client";
import { useData } from "../components/DataProvider";
import BackNav from "../components/BackNav";
import AIImpactTab from "../components/AIImpactTab";

export default function AIImpactPage() {
  const data = useData();
  if (!data) return null;
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <BackNav title="AI Release Impact" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <AIImpactTab eventStudy={data.eventStudy} />
      </main>
    </div>
  );
}
