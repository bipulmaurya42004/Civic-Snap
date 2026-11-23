"use client";

import { useEffect, useState } from "react";
import { PILOT_LOCALITIES, type PublicIssueRecord } from "@/types/civic";
import { fetchPublicReports } from "@/lib/firebase-reports";
import { IssueBrowser } from "@/components/issues/IssueBrowser";
import { LoadingState } from "@/components/ui/StateViews";

export function LiveIssuesWorkspace() {
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
          setError(
            "Unable to fetch approved public reports right now."
          );
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
        label="Loading approved public civic reports..."
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
      <IssueBrowser
        issues={issues}
        areas={PILOT_LOCALITIES}
        emptyTitle="No approved public reports yet"
        emptyDescription="Submit a civic issue after signing in—once a staff reviewer approves its public summary, it will appear here automatically. You can also explore sample records in Demo Mode."
      />
    </div>
  );
}
