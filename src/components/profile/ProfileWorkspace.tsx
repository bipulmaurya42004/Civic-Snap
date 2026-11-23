"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Award,
  Camera,
  CheckCircle2,
  Gift,
  Loader2,
  LogOut,
  MapPin,
  RefreshCw,
  Save,
  Sparkles,
  Trophy,
  User,
} from "lucide-react";
import { useFirebaseAuth } from "@/components/providers/FirebaseAuthProvider";
import {
  fetchMyReports,
  type StoredPrivateReport,
} from "@/lib/firebase-reports";
import { fetchMyRewardRedemptions } from "@/lib/firebase-users";
import {
  formatCivicDate,
  getCategoryLabel,
  getCivicLevelBadge,
  POINTS_PER_ACCEPTED_REPORT,
  POINTS_PER_RESOLVED_REPORT,
} from "@/lib/civic-logic";
import { CivicBadgeChip } from "@/components/ui/CivicBadgeChip";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { EmptyState, LoadingState } from "@/components/ui/StateViews";
import type { RewardRedemptionRecord } from "@/types/civic";

const BADGE_TIERS_GUIDE = [
  { label: "Bronze", title: "Street Watcher", range: "0 – 50 pts" },
  { label: "Silver", title: "Eco Warrior", range: "51 – 200 pts" },
  { label: "Gold", title: "City Guardian", range: "200+ pts" },
] as const;

export function ProfileWorkspace() {
  const {
    user,
    profile,
    displayAlias,
    authReady,
    busy,
    errorMessage,
    statusMessage,
    saveProfilePreferences,
    refreshProfile,
    signOutUser,
  } = useFirebaseAuth();

  const [aliasInput, setAliasInput] = useState("");
  const [optInInput, setOptInInput] = useState(false);
  const [reports, setReports] = useState<StoredPrivateReport[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemptionRecord[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (profile) {
      setAliasInput(profile.alias);
      setOptInInput(profile.leaderboardOptIn);
    } else if (displayAlias) {
      setAliasInput(displayAlias);
    }
  }, [profile, displayAlias]);

  useEffect(() => {
    if (!authReady || !user) {
      setReports([]);
      setRedemptions([]);
      return;
    }

    let cancelled = false;
    setReportsLoading(true);
    setReportsError(null);

    Promise.all([
      fetchMyReports(user.uid),
      fetchMyRewardRedemptions(user.uid).catch(() => []),
    ])
      .then(([reportItems, redemptionItems]) => {
        if (!cancelled) {
          setReports(reportItems);
          setRedemptions(redemptionItems);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReportsError(
            "Could not load your saved civic reports right now."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setReportsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authReady, user]);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveProfilePreferences({
      alias: aliasInput,
      leaderboardOptIn: optInInput,
    });
  };

  const handleRefreshPoints = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      await refreshProfile();
      const [latestReports, latestRedemptions] = await Promise.all([
        fetchMyReports(user.uid),
        fetchMyRewardRedemptions(user.uid).catch(() => []),
      ]);
      setReports(latestReports);
      setRedemptions(latestRedemptions);
    } finally {
      setRefreshing(false);
    }
  };

  if (!authReady) {
    return <LoadingState label="Loading your CivicSnap profile..." rows={3} />;
  }

  if (!user) {
    return (
      <div className="mt-6">
        <EmptyState
          icon={<User size={20} aria-hidden="true" />}
          title="Sign in to view your CivicPoints, Level Badge & reports"
          description="Sign in with your CivicSnap account to track your CivicPoints balance (+10 Accepted, +25 Resolved), unlock Street Watcher / Eco Warrior / City Guardian badges, and redeem local merchant rewards."
          primaryAction={{ label: "Sign In", href: "/login?next=%2Fprofile" }}
          secondaryAction={{
            label: "Create Account",
            href: "/signup?next=%2Fprofile",
          }}
        />
      </div>
    );
  }

  const civicPoints = profile?.civicPoints ?? 0;
  const acceptedCount =
    profile?.acceptedReportsCount ??
    reports.filter((r) => r.reviewState === "accepted").length;
  const resolvedCount =
    profile?.resolvedReportsCount ??
    reports.filter(
      (r) => r.reviewState === "accepted" && r.status === "resolved"
    ).length;
  const levelBadge = getCivicLevelBadge(civicPoints);

  return (
    <div className="mt-6 space-y-6">
      {/* CivicPoints & Level Badge Hero Card */}
      <section
        aria-label="CivicPoints and Level Badge"
        className="rounded-[20px] border border-slate-200 bg-white p-6"
      >
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <CivicBadgeChip badge={levelBadge} size="md" />
              <button
                type="button"
                onClick={() => void handleRefreshPoints()}
                disabled={refreshing}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                <RefreshCw
                  size={13}
                  className={refreshing ? "animate-spin" : ""}
                  aria-hidden="true"
                />
                <span>Sync Live Points</span>
              </button>
            </div>
            <p className="max-w-xl text-sm leading-6 text-slate-600">
              {levelBadge.tagline} Earn{" "}
              <strong className="font-semibold text-slate-900">
                +{POINTS_PER_ACCEPTED_REPORT} pts
              </strong>{" "}
              for every Accepted report and{" "}
              <strong className="font-semibold text-slate-900">
                +{POINTS_PER_RESOLVED_REPORT} pts
              </strong>{" "}
              for every Resolved report.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 px-5 py-3.5 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#2563EB]">
                CivicPoints Balance
              </p>
              <p className="mt-0.5 font-mono text-3xl font-bold tabular-nums text-slate-900">
                {civicPoints}{" "}
                <span className="text-sm font-semibold text-slate-500">pts</span>
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Link
                href="/rewards"
                className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] whitespace-nowrap"
              >
                <Gift size={14} aria-hidden="true" />
                <span>Open Rewards Store</span>
              </Link>
              <Link
                href="/leaderboard"
                className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap"
              >
                <Trophy size={14} aria-hidden="true" />
                <span>View Leaderboard</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Next Tier Progress Bar & Tier Breakdown */}
        <div className="mt-6 border-t border-slate-100 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-700">
              {levelBadge.nextTierLabel
                ? `${levelBadge.pointsToNext} more pts to reach ${levelBadge.nextTierLabel}`
                : "Maximum civic tier unlocked — Gold (City Guardian)"}
            </span>
            <span className="font-mono font-semibold text-slate-500">
              {acceptedCount} accepted · {resolvedCount} resolved
            </span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#2563EB] to-[#10B981] transition-all"
              style={{ width: `${levelBadge.progressPercent}%` }}
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {BADGE_TIERS_GUIDE.map((item) => {
              const isCurrent =
                item.label.toLowerCase() === levelBadge.tier;
              return (
                <div
                  key={item.label}
                  className={`rounded-xl border px-3.5 py-2.5 text-xs ${
                    isCurrent
                      ? "border-[#2563EB] bg-blue-50/50 text-slate-900"
                      : "border-slate-200 bg-slate-50/60 text-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span>
                      {item.label} · {item.title}
                    </span>
                    {isCurrent && (
                      <span className="text-[11px] font-bold text-[#2563EB]">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                    {item.range}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Preferences Panel */}
        <section className="rounded-[18px] border border-slate-200 bg-white p-6 lg:col-span-5">
          <h2 className="text-base font-semibold text-slate-900">
            Profile preferences
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Signed in as{" "}
            <strong className="text-slate-700">{user.email}</strong>
          </p>

          <form onSubmit={handleSave} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="profile-alias"
                className="mb-1.5 block text-xs font-medium text-slate-700"
              >
                Display alias
              </label>
              <input
                id="profile-alias"
                type="text"
                minLength={2}
                maxLength={40}
                required
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              />
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <input
                id="profile-optin"
                type="checkbox"
                checked={optInInput}
                onChange={(e) => setOptInInput(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-[#2563EB]"
              />
              <label
                htmlFor="profile-optin"
                className="text-xs leading-5 text-slate-600"
              >
                Show my alias, Level Badge, and CivicPoints on the public
                leaderboard (opt-in only).
              </label>
            </div>

            {errorMessage && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
              >
                {errorMessage}
              </p>
            )}

            {statusMessage && (
              <p
                role="status"
                className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800"
              >
                <CheckCircle2 size={14} aria-hidden="true" />
                <span>{statusMessage}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-60"
            >
              {busy ? (
                <Loader2
                  size={15}
                  className="animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Save size={15} aria-hidden="true" />
              )}
              <span>Save Preferences</span>
            </button>

            <button
              type="button"
              onClick={() => void signOutUser()}
              disabled={busy}
              className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <LogOut size={15} aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </form>

          {redemptions.length > 0 && (
            <div className="mt-6 border-t border-slate-100 pt-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Recent Reward Vouchers ({redemptions.length})
                </h3>
                <Link
                  href="/rewards"
                  className="text-xs font-semibold text-[#2563EB] hover:underline"
                >
                  View Store
                </Link>
              </div>
              <ul className="mt-3 space-y-2">
                {redemptions.slice(0, 3).map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {item.rewardTitle}
                      </p>
                      <p className="font-mono text-[11px] text-slate-500">
                        {item.couponCode}
                      </p>
                    </div>
                    <span className="font-mono font-semibold text-slate-700">
                      -{item.pointsSpent} pts
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Submitted Reports Panel */}
        <section className="space-y-4 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Your Submitted Reports ({reports.length})
              </h2>
              <p className="text-xs text-slate-500">
                Private photos and optional coordinates remain visible only to
                you and authorised CivicSnap project admins.
              </p>
            </div>
            <Link
              href="/report"
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#2563EB] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8]"
            >
              <Camera size={14} aria-hidden="true" />
              <span>New Report</span>
            </Link>
          </div>

          {reportsLoading ? (
            <LoadingState label="Loading your submitted reports..." rows={2} />
          ) : reportsError ? (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {reportsError}
            </p>
          ) : reports.length === 0 ? (
            <EmptyState
              icon={<Award size={20} aria-hidden="true" />}
              title="No reports submitted yet"
              description="Snap a local civic issue to submit your first report on CivicSnap and start earning CivicPoints."
              primaryAction={{ label: "Report an Issue", href: "/report" }}
              secondaryAction={{ label: "Explore Rewards", href: "/rewards" }}
            />
          ) : (
            <ul className="space-y-3">
              {reports.map((report) => (
                <li
                  key={report.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-500">
                      {report.id}
                    </span>
                    <div className="flex items-center gap-2">
                      {report.pointsAwarded > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-0.5 font-mono text-xs font-semibold text-[#2563EB]">
                          <Sparkles size={11} aria-hidden="true" />
                          +{report.pointsAwarded} pts
                        </span>
                      )}
                      <StatusIndicator status={report.status} size="sm" />
                    </div>
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-slate-900">
                    {report.title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {report.description}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={13} aria-hidden="true" />
                      {report.locality}
                    </span>
                    <span>{getCategoryLabel(report.category)}</span>
                    <span>
                      Submitted {formatCivicDate(report.createdAtIso)}
                    </span>
                    <span className="capitalize">
                      Review: {report.reviewState}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
