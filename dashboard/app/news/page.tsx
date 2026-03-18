"use client";

import { useData } from "../components/DataProvider";
import BackNav from "../components/BackNav";
import NewsEventsTab from "../components/NewsEventsTab";

export default function NewsPage() {
  const data = useData();
  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <BackNav title="News & Events" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <NewsEventsTab labor={data.labor} events={data.events} />
      </main>
    </div>
  );
}
