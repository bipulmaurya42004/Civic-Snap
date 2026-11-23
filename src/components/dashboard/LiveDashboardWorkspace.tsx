"use client";

import { useEffect, useState } from "react";
import { PILOT_LOCALITIES, type PublicIssueRecord } from "@/types/civic";
import { fetchPublicReports } from "@/lib/firebase-reports";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { LoadingState } from "@/components/ui/StateViews";

export function LiveDashboardWorkspace() {
  const [issues, setIssues] = useState<PublicIssueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPublicReports()
      .then((records) => {
        if (!cancelled) setIssues(records);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load live Firestore dashboard metrics right now.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <LoadingState
        label="Loading live CivicSnap Firestore metrics..."
        rows={3}
      />
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {error}
        </p>
      )}
      <DashboardOverview issues={issues} areas={PILOT_LOCALITIES} />
    </div>
  );
}
