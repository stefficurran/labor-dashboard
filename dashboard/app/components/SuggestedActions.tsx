"use client";

import { useState } from "react";
import { Action } from "./briefing-utils";
import ActionCard from "./ActionCard";

interface AiAction {
  id: string;
  category: string;
  title: string;
  body: string;
  confidence: "high" | "medium" | "low";
  data_points: string[];
}

interface AiActionsData {
  generated_at: string;
  actions: AiAction[];
}

interface SuggestedActionsProps {
  actions: Action[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aiActions?: AiActionsData | null;
}

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (isNaN(diffMs) || diffMs < 0) return "just now";

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

export default function SuggestedActions({ actions, aiActions }: SuggestedActionsProps) {
  const [expanded, setExpanded] = useState(false);

  const useAi = aiActions && aiActions.actions && aiActions.actions.length > 0;

  // Build a unified list of action cards
  const allActions: {
    id: string;
    category: string;
    title: string;
    body: string;
    confidence?: "high" | "medium" | "low";
    aiGenerated: boolean;
  }[] = useAi
    ? aiActions.actions.map((a) => ({
        id: a.id,
        category: a.category,
        title: a.title,
        body: a.body,
        confidence: a.confidence,
        aiGenerated: true,
      }))
    : actions.map((a) => ({
        id: a.id,
        category: a.category,
        title: a.title,
        body: a.body,
        aiGenerated: false,
      }));

  if (allActions.length === 0) return null;

  const displayActions = expanded ? allActions : allActions.slice(0, 3);
  const hasMore = allActions.length > 3;

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="text-lg font-semibold text-gray-200">What To Do</h2>
        {useAi && (
          <span className="text-xs text-gray-500">
            Powered by AI &middot; Generated {getRelativeTime(aiActions.generated_at)}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {displayActions.map((a) => (
          <ActionCard
            key={a.id}
            action={{ id: a.id, category: a.category, title: a.title, body: a.body }}
            confidence={a.confidence}
            aiGenerated={a.aiGenerated}
          />
        ))}
      </div>
      {hasMore && (
        <div className="text-center mt-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            {expanded ? "Show less" : `See all ${allActions.length} insights`}
          </button>
        </div>
      )}
    </div>
  );
}
