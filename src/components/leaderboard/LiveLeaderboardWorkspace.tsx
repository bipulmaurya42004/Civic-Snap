"use client";

import { useEffect, useMemo, useState } from "react";
import type { ContributorProfile, PublicIssueRecord } from "@/types/civic";
import { deriveLeaderboard } from "@/lib/civic-logic";
import {
  fetchOptInPublicProfiles,
  fetchPublicReports,
} from "@/lib/firebase-reports";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { LoadingState } from "@/components/ui/StateViews";

export function LiveLeaderboardWorkspace() {
  const [issues, setIssues] = useState<PublicIssueRecord[]>([]);
  const [profiles, setProfiles] = useState<ContributorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchPublicReports(), fetchOptInPublicProfiles()])
      .then(([publicReports, publicProfiles]) => {
        if (!cancelled) {
          setIssues(publicReports);
          setProfiles(publicProfiles);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load live Firestore leaderboard standings right now.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const entries = useMemo(
    () => deriveLeaderboard(issues, profiles),
    [issues, profiles]
  );

  if (loading) {
    return (
      <LoadingState
        label="Loading opt-in contributor standings from Firestore..."
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
      <LeaderboardTable entries={entries} />
    </div>
  );
}
