"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Award,
  Camera,
  CheckCircle2,
  Crown,
  FileCheck2,
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
import {
  formatCivicDate,
  getCategoryLabel,
  POINTS_PER_ACCEPTED_REPORT,
  POINTS_PER_RESOLVED_REPORT,
} from "@/lib/civic-logic";
import {
  computeCitizenHonorsSnapshot,
  formatCertificateIssueDate,
} from "@/lib/civic-honors";
import { CertificateModal } from "@/components/CertificateModal";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { EmptyState, LoadingState } from "@/components/ui/StateViews";
import type { CertificateMilestone, CivicCertificateData } from "@/types/civic";

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
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCertificate, setActiveCertificate] =
    useState<CivicCertificateData | null>(null);

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
      return;
    }

    let cancelled = false;
    setReportsLoading(true);
    setReportsError(null);

    fetchMyReports(user.uid)
      .then((reportItems) => {
        if (!cancelled) {
          setReports(reportItems);
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

  const civicPoints = profile?.civicPoints ?? 0;
  const acceptedCount =
    profile?.acceptedReportsCount ??
    reports.filter((r) => r.reviewState === "accepted").length;
  const resolvedCount =
    profile?.resolvedReportsCount ??
    reports.filter(
      (r) => r.reviewState === "accepted" && r.status === "resolved"
    ).length;

  const honors = useMemo(
    () =>
      computeCitizenHonorsSnapshot({
        citizenName:
          displayAlias || user?.displayName || "Bengaluru Citizen Steward",
        ward: "Bengaluru Urban",
        meritPoints: civicPoints,
        verifiedFixes: resolvedCount,
      }),
    [civicPoints, displayAlias, resolvedCount, user?.displayName]
  );

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
      const latestReports = await fetchMyReports(user.uid);
      setReports(latestReports);
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenCertificate = (milestone: CertificateMilestone) => {
    setActiveCertificate({
      recipientName: honors.citizenName,
      ward: honors.ward,
      verifiedFixes: Math.max(honors.verifiedFixes, milestone.requiredFixes),
      milestoneLevel: milestone.level,
      milestoneTitle: milestone.title,
      certificateId: milestone.certificateId,
      issuedDate: formatCertificateIssueDate(),
      meritPoints: honors.meritPoints,
    });
  };

  if (!authReady) {
    return <LoadingState label="Loading your CivicSnap profile..." rows={3} />;
  }

  if (!user) {
    return (
      <div className="mt-6">
        <EmptyState
          icon={<User size={20} aria-hidden="true" />}
          title="Sign in to view your State Civic Honors, Certificates & Rank"
          description="Sign in with your CivicSnap account to track your Civic Merit Points, auto-unlock official Bengaluru Urban Digital Merit Certificates every 5 verified fixes, and compete for the Chief Minister's Annual Civic Champions Award."
          primaryAction={{ label: "Sign In", href: "/login?next=%2Fprofile" }}
          secondaryAction={{
            label: "Preview Civic Honors",
            href: "/rewards",
          }}
        />
      </div>
    );
  }

  const unlockedCertificates = honors.certificates.filter((c) => c.unlocked);

  return (
    <div className="mt-6 space-y-6">
      {/* Merit Standing & State Civic Honors Hero Card */}
      <section
        aria-label="Civic Merit Standing and State Honors"
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900">
                <Crown size={13} aria-hidden="true" />
                <span>{honors.currentBadge.title}</span>
              </span>
              <span className="font-mono text-xs font-semibold text-slate-600">
                Rank #{honors.citywideRank} (Bengaluru Wide)
              </span>
              <button
                type="button"
                onClick={() => void handleRefreshPoints()}
                disabled={refreshing}
                className="inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
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
              {honors.currentBadge.description} Earn{" "}
              <strong className="font-semibold text-slate-900">
                +{POINTS_PER_ACCEPTED_REPORT} pts
              </strong>{" "}
              for accepted reports and{" "}
              <strong className="font-semibold text-slate-900">
                +{POINTS_PER_RESOLVED_REPORT} pts
              </strong>{" "}
              on AI-verified resolution toward Annual CM Standings.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 px-5 py-3.5 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
                Civic Merit Points
              </p>
              <p className="mt-0.5 font-mono text-3xl font-bold tabular-nums text-slate-900">
                {civicPoints}{" "}
                <span className="text-sm font-semibold text-slate-500">pts</span>
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Link
                href="/rewards"
                className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 whitespace-nowrap"
              >
                <Award size={14} aria-hidden="true" />
                <span>Open Civic Honors</span>
              </Link>
              <Link
                href="/ward-wars"
                className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap"
              >
                <Trophy size={14} aria-hidden="true" />
                <span>View CM Race</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Top 5 CM Finalist Progress Bar & Badges Summary */}
        <div className="mt-6 border-t border-slate-100 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-800">
              {honors.isTop5Finalist
                ? "Qualified inside the Top 5 CM Finalist Zone!"
                : `${honors.pointsToTop5} points to enter the Top 5 CM Finalist Zone`}
            </span>
            <span className="font-mono font-semibold text-slate-500">
              {acceptedCount} accepted · {resolvedCount} verified fixes ·{" "}
              {unlockedCertificates.length} certificates unlocked
            </span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-amber-500 transition-all"
              style={{ width: `${honors.top5ProgressPercent}%` }}
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {honors.badges.map((badge) => (
              <div
                key={badge.id}
                className={`rounded-xl border px-3.5 py-2.5 text-xs ${
                  badge.unlocked
                    ? "border-blue-200 bg-blue-50/50 text-slate-900"
                    : "border-slate-200 bg-slate-50/70 text-slate-500"
                }`}
              >
                <div className="flex items-center justify-between font-semibold">
                  <span className="truncate">{badge.title}</span>
                  {badge.unlocked && (
                    <CheckCircle2
                      size={13}
                      className="shrink-0 text-emerald-600"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                  {badge.requirementLabel}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Preferences & Digital Certificates Panel */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-5">
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
                Display alias (printed on Merit Certificates)
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
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <label
                htmlFor="profile-optin"
                className="text-xs leading-5 text-slate-600"
              >
                Show my alias, State Badge, and Civic Merit Points on the
                public Annual CM Leaderboard (opt-in only).
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
              className="inline-flex min-h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
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
              className="inline-flex min-h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <LogOut size={15} aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </form>

          {/* Automated Digital Merit Certificates */}
          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Digital Merit Certificates ({unlockedCertificates.length})
              </h3>
              <Link
                href="/rewards"
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                All Milestones
              </Link>
            </div>
            {unlockedCertificates.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {unlockedCertificates.map((cert) => (
                  <li
                    key={cert.level}
                    className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">
                        Level {cert.level} ({cert.requiredFixes} Verified Fixes)
                      </p>
                      <p className="font-mono text-[11px] text-slate-500">
                        {cert.certificateId}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenCertificate(cert)}
                      className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700"
                    >
                      <FileCheck2 size={12} aria-hidden="true" />
                      <span>View</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">
                {resolvedCount}/5 verified fixes completed. Your Level 1
                Official Digital Civic Merit Certificate unlocks automatically
                at 5 verified fixes.
              </p>
            )}
          </div>
        </section>

        {/* Submitted Reports Panel */}
        <section className="space-y-4 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Your Submitted Reports ({reports.length})
              </h2>
              <p className="text-xs text-slate-500">
                Private photos and coordinates remain visible only to you and
                authorised CivicSnap staff reviewers.
              </p>
            </div>
            <Link
              href="/report"
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
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
              description="Snap a local civic issue to file your first verified audit and begin earning Merit Points toward State Civic Honors."
              primaryAction={{ label: "Report an Issue", href: "/report" }}
              secondaryAction={{
                label: "Explore Civic Honors",
                href: "/rewards",
              }}
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
                        <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-0.5 font-mono text-xs font-semibold text-blue-700">
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

      <CertificateModal
        certificate={activeCertificate}
        onClose={() => setActiveCertificate(null)}
      />
    </div>
  );
}
