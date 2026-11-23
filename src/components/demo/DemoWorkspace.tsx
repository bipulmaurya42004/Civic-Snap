"use client";

import { useMemo, useState } from "react";
import { DEMO_ISSUES, DEMO_PROFILES } from "@/lib/demo-data";
import { DEMO_LOCALITIES } from "@/types/civic";
import { deriveLeaderboard } from "@/lib/civic-logic";
import { IssueBrowser } from "@/components/issues/IssueBrowser";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";

export type DemoTabKey = "issues" | "dashboard" | "leaderboard";

interface DemoWorkspaceProps {
  initialTab?: DemoTabKey;
}

const DEMO_TABS: Array<{ id: DemoTabKey; label: string }> = [
  { id: "issues", label: "Sample Issues" },
  { id: "dashboard", label: "Sample Dashboard" },
  { id: "leaderboard", label: "Sample Leaderboard" },
];

export function DemoWorkspace({ initialTab = "issues" }: DemoWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<DemoTabKey>(initialTab);

  const demoLeaderboard = useMemo(
    () => deriveLeaderboard(DEMO_ISSUES, DEMO_PROFILES),
    []
  );

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Read-only demo sections"
        className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/90 p-1"
      >
        {DEMO_TABS.map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`demo-tab-${tab.id}`}
              aria-selected={isSelected}
              aria-controls={`demo-panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[42px] rounded-lg px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
                isSelected
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        id={`demo-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`demo-tab-${activeTab}`}
      >
        {activeTab === "issues" && (
          <IssueBrowser
            issues={DEMO_ISSUES}
            areas={DEMO_LOCALITIES}
            isDemo
            pageSize={4}
          />
        )}

        {activeTab === "dashboard" && (
          <DashboardOverview
            issues={DEMO_ISSUES}
            areas={DEMO_LOCALITIES}
            isDemo
          />
        )}

        {activeTab === "leaderboard" && (
          <LeaderboardTable entries={demoLeaderboard} isDemo />
        )}
      </div>
    </div>
  );
}
