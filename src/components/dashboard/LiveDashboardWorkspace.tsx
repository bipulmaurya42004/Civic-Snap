"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Award,
  Camera,
  CheckCircle2,
  Coins,
  ExternalLink,
  FileCheck2,
  Lock,
  LogIn,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import {
  PILOT_LOCALITIES,
  STATUS_LABELS,
  type PublicIssueRecord,
} from "@/types/civic";
import {
  fetchPublicReports,
  fetchMyReports,
  type StoredPrivateReport,
} from "@/lib/firebase-reports";
import {
  fetchUserProfile,
  syncUserProfileOnSignIn,
  type StoredUserProfile,
} from "@/lib/firebase-users";
import { formatCivicDate, getCategoryLabel } from "@/lib/civic-logic";
import { useFirebaseAuth } from "@/components/providers/FirebaseAuthProvider";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { LoadingState } from "@/components/ui/StateViews";

const REQUIRED_FIXES_FOR_FIRST_CERT = 5;

export function LiveDashboardWorkspace() {
  const { user, authReady, signInWithGoogle, busy: authBusy } =
    useFirebaseAuth();

  const [userProfile, setUserProfile] = useState<StoredUserProfile | null>(null);
  const [myIssues, setMyIssues] = useState<StoredPrivateReport[]>([]);
  const [publicIssues, setPublicIssues] = useState<PublicIssueRecord[]>([]);
  const [loadingUser, setLoadingUser] = useState(false);
  const [loadingPublic, setLoadingPublic] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);
  const [publicError, setPublicError] = useState<string | null>(null);

  // 1. Load live citywide public reports
  useEffect(() => {
    let cancelled = false;
    fetchPublicReports()
      .then((records) => {
        if (!cancelled) setPublicIssues(records);
      })
      .catch(() => {
        if (!cancelled) {
          setPublicError("Could not load citywide public ledger right now.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPublic(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Strictly load REAL Firestore profile + myIssues for authenticated users (zero mock data)
  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setUserProfile(null);
      setMyIssues([]);
      setUserError(null);
      setLoadingUser(false);
      return;
    }

    let cancelled = false;
    setLoadingUser(true);
    setUserError(null);

    async function loadRealCitizenData() {
      if (!user) return;
      try {
        // Ensure users/{uid} exists; if not, immediately create it with 0 points, 0 reportsCount, 0 resolvedCount, role: "citizen"
        let liveProfile = await fetchUserProfile(user.uid);
        if (!liveProfile) {
          liveProfile = await syncUserProfileOnSignIn(user, {
            preferredAlias: user.displayName ?? undefined,
          });
        }

        const reports = await fetchMyReports(user.uid);
        if (!cancelled) {
          setUserProfile(liveProfile);
          setMyIssues(reports);
        }
      } catch (err) {
        if (!cancelled) {
          setUserError(
            err instanceof Error
              ? err.message
              : "Could not sync your live Firestore citizen profile right now."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingUser(false);
        }
      }
    }

    void loadRealCitizenData();
    return () => {
      cancelled = true;
    };
  }, [authReady, user]);

  if (!authReady || (user && loadingUser)) {
    return (
      <LoadingState
        label="Loading your live Firestore CivicSnap dashboard..."
        rows={3}
      />
    );
  }

  // Real authenticated citizen metrics — strictly 0-initialized from Firestore, NEVER mock/Aarav data
  const displayName =
    userProfile?.displayName ||
    userProfile?.alias ||
    user?.displayName ||
    "Citizen Auditor";
  const points = userProfile?.points ?? userProfile?.civicPoints ?? 0;
  const auditedCount = Math.max(
    userProfile?.reportsCount ?? 0,
    myIssues.length
  );
  const resolvedCount = Math.max(
    userProfile?.resolvedCount ?? userProfile?.resolvedReportsCount ?? 0,
    myIssues.filter(
      (r) =>
        r.status === "resolved" &&
        r.verificationStatus === "verified" &&
        (r.aiConfidenceScore ?? 0) >= 90
    ).length
  );

  const certUnlocked = resolvedCount >= REQUIRED_FIXES_FOR_FIRST_CERT;
  const certProgressPercent = Math.min(
    100,
    Math.round((resolvedCount / REQUIRED_FIXES_FOR_FIRST_CERT) * 100)
  );
  const fixesRemaining = Math.max(
    0,
    REQUIRED_FIXES_FOR_FIRST_CERT - resolvedCount
  );

  return (
    <div className="space-y-8">
      {/* AUTHENTICATED LIVE CITIZEN WORKSPACE */}
      {user ? (
        <div className="space-y-6">
          {userError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{userError}</span>
            </div>
          )}

          {/* Citizen Identity + Live Zero-Initialized Metrics */}
          <section
            aria-label="Live Citizen Profile Summary"
            data-testid="live-citizen-dashboard"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3.5">
                {user.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.photoURL}
                    alt={`${displayName} profile avatar`}
                    referrerPolicy="no-referrer"
                    className="h-12 w-12 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-base font-bold text-blue-700">
                    {displayName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-[var(--font-heading)] text-xl font-bold text-slate-900">
                      {displayName}
                    </h2>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                      <ShieldCheck size={12} aria-hidden="true" />
                      Live Firestore Profile
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {user.email || "Authenticated Google Citizen"} · Role:{" "}
                    <span className="font-medium capitalize text-slate-700">
                      {userProfile?.role ?? "citizen"}
                    </span>
                  </p>
                </div>
              </div>

              <Link
                href="/report"
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700"
              >
                <Camera size={16} aria-hidden="true" />
                <span>Snap &amp; Audit Issue</span>
              </Link>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Coins size={14} className="text-amber-600" aria-hidden="true" />
                  <span>Civic Merit Points</span>
                </p>
                <p
                  data-testid="live-merit-points"
                  className="mt-1.5 font-mono text-3xl font-extrabold tabular-nums text-slate-900"
                >
                  {points}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  +50 pts strictly on Verified Fix (AI ≥ 90% + Admin)
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Camera size={14} className="text-blue-600" aria-hidden="true" />
                  <span>Issues Audited</span>
                </p>
                <p
                  data-testid="live-issues-audited"
                  className="mt-1.5 font-mono text-3xl font-extrabold tabular-nums text-slate-900"
                >
                  {auditedCount}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Total live-camera reports logged under your UID
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <CheckCircle2
                    size={14}
                    className="text-emerald-600"
                    aria-hidden="true"
                  />
                  <span>Verified Fixes</span>
                </p>
                <p
                  data-testid="live-verified-fixes"
                  className="mt-1.5 font-mono text-3xl font-extrabold tabular-nums text-emerald-700"
                >
                  {resolvedCount}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Admin-approved repairs counting toward certificates
                </p>
              </div>
            </div>
          </section>

          {/* REAL CERTIFICATE UNLOCK PROGRESS CARD (LOCKED UNTIL resolvedCount >= 5) */}
          <section
            aria-label="Civic Merit Certificate Progress"
            data-testid="certificate-progress-card"
            className={`rounded-2xl border p-6 shadow-sm ${
              certUnlocked
                ? "border-emerald-300 bg-gradient-to-r from-emerald-50/70 via-white to-blue-50/50"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3.5">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    certUnlocked
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {certUnlocked ? (
                    <Award size={22} aria-hidden="true" />
                  ) : (
                    <Lock size={20} aria-hidden="true" />
                  )}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-[var(--font-heading)] text-lg font-bold text-slate-900">
                      Civic Merit Certificate Progress
                    </h2>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                        certUnlocked
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-100 text-slate-600"
                      }`}
                    >
                      {certUnlocked ? "Unlocked" : "Locked"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    Progress to First Certificate: {resolvedCount} /{" "}
                    {REQUIRED_FIXES_FOR_FIRST_CERT} Verified Fixes
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {certUnlocked
                      ? "You have unlocked your SHA-256 tamper-evident Level 1 Civic Merit Certificate (Independent Open Civic Audit Record)."
                      : `Complete ${fixesRemaining} more verified ${
                          fixesRemaining === 1 ? "fix" : "fixes"
                        } (AI Confidence Score ≥ 90% + Admin approval) to unlock your verifiable cryptographic certificate.`}
                  </p>
                </div>
              </div>

              {certUnlocked ? (
                <Link
                  href={`/verify/${encodeURIComponent(user.uid)}`}
                  className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700"
                >
                  <FileCheck2 size={16} aria-hidden="true" />
                  <span>View &amp; Share Your Cryptographic Certificate</span>
                  <ExternalLink size={14} aria-hidden="true" />
                </Link>
              ) : (
                <span className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500">
                  <Lock size={14} aria-hidden="true" />
                  <span>Unlocks at 5 Verified Fixes</span>
                </span>
              )}
            </div>

            <div className="mt-4">
              <div
                role="progressbar"
                aria-valuenow={resolvedCount}
                aria-valuemin={0}
                aria-valuemax={REQUIRED_FIXES_FOR_FIRST_CERT}
                aria-label="Progress to first Civic Merit Certificate"
                className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    certUnlocked ? "bg-emerald-600" : "bg-blue-600"
                  }`}
                  style={{ width: `${certProgressPercent}%` }}
                />
              </div>
            </div>
          </section>

          {/* MY REAL AUDITED ISSUES LIST OR CLEAN EMPTY STATE */}
          <section
            aria-label="My Audited Civic Issues"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-[var(--font-heading)] text-lg font-bold text-slate-900">
                My Audited Civic Issues ({myIssues.length})
              </h2>
              <Link
                href="/profile"
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Manage Profile &amp; Preferences →
              </Link>
            </div>

            {myIssues.length === 0 ? (
              <div
                data-testid="empty-my-issues"
                className="mt-5 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-10 text-center"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-xs ring-1 ring-slate-200">
                  <Camera size={22} aria-hidden="true" />
                </div>
                <p className="mt-3 text-base font-bold text-slate-900">
                  You haven&apos;t audited any issues yet.
                </p>
                <p className="mt-1 max-w-md text-xs leading-5 text-slate-600">
                  Capture a real Bengaluru road pothole, waste pile, or broken
                  streetlight with your live camera to start building your
                  verified open civic record.
                </p>
                <Link
                  href="/report"
                  className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700"
                >
                  <Camera size={16} aria-hidden="true" />
                  <span>Snap Your First Pothole</span>
                </Link>
              </div>
            ) : (
              <div className="mt-4 divide-y divide-slate-100">
                {myIssues.map((report) => (
                  <div
                    key={report.id}
                    className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-500">
                          {report.id}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {getCategoryLabel(report.category)}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                            report.status === "resolved"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : report.status === "in_progress"
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-amber-200 bg-amber-50 text-amber-800"
                          }`}
                        >
                          {STATUS_LABELS[report.status]}
                        </span>
                        {report.needsReview && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            Needs Review
                          </span>
                        )}
                      </div>
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {report.title}
                      </p>
                      <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={12} aria-hidden="true" />
                          {report.locality}
                        </span>
                        <span>·</span>
                        <span>{formatCivicDate(report.createdAtIso)}</span>
                        {typeof report.aiConfidenceScore === "number" && (
                          <>
                            <span>·</span>
                            <span className="font-semibold text-blue-700">
                              AI Confidence Score: {report.aiConfidenceScore}%
                            </span>
                          </>
                        )}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs font-semibold text-slate-700">
                        +{report.pointsAwarded} pts
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        /* GUEST SIGN-IN PROMPT (NO FAKE PERSONAL DATA) */
        <section className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/70 via-white to-slate-50 p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
                Live Citizen Ledger
              </p>
              <h2 className="font-[var(--font-heading)] text-xl font-bold text-slate-900">
                Sign in with Google to view your personal audit ledger
              </h2>
              <p className="text-sm text-slate-600">
                New citizen accounts start at 0 Merit Points and 0 Verified
                Fixes in Firestore, unlocking SHA-256 certificates automatically
                once 5 repairs are verified.
              </p>
            </div>
            <button
              type="button"
              disabled={authBusy}
              onClick={() => void signInWithGoogle()}
              className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 disabled:opacity-60"
            >
              <LogIn size={16} aria-hidden="true" />
              <span>{authBusy ? "Signing In..." : "Sign In with Google"}</span>
            </button>
          </div>
        </section>
      )}

      {/* LIVE CITYWIDE PUBLIC LEDGER OVERVIEW */}
      <div className="space-y-4">
        <h2 className="font-[var(--font-heading)] text-lg font-bold text-slate-900">
          Live Bengaluru Public Ledger Overview
        </h2>
        {publicError && (
          <p
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            {publicError}
          </p>
        )}
        {loadingPublic ? (
          <LoadingState label="Loading citywide public reports..." rows={2} />
        ) : (
          <DashboardOverview issues={publicIssues} areas={PILOT_LOCALITIES} />
        )}
      </div>
    </div>
  );
}
