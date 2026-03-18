"use client";
import { useData } from "../components/DataProvider";
import BackNav from "../components/BackNav";
import AITab from "../components/AITab";

export default function AIPage() {
  const data = useData();
  if (!data) return null;
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <BackNav title="AI Across Industries" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <AITab ai={data.ai} />
      </main>
    </div>
  );
}
