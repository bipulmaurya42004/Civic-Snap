"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import {
  AlertCircle,
  ArrowUpDown,
  Award,
  Building2,
  Camera,
  CheckCircle2,
  Crown,
  LogIn,
  MapPin,
  Medal,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import {
  ANNUAL_CM_SEASON_YEAR,
  ANNUAL_CM_SUMMIT_TITLE,
} from "@/lib/civic-honors";
import {
  aggregateLiveWardStandings,
  buildLiveCitizenLeaderboard,
  computeDynamicTop5Standing,
  type LiveWardSortKey,
  type RawFirestoreCitizenProfile,
  type RawFirestoreIssueForWard,
} from "@/lib/leaderboard-logic";
import { db } from "@/lib/firebase";
import {
  fetchUserProfile,
  syncUserProfileOnSignIn,
} from "@/lib/firebase-users";
import { useFirebaseAuth } from "@/components/providers/FirebaseAuthProvider";
import { useAuthModal } from "@/components/AuthModal";
import { HoverCard, PageTransition } from "@/components/ui/MotionPrimitives";
import { LoadingState } from "@/components/ui/StateViews";

type LeaderboardTab = "citizens" | "wards";

export function WardWarsClient() {
  const router = useRouter();
  const { user, authReady } = useFirebaseAuth();
  const { openAuthModal } = useAuthModal();

  // Tab 1 (Top Citizens / Vanguard Hall of Fame) is ALWAYS the default active tab
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("citizens");
  const [citizenSearch, setCitizenSearch] = useState("");
  const [wardSearch, setWardSearch] = useState("");
  const [wardSortKey, setWardSortKey] = useState<LiveWardSortKey>("wardPoints");

  const [publicProfiles, setPublicProfiles] = useState<
    RawFirestoreCitizenProfile[]
  >([]);
  const [currentUserProfile, setCurrentUserProfile] =
    useState<RawFirestoreCitizenProfile | null>(null);
  const [liveIssues, setLiveIssues] = useState<RawFirestoreIssueForWard[]>([]);

  const [loadingCitizens, setLoadingCitizens] = useState(true);
  const [loadingWards, setLoadingWards] = useState(true);
  const [citizenError, setCitizenError] = useState<string | null>(null);
  const [wardError, setWardError] = useState<string | null>(null);

  // 1. Fetch REAL citizens strictly from Firestore (zero mock arrays)
  useEffect(() => {
    if (!authReady) return;
    if (!db) {
      setLoadingCitizens(false);
      return;
    }

    let cancelled = false;
    setLoadingCitizens(true);
    setCitizenError(null);

    async function loadRealCitizens() {
      if (!db) return;
      try {
        // Fetch public zero-PII leaderboard profiles from Firestore
        const profilesQuery = query(
          collection(db, "public_profiles"),
          where("leaderboardOptIn", "==", true),
          limit(100)
        );
        const snap = await getDocs(profilesQuery);
        const fetchedProfiles: RawFirestoreCitizenProfile[] = snap.docs.map(
          (docSnap) => {
            const data = docSnap.data();
            return {
              uid: String(data.uid ?? docSnap.id),
              displayName:
                typeof data.displayName === "string"
                  ? data.displayName
                  : undefined,
              alias: typeof data.alias === "string" ? data.alias : undefined,
              photoURL:
                typeof data.photoURL === "string" ? data.photoURL : undefined,
              points: typeof data.points === "number" ? data.points : undefined,
              civicPoints:
                typeof data.civicPoints === "number"
                  ? data.civicPoints
                  : undefined,
              resolvedCount:
                typeof data.resolvedCount === "number"
                  ? data.resolvedCount
                  : undefined,
              resolvedReportsCount:
                typeof data.resolvedReportsCount === "number"
                  ? data.resolvedReportsCount
                  : undefined,
              reportsCount:
                typeof data.reportsCount === "number"
                  ? data.reportsCount
                  : undefined,
              acceptedReportsCount:
                typeof data.acceptedReportsCount === "number"
                  ? data.acceptedReportsCount
                  : undefined,
            };
          }
        );

        // If a real user is signed in, read (or initialize at 0 pts) their own users/{uid} doc
        let ownProfile: RawFirestoreCitizenProfile | null = null;
        if (user) {
          let stored = await fetchUserProfile(user.uid);
          if (!stored) {
            stored = await syncUserProfileOnSignIn(user, {
              preferredAlias: user.displayName ?? undefined,
              leaderboardOptIn: true,
            });
          }
          if (stored) {
            ownProfile = {
              uid: stored.uid,
              displayName:
                stored.displayName || user.displayName || stored.alias,
              alias: stored.alias,
              photoURL: stored.photoURL || user.photoURL || "",
              points: stored.points,
              civicPoints: stored.civicPoints,
              resolvedCount: stored.resolvedCount,
              resolvedReportsCount: stored.resolvedReportsCount,
              reportsCount: stored.reportsCount,
              acceptedReportsCount: stored.acceptedReportsCount,
            };
          } else {
            ownProfile = {
              uid: user.uid,
              displayName: user.displayName || "Bengaluru Citizen",
              alias: user.displayName || "Bengaluru Citizen",
              photoURL: user.photoURL || "",
              points: 0,
              civicPoints: 0,
              resolvedCount: 0,
              resolvedReportsCount: 0,
              reportsCount: 0,
              acceptedReportsCount: 0,
            };
          }
        }

        if (!cancelled) {
          setPublicProfiles(fetchedProfiles);
          setCurrentUserProfile(ownProfile);
        }
      } catch (err) {
        if (!cancelled) {
          setCitizenError(
            err instanceof Error
              ? err.message
              : "Could not load live citizen standings from Firestore."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingCitizens(false);
        }
      }
    }

    void loadRealCitizens();
    return () => {
      cancelled = true;
    };
  }, [authReady, user]);

  // 2. Fetch REAL issues strictly from Firestore `issues` & `public_reports` for Ward Standings
  useEffect(() => {
    if (!db) {
      setLoadingWards(false);
      return;
    }

    let cancelled = false;
    setLoadingWards(true);
    setWardError(null);

    async function loadRealIssuesForWards() {
      if (!db) return;
      try {
        const [issuesSnap, publicReportsSnap] = await Promise.all([
          getDocs(query(collection(db, "issues"), limit(500))),
          getDocs(
            query(
              collection(db, "public_reports"),
              where("publicApproved", "==", true),
              limit(500)
            )
          ),
        ]);

        const combined: RawFirestoreIssueForWard[] = [];

        for (const docSnap of issuesSnap.docs) {
          const data = docSnap.data();
          combined.push({
            id: String(data.id ?? docSnap.id),
            ward: typeof data.ward === "string" ? data.ward : undefined,
            locality:
              typeof data.locality === "string" ? data.locality : undefined,
            status: typeof data.status === "string" ? data.status : undefined,
          });
        }

        for (const docSnap of publicReportsSnap.docs) {
          const data = docSnap.data();
          combined.push({
            id: String(data.id ?? docSnap.id),
            ward: typeof data.ward === "string" ? data.ward : undefined,
            locality:
              typeof data.locality === "string" ? data.locality : undefined,
            status: typeof data.status === "string" ? data.status : undefined,
          });
        }

        if (!cancelled) {
          setLiveIssues(combined);
        }
      } catch (err) {
        if (!cancelled) {
          setWardError(
            err instanceof Error
              ? err.message
              : "Could not load live ward issues from Firestore."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingWards(false);
        }
      }
    }

    void loadRealIssuesForWards();
    return () => {
      cancelled = true;
    };
  }, []);

  const { entries: liveCitizens, hasAnyVerifiedFixes } = useMemo(
    () => buildLiveCitizenLeaderboard(publicProfiles, currentUserProfile, 20),
    [publicProfiles, currentUserProfile]
  );

  const dynamicTop5Standing = useMemo(
    () => computeDynamicTop5Standing(publicProfiles, currentUserProfile),
    [publicProfiles, currentUserProfile]
  );

  const filteredCitizens = useMemo(() => {
    const q = citizenSearch.trim().toLowerCase();
    if (!q) return liveCitizens;
    return liveCitizens.filter(
      (entry) =>
        entry.displayName.toLowerCase().includes(q) ||
        entry.alias.toLowerCase().includes(q) ||
        entry.tierLabel.toLowerCase().includes(q)
    );
  }, [liveCitizens, citizenSearch]);

  const citizenPodium = useMemo(
    () => liveCitizens.filter((c) => c.points > 0).slice(0, 3),
    [liveCitizens]
  );

  const wardStandings = useMemo(
    () => aggregateLiveWardStandings(liveIssues, wardSortKey),
    [liveIssues, wardSortKey]
  );

  const filteredWards = useMemo(() => {
    const q = wardSearch.trim().toLowerCase();
    if (!q) return wardStandings;
    return wardStandings.filter(
      (row) =>
        row.ward.toLowerCase().includes(q) ||
        row.zone.toLowerCase().includes(q) ||
        row.topColony.toLowerCase().includes(q)
    );
  }, [wardStandings, wardSearch]);

  const totalCityReports = useMemo(
    () => wardStandings.reduce((acc, w) => acc + w.totalReports, 0),
    [wardStandings]
  );
  const totalCityVerifiedFixes = useMemo(
    () => wardStandings.reduce((acc, w) => acc + w.verifiedFixes, 0),
    [wardStandings]
  );
  const totalCityWardPoints = totalCityVerifiedFixes * 50;

  const handleEarnPointsClick = () => {
    if (!user) {
      openAuthModal({
        title: "Sign In to Join 2026 Vanguard Standings",
        message:
          "Sign in with Google to file live-camera reports and earn +50 Merit Points strictly on verified fixes (AI Confidence Score ≥ 90% + Admin approval).",
        redirectTo: "/report",
      });
      return;
    }
    router.push("/report");
  };

  return (
    <PageTransition className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Guest Blue Banner — Strictly shown ONLY when not signed in */}
      {authReady && !user && (
        <section
          data-testid="guest-ledger-banner"
          aria-label="Guest sign-in notice"
          className="mb-6 rounded-2xl border border-blue-300 bg-blue-50/90 px-5 py-4 shadow-xs"
        >
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                <LogIn size={17} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold text-blue-950">
                  Sign in to view your real-time Citizen Ledger.
                </p>
                <p className="text-xs text-blue-800">
                  Sign in with Google to track your live Firestore rank, real
                  Merit Points, and verified street fixes.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                openAuthModal({
                  title: "Sign In to View Your Citizen Ledger",
                  message:
                    "Sign in with Google to see your real-time Firestore points, rank, and verified fixes.",
                })
              }
              className="inline-flex min-h-[40px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 whitespace-nowrap"
            >
              <LogIn size={14} aria-hidden="true" />
              <span>Sign In with Google</span>
            </button>
          </div>
        </section>
      )}

      {/* Top Banner — Bengaluru Civic Vanguard Standings (100% Live Firestore) */}
      <section
        aria-label="Bengaluru Civic Vanguard Standings Banner"
        className="mb-8 rounded-2xl border border-amber-300/90 bg-gradient-to-r from-amber-50/85 via-white to-blue-50/75 p-5 shadow-sm sm:p-7"
      >
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                <ShieldCheck size={13} aria-hidden="true" />
                <span>100% Live Firestore Ledger</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100/90 px-3 py-1 text-xs font-bold text-amber-900">
                <Award size={13} aria-hidden="true" />
                <span>{ANNUAL_CM_SUMMIT_TITLE}</span>
              </span>
            </div>

            <h1 className="mt-3 font-[var(--font-heading)] text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              {ANNUAL_CM_SEASON_YEAR} Bengaluru Civic Vanguard Standings
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
              Real-time citizen rankings and dynamic ward standings computed
              strictly from live Firestore records — zero placeholder numbers.
              Top 5 citizens with verified fixes enter the{" "}
              <strong className="font-semibold text-amber-900">
                Bengaluru Civic Vanguard Citation
              </strong>{" "}
              shortlist (CivicTech Community Micro-Grant: Planned –
              aspirational, not funded in this prototype).
            </p>

            {/* Live Dynamic Top 5 Cutoff & Pioneer Verifier Zone Strip */}
            <div
              data-testid="dynamic-top5-cutoff-strip"
              className="mt-3.5 flex flex-wrap items-center gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/70 px-3.5 py-2.5 text-xs leading-5 text-blue-950"
            >
              <Sparkles
                size={15}
                className="shrink-0 text-blue-600"
                aria-hidden="true"
              />
              {dynamicTop5Standing.isPioneerZone ? (
                <span>
                  <strong>
                    Pioneer Verifier Zone — Log your first verified fix to claim
                    a Top 5 spot!
                  </strong>{" "}
                  <span className="font-mono font-bold text-blue-800">
                    (Top 5 Cutoff: 0 pts)
                  </span>
                </span>
              ) : (
                <span>
                  <strong>Live Top 5 Cutoff:</strong>{" "}
                  <span className="font-mono font-bold text-blue-800">
                    {dynamicTop5Standing.top5CutoffPoints.toLocaleString("en-IN")}{" "}
                    pts
                  </span>{" "}
                  computed dynamically from{" "}
                  {dynamicTop5Standing.rankedCitizensCount} ranked citizens in
                  Firestore.
                </span>
              )}
              {user && currentUserProfile && (
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-2.5 py-0.5 font-mono text-[11px] font-bold text-slate-900">
                  <span>Your Rank: {dynamicTop5Standing.userRankLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {(
                      currentUserProfile.points ??
                      currentUserProfile.civicPoints ??
                      0
                    ).toLocaleString("en-IN")}{" "}
                    pts
                  </span>
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <Link
              href="/rewards"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-50 whitespace-nowrap"
            >
              <Award size={16} aria-hidden="true" className="text-amber-600" />
              <span>My Civic Honors</span>
            </Link>
            <button
              type="button"
              onClick={handleEarnPointsClick}
              className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95 whitespace-nowrap"
            >
              <Camera size={16} aria-hidden="true" />
              <span>Report &amp; Earn +50 Pts</span>
            </button>
          </div>
        </div>
      </section>

      {/* Two-Tab Switcher: Tab 1 = Top Citizens (DEFAULT ACTIVE), Tab 2 = Ward Standings */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-2.5 shadow-sm">
        <div
          role="tablist"
          aria-label="Leaderboard view switcher"
          className="inline-flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100/90 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "citizens"}
            onClick={() => setActiveTab("citizens")}
            className={`relative inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === "citizens"
                ? "text-amber-800"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {activeTab === "citizens" && (
              <motion.span
                layoutId="leaderboardTabPill"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-lg bg-white shadow-xs"
              />
            )}
            <Users
              size={15}
              className="relative z-10 text-amber-600"
              aria-hidden="true"
            />
            <span className="relative z-10">
              Top Citizens (Vanguard Hall of Fame)
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "wards"}
            onClick={() => setActiveTab("wards")}
            className={`relative inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === "wards"
                ? "text-blue-700"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {activeTab === "wards" && (
              <motion.span
                layoutId="leaderboardTabPill"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-lg bg-white shadow-xs"
              />
            )}
            <Building2 size={15} className="relative z-10" aria-hidden="true" />
            <span className="relative z-10">Ward Standings</span>
          </button>
        </div>

        <p className="px-2 text-xs text-slate-500">
          {activeTab === "citizens"
            ? "Live Firestore citizen leaderboard ordered by verified Merit Points"
            : "Dynamically aggregated from live Firestore issues (Verified Fixes × 50 Ward Points)"}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "citizens" ? (
          <motion.div
            key="citizen-hall-panel"
            role="tabpanel"
            aria-label="Top Citizens (Vanguard Hall of Fame)"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mt-7 space-y-6"
          >
            {citizenError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              >
                <AlertCircle
                  size={16}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <span>{citizenError}</span>
              </div>
            )}

            {loadingCitizens ? (
              <LoadingState
                label="Loading live citizen standings from Firestore..."
                rows={3}
              />
            ) : (
              <>
                {/* Real Zero-State Banner when no verified fixes exist yet in 2026 */}
                {!hasAnyVerifiedFixes && (
                  <section
                    data-testid="citizens-zero-state-banner"
                    aria-label="Zero verified fixes status"
                    className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/80 via-white to-slate-50 p-6 shadow-sm"
                  >
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                      <div className="space-y-1.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
                          <Sparkles size={12} aria-hidden="true" />
                          <span>Live 2026 Ledger · Zero Verified Fixes Yet</span>
                        </span>
                        <h2 className="font-[var(--font-heading)] text-lg font-bold text-slate-900">
                          No verified fixes logged yet in the 2026 ledger.
                          Report your first street pothole to earn points!
                        </h2>
                        <p className="text-sm text-slate-600">
                          {liveCitizens.length === 0
                            ? "No verified citizens yet. Be the first to audit a public issue!"
                            : "All registered citizen profiles start at 0 points in Firestore until a repair passes Gemini AI verification (≥ 90% AI Confidence Score) and Admin approval."}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
                        {!user && (
                          <button
                            type="button"
                            onClick={() =>
                              openAuthModal({
                                title: "Sign In to Join the 2026 Hall of Fame",
                                message:
                                  "Sign in with Google to appear on the live citizen leaderboard and track your real Firestore points.",
                              })
                            }
                            className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
                          >
                            <LogIn size={15} aria-hidden="true" />
                            <span>Sign In with Google</span>
                          </button>
                        )}
                        <Link
                          href="/report"
                          className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 whitespace-nowrap"
                        >
                          <Camera size={15} aria-hidden="true" />
                          <span>Report Your First Pothole</span>
                        </Link>
                      </div>
                    </div>
                  </section>
                )}

                {/* Real Top 3 Podium Cards — ONLY rendered for real citizens with points > 0 */}
                {citizenPodium.length > 0 && (
                  <section aria-label="Top verified Bengaluru citizens">
                    <div className="grid gap-5 md:grid-cols-3">
                      {citizenPodium.map((star, idx) => {
                        const isFirst = idx === 0;
                        return (
                          <HoverCard
                            key={star.uid}
                            className={`border-amber-300/90 bg-gradient-to-b from-amber-50/55 via-white to-white p-6 ${
                              isFirst
                                ? "shadow-md shadow-amber-500/15 ring-1 ring-amber-400/50"
                                : "ring-1 ring-amber-300/35"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100/90 px-3 py-1 text-xs font-bold text-amber-900">
                                <Crown size={13} aria-hidden="true" />
                                <span>#{star.rank} Vanguard Shortlist</span>
                              </span>
                              {star.isCurrentUser && (
                                <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
                                  You
                                </span>
                              )}
                            </div>

                            <div className="mt-4 flex items-center gap-3">
                              {star.photoURL ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={star.photoURL}
                                  alt={`${star.displayName} avatar`}
                                  referrerPolicy="no-referrer"
                                  className="h-11 w-11 shrink-0 rounded-full border-2 border-amber-400 object-cover"
                                />
                              ) : (
                                <span
                                  aria-hidden="true"
                                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-100 font-[var(--font-heading)] text-sm font-bold text-amber-950"
                                >
                                  {star.initials}
                                </span>
                              )}
                              <div className="min-w-0">
                                <h2 className="truncate font-[var(--font-heading)] text-lg font-bold text-slate-900">
                                  {star.displayName}
                                </h2>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  {star.tierLabel}
                                </p>
                              </div>
                            </div>

                            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-amber-200/60 pt-4">
                              <div>
                                <p className="text-[11px] font-medium text-slate-500">
                                  Verified Fixes
                                </p>
                                <p className="mt-0.5 font-mono text-base font-bold tabular-nums text-slate-900">
                                  {star.verifiedFixes}
                                </p>
                              </div>
                              <div>
                                <p className="text-[11px] font-medium text-slate-500">
                                  2026 Merit Points
                                </p>
                                <p className="mt-0.5 flex items-center gap-1 font-mono text-base font-bold tabular-nums text-amber-800">
                                  <Trophy size={14} aria-hidden="true" />
                                  <span>
                                    {star.points.toLocaleString("en-IN")} pts
                                  </span>
                                </p>
                              </div>
                            </div>
                          </HoverCard>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Real Firestore Citizen Leaderboard Table */}
                <section
                  aria-label="Top Citizens (Vanguard Hall of Fame) table"
                  className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm"
                >
                  <div className="flex flex-col justify-between gap-3 border-b border-slate-200/80 p-4 sm:flex-row sm:items-center sm:p-5">
                    <div>
                      <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                        <Users
                          size={16}
                          className="text-blue-600"
                          aria-hidden="true"
                        />
                        <span>
                          Top Citizens (Vanguard Hall of Fame) — Live Firestore
                          Standings
                        </span>
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {liveCitizens.length}{" "}
                        {liveCitizens.length === 1
                          ? "registered citizen"
                          : "registered citizens"}{" "}
                        in Firestore ordered by verified Merit Points (top 20
                        shown).
                      </p>
                    </div>

                    <div className="relative">
                      <Search
                        size={15}
                        aria-hidden="true"
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="search"
                        aria-label="Search real citizens by name"
                        value={citizenSearch}
                        onChange={(e) => setCitizenSearch(e.target.value)}
                        placeholder="Search citizen..."
                        className="min-h-[38px] w-52 rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                  </div>

                  {filteredCitizens.length === 0 ? (
                    <div
                      data-testid="empty-citizens-table"
                      className="flex flex-col items-center justify-center px-6 py-14 text-center"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                        <Users size={22} aria-hidden="true" />
                      </div>
                      <p className="mt-3 text-base font-bold text-slate-900">
                        {citizenSearch.trim()
                          ? "No citizens match your search."
                          : "No verified citizens yet. Be the first to audit a public issue!"}
                      </p>
                      <p className="mt-1 max-w-md text-xs leading-5 text-slate-600">
                        {citizenSearch.trim()
                          ? "Clear the search box to view all live Firestore citizen accounts."
                          : "Sign in with Google and capture a real street pothole or civic hazard to enter the 2026 Bengaluru open civic ledger."}
                      </p>
                      {!citizenSearch.trim() && (
                        <Link
                          href="/report"
                          className="mt-5 inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                        >
                          <Camera size={15} aria-hidden="true" />
                          <span>Snap &amp; Audit First Issue</span>
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                            <th className="px-5 py-3.5">Rank</th>
                            <th className="px-5 py-3.5">Citizen</th>
                            <th className="px-5 py-3.5">2026 Tier</th>
                            <th className="px-5 py-3.5 text-right">
                              Verified Fixes
                            </th>
                            <th className="px-5 py-3.5 text-right">
                              Merit Points
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredCitizens.map((entry) => {
                            const isTop5Active = entry.isShortlistEligible;
                            return (
                              <tr
                                key={entry.uid}
                                data-testid={
                                  entry.isCurrentUser
                                    ? "current-user-leaderboard-row"
                                    : `citizen-row-${entry.rank}`
                                }
                                className={
                                  isTop5Active
                                    ? "border-l-4 border-l-amber-400 bg-gradient-to-r from-amber-50/85 via-amber-50/35 to-white transition-colors hover:from-amber-50"
                                    : entry.isCurrentUser
                                      ? "border-l-4 border-l-blue-500 bg-blue-50/40 transition-colors hover:bg-blue-50/60"
                                      : "transition-colors hover:bg-slate-50/80"
                                }
                              >
                                <td className="px-5 py-4">
                                  <span
                                    className={`inline-flex min-h-[28px] min-w-[34px] items-center justify-center rounded-lg px-2.5 py-1 font-mono text-xs font-bold tabular-nums whitespace-nowrap ${
                                      isTop5Active
                                        ? "border border-amber-400 bg-amber-100 text-amber-950 shadow-xs"
                                        : entry.isRanked
                                          ? "bg-slate-100 text-slate-700"
                                          : "border border-slate-200 bg-slate-50 text-slate-500"
                                    }`}
                                  >
                                    {entry.rankLabel}
                                  </span>
                                </td>
                                <td className="px-5 py-4">
                                  <div className="flex items-center gap-3">
                                    {entry.photoURL ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={entry.photoURL}
                                        alt={`${entry.displayName} profile photo`}
                                        referrerPolicy="no-referrer"
                                        className="h-9 w-9 shrink-0 rounded-full border border-slate-200 object-cover"
                                      />
                                    ) : (
                                      <span
                                        aria-hidden="true"
                                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                          isTop5Active
                                            ? "border-2 border-amber-400 bg-amber-100 text-amber-950"
                                            : "border border-slate-200 bg-slate-100 text-slate-700"
                                        }`}
                                      >
                                        {entry.initials}
                                      </span>
                                    )}
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <p className="truncate font-semibold text-slate-900">
                                          {entry.displayName}
                                        </p>
                                        {entry.isCurrentUser && (
                                          <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                                            You
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-slate-500">
                                        {entry.reportsCount}{" "}
                                        {entry.reportsCount === 1
                                          ? "report logged"
                                          : "reports logged"}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 py-4">
                                  {isTop5Active ? (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                                      <Crown size={12} aria-hidden="true" />
                                      <span>{entry.tierLabel}</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                                      <Award size={11} aria-hidden="true" />
                                      <span>{entry.tierLabel}</span>
                                    </span>
                                  )}
                                </td>
                                <td className="px-5 py-4 text-right font-mono text-xs font-bold tabular-nums text-slate-800">
                                  {entry.verifiedFixes} verified
                                </td>
                                <td className="px-5 py-4 text-right font-mono text-sm font-bold tabular-nums text-blue-700">
                                  <span
                                    className={
                                      isTop5Active ? "text-amber-900" : ""
                                    }
                                  >
                                    {entry.points.toLocaleString("en-IN")} pts
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="ward-standings-panel"
            role="tabpanel"
            aria-label="Ward Standings"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mt-7 space-y-6"
          >
            {wardError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              >
                <AlertCircle
                  size={16}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <span>{wardError}</span>
              </div>
            )}

            {loadingWards ? (
              <LoadingState
                label="Aggregating live ward standings from Firestore issues..."
                rows={3}
              />
            ) : (
              <>
                {/* Live Citywide Ward Aggregation Summary Bar (Strictly Real Firestore Totals) */}
                <section
                  aria-label="Live Bengaluru ward totals"
                  className="grid gap-4 sm:grid-cols-3"
                >
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-medium text-slate-500">
                      Total Live Reports
                    </p>
                    <p
                      data-testid="ward-total-reports"
                      className="mt-1 font-mono text-3xl font-extrabold tabular-nums text-slate-900"
                    >
                      {totalCityReports}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Aggregated directly from Firestore issues
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-medium text-slate-500">
                      Total Verified Fixes
                    </p>
                    <p
                      data-testid="ward-total-verified"
                      className="mt-1 font-mono text-3xl font-extrabold tabular-nums text-emerald-700"
                    >
                      {totalCityVerifiedFixes}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Issues marked Resolved / Verified_Fixed
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-medium text-slate-500">
                      Total Ward Points
                    </p>
                    <p
                      data-testid="ward-total-points"
                      className="mt-1 font-mono text-3xl font-extrabold tabular-nums text-blue-700"
                    >
                      {totalCityWardPoints.toLocaleString("en-IN")}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Formula: Verified Fixes × 50 Ward Points
                    </p>
                  </div>
                </section>

                {/* Live Ward Standings Cards Grid */}
                <section
                  aria-label="Live Bengaluru ward cards"
                  className="space-y-4"
                >
                  <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:p-5">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        Ward Standings — Live Firestore Aggregation
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Real counts from Firestore with zero hardcoded sample
                        numbers.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="relative">
                        <Search
                          size={15}
                          aria-hidden="true"
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          type="search"
                          aria-label="Filter wards by name or zone"
                          value={wardSearch}
                          onChange={(e) => setWardSearch(e.target.value)}
                          placeholder="Search ward..."
                          className="min-h-[38px] w-48 rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                        />
                      </div>

                      <div className="inline-flex items-center gap-1.5">
                        <ArrowUpDown
                          size={14}
                          className="text-slate-400"
                          aria-hidden="true"
                        />
                        <select
                          aria-label="Sort live ward rankings"
                          value={wardSortKey}
                          onChange={(e) =>
                            setWardSortKey(e.target.value as LiveWardSortKey)
                          }
                          className="min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                        >
                          <option value="wardPoints">Most Ward Points</option>
                          <option value="verifiedFixes">
                            Most Verified Fixes
                          </option>
                          <option value="totalReports">Most Reports</option>
                          <option value="resolutionRate">
                            Resolution Rate (%)
                          </option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredWards.map((row) => {
                      const hasActivity = row.totalReports > 0;
                      return (
                        <HoverCard
                          key={row.ward}
                          className={`flex flex-col justify-between p-5 ${
                            row.wardPoints > 0 && row.rank === 1
                              ? "border-amber-300 ring-1 ring-amber-400/25"
                              : "border-slate-200"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                                  row.wardPoints > 0 && row.rank === 1
                                    ? "border-amber-300 bg-amber-50 text-amber-900"
                                    : "border-slate-200 bg-slate-100 text-slate-700"
                                }`}
                              >
                                {row.wardPoints > 0 && row.rank === 1 ? (
                                  <Trophy size={12} aria-hidden="true" />
                                ) : (
                                  <Medal size={12} aria-hidden="true" />
                                )}
                                <span>#{row.rank}</span>
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums ${
                                  row.resolutionRate > 0
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-slate-200 bg-slate-50 text-slate-600"
                                }`}
                              >
                                <CheckCircle2 size={12} aria-hidden="true" />
                                <span>{row.resolutionRate}% Fixed</span>
                              </span>
                            </div>

                            <h3 className="mt-3 font-[var(--font-heading)] text-xl font-bold text-slate-900">
                              {row.ward}
                            </h3>
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                              <MapPin
                                size={12}
                                className="text-blue-600"
                                aria-hidden="true"
                              />
                              <span>
                                {row.zone} · {row.topColony}
                              </span>
                            </p>

                            {/* Real Dynamic Metrics Line */}
                            <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-3">
                              <p className="font-mono text-xs font-bold tabular-nums text-slate-800">
                                {row.totalReports}{" "}
                                {row.totalReports === 1 ? "Report" : "Reports"}{" "}
                                • {row.verifiedFixes} Verified{" "}
                                {row.verifiedFixes === 1 ? "Fix" : "Fixes"} •{" "}
                                {row.wardPoints.toLocaleString("en-IN")} Ward{" "}
                                {row.wardPoints === 1 ? "Point" : "Points"}
                              </p>

                              <div
                                className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-200/80"
                                role="progressbar"
                                aria-label={`${row.ward} resolution rate ${row.resolutionRate}%`}
                                aria-valuenow={row.resolutionRate}
                                aria-valuemin={0}
                                aria-valuemax={100}
                              >
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    hasActivity
                                      ? "bg-emerald-600"
                                      : "bg-slate-300"
                                  }`}
                                  style={{ width: `${row.resolutionRate}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 pt-2">
                            <Link
                              href={`/report?ward=${encodeURIComponent(row.ward)}`}
                              className={`inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                                hasActivity
                                  ? "border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                                  : "bg-blue-600 text-white shadow-xs hover:bg-blue-700"
                              }`}
                            >
                              <Camera size={14} aria-hidden="true" />
                              <span>Report an Issue in this Ward</span>
                            </Link>
                          </div>
                        </HoverCard>
                      );
                    })}
                  </div>
                </section>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
