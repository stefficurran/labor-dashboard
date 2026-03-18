"use client";
import { useData } from "../components/DataProvider";
import EventsImpactTab from "../components/EventsImpactTab";
import BackNav from "../components/BackNav";

export default function EventsPage() {
  const data = useData();
  if (!data) return <div className="text-gray-400 p-8">Loading...</div>;
  return (
    <div className="min-h-screen bg-gray-950 p-4 sm:p-8">
      <BackNav title="Events & Impact" />
      <EventsImpactTab
        labor={data.labor}
        events={data.events}
        eventStudy={data.eventStudy}
      />
    </div>
  );
}
