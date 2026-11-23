"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Sparkles, Database } from "lucide-react";
import { useFirebaseAuth } from "@/components/providers/FirebaseAuthProvider";
import { AdminWorkspace } from "@/components/admin/AdminWorkspace";
import { JudgeDemoWorkspace } from "@/components/admin/JudgeDemoWorkspace";
import { LoadingState } from "@/components/ui/StateViews";

type DashboardTab = "judge" | "live";

export function AdminRouterClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAdmin, authReady } = useFirebaseAuth();

  const isJudgeQuery = searchParams.get("mode") === "judge";
  const [activeTab, setActiveTab] = useState<DashboardTab>(
    isJudgeQuery ? "judge" : "judge"
  );
  const [hasUserPickedTab, setHasUserPickedTab] = useState(false);

  // Respect ?mode=judge explicitly; otherwise default authorised admins to Live Firestore Queue
  // and default guests/judges to Judge Demo Mode so the dashboard is always rich and interactive.
  useEffect(() => {
    if (isJudgeQuery) {
      setActiveTab("judge");
      return;
    }
    if (authReady && !hasUserPickedTab) {
      setActiveTab(isAdmin ? "live" : "judge");
    }
  }, [isJudgeQuery, authReady, isAdmin, hasUserPickedTab]);

  const handleSwitchTab = (next: DashboardTab) => {
    setHasUserPickedTab(true);
    setActiveTab(next);
    if (next === "judge" && !isJudgeQuery) {
      router.replace("/admin?mode=judge", { scroll: false });
    } else if (next === "live" && isJudgeQuery) {
      router.replace("/admin", { scroll: false });
    }
  };

  if (!authReady && !isJudgeQuery) {
    return (
      <div className="mt-6">
        <LoadingState
          label="Loading CivicSnap verification dashboard..."
          rows={3}
        />
      </div>
    );
  }

  return (
    <div className="mt-6">
      {/* Clean Light SaaS Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm">
        <div
          role="tablist"
          aria-label="Dashboard verification mode"
          className="inline-flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100/90 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "judge"}
            onClick={() => handleSwitchTab("judge")}
            className={`inline-flex min-h-[38px] items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all sm:text-sm ${
              activeTab === "judge"
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Sparkles size={15} aria-hidden="true" />
            <span>AI Audit Queue</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "live"}
            onClick={() => handleSwitchTab("live")}
            className={`inline-flex min-h-[38px] items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all sm:text-sm ${
              activeTab === "live"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Database size={15} aria-hidden="true" />
            <span>Municipal Operations Console</span>
          </button>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
            isAdmin
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          <ShieldCheck size={13} aria-hidden="true" />
          {isAdmin
            ? "Authorised Staff Session Active"
            : "Read-Only Mode · Staff Required to Approve"}
        </span>
      </div>

      {activeTab === "judge" ? (
        <JudgeDemoWorkspace />
      ) : (
        <div className="mt-6">
          <AdminWorkspace />
        </div>
      )}
    </div>
  );
}
