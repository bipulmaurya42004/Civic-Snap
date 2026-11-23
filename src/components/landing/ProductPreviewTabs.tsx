"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DEMO_ISSUES, DEMO_PROFILES } from "@/lib/demo-data";
import { DEMO_LOCALITIES } from "@/types/civic";
import { deriveLeaderboard } from "@/lib/civic-logic";
import { IssueCard } from "@/components/issues/IssueCard";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";

type PreviewTab = "issues" | "dashboard" | "leaderboard";

const TABS: Array<{ id: PreviewTab; label: string; demoHref: string }> = [
  { id: "issues", label: "Public Issue Tracker", demoHref: "/demo" },
  {
    id: "dashboard",
    label: "Area Dashboard",
    demoHref: "/demo?tab=dashboard",
  },
  {
    id: "leaderboard",
    label: "Citizen Leaderboard",
    demoHref: "/demo?tab=leaderboard",
  },
];

export function ProductPreviewTabs() {
  const [activeTab, setActiveTab] = useState<PreviewTab>("issues");

  const demoLeaderboard = useMemo(
    () => deriveLeaderboard(DEMO_ISSUES, DEMO_PROFILES),
    []
  );

  const currentTabMeta = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  return (
    <div className="space-y-6">
      {/* Tab switcher + Demo disclaimer */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label="Live application component previews"
          className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1"
        >
          {TABS.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                id={`preview-tab-${tab.id}`}
                aria-selected={isSelected}
                aria-controls={`preview-panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[40px] rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap sm:text-sm ${
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

        <div className="flex items-center gap-3 text-xs">
          <span className="font-semibold text-[#C2410C]">
            Demo preview · Sample data
          </span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <Link
            href={currentTabMeta.demoHref}
            className="inline-flex items-center gap-1 font-semibold text-[#2563EB] hover:text-[#1D4ED8] whitespace-nowrap"
          >
            <span>Open full demo</span>
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Active Panel rendering genuine app components */}
      <div
        id={`preview-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`preview-tab-${activeTab}`}
      >
        {activeTab === "issues" && (
          <div className="grid gap-4 md:grid-cols-2">
            {DEMO_ISSUES.slice(0, 4).map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        )}

        {activeTab === "dashboard" && (
          <DashboardOverview
            issues={DEMO_ISSUES}
            areas={DEMO_LOCALITIES}
            isDemo
            compact
          />
        )}

        {activeTab === "leaderboard" && (
          <LeaderboardTable entries={demoLeaderboard} isDemo />
        )}
      </div>
    </div>
  );
}
