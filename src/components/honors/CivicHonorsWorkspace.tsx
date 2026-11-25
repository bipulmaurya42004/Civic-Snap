"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import {
  ArrowRight,
  Award,
  Camera,
  CheckCircle2,
  Compass,
  Crown,
  FileCheck2,
  Lock,
  LogIn,
  Medal,
  Shield,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { useFirebaseAuth } from "@/components/providers/FirebaseAuthProvider";
import { useAuthModal } from "@/components/AuthModal";
import { CertificateModal } from "@/components/CertificateModal";
import { HoverCard, PageTransition } from "@/components/ui/MotionPrimitives";
import { LoadingState } from "@/components/ui/StateViews";
import {
  ANNUAL_CM_SEASON_YEAR,
  ANNUAL_CM_SUMMIT_TITLE,
  buildCertificateMilestones,
  CERTIFICATE_RECORD_LABEL,
  CM_ANNUAL_AWARD_PERKS,
  computeCertificateSha256,
  computeCitizenHonorsSnapshot,
  DEFAULT_PREVIEW_CITYWIDE_RANK,
  DEFAULT_PREVIEW_MERIT_POINTS,
  DEFAULT_PREVIEW_VERIFIED_FIXES,
  evaluateStateCivicBadges,
  formatCertificateIssueDate,
} from "@/lib/civic-honors";
import {
  computeDynamicTop5Standing,
  type RawFirestoreCitizenProfile,
} from "@/lib/leaderboard-logic";
import { db } from "@/lib/firebase";
import {
  fetchUserProfile,
  syncUserProfileOnSignIn,
  type StoredUserProfile,
} from "@/lib/firebase-users";
import type {
  CertificateMilestone,
  CivicCertificateData,
  StateCivicBadgeId,
} from "@/types/civic";

const BADGE_ICON_MAP: Record<StateCivicBadgeId, typeof Award> = {
  "ward-scout": Medal,
  "state-urban-sentinel": Shield,
  "state-infrastructure-guardian": Compass,
  "national-civic-vanguard": Crown,
  "cm-civic-laureate": Users,
};

export function CivicHonorsWorkspace() {
  const router = useRouter();
  const { user, profile, authReady, displayAlias } = useFirebaseAuth();
  const { openAuthModal } = useAuthModal();
  const [selectedCertificate, setSelectedCertificate] =
    useState<CivicCertificateData | null>(null);

  const [liveUserProfile, setLiveUserProfile] =
    useState<StoredUserProfile | null>(null);
  const [livePublicProfiles, setLivePublicProfiles] = useState<
    RawFirestoreCitizenProfile[]
  >([]);
  const [loadingLiveHonors, setLoadingLiveHonors] = useState(false);

  const isGuestPreview = !user;

  // For authenticated users, dynamically load real Firestore user doc + Top 5 standings (ZERO mock values)
  useEffect(() => {
    if (!authReady) return;
    if (!user || !db) {
      setLiveUserProfile(null);
      setLivePublicProfiles([]);
      setLoadingLiveHonors(false);
      return;
    }

    let cancelled = false;
    setLoadingLiveHonors(true);

    async function loadRealCitizenHonors() {
      if (!user || !db) return;
      try {
        let ownDoc = await fetchUserProfile(user.uid);
        if (!ownDoc) {
          ownDoc = await syncUserProfileOnSignIn(user, {
            preferredAlias: user.displayName ?? undefined,
            leaderboardOptIn: true,
          });
        }

        const publicSnap = await getDocs(
          query(
            collection(db, "public_profiles"),
            where("leaderboardOptIn", "==", true),
            limit(100)
          )
        );
        const publicList: RawFirestoreCitizenProfile[] = publicSnap.docs.map(
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

        if (!cancelled) {
          setLiveUserProfile(ownDoc);
          setLivePublicProfiles(publicList);
        }
      } catch {
        // Keep safe 0-initialized state on transient network failure; never fall back to mock numbers
      } finally {
        if (!cancelled) {
          setLoadingLiveHonors(false);
        }
      }
    }

    void loadRealCitizenHonors();
    return () => {
      cancelled = true;
    };
  }, [authReady, user]);

  // Guest sample preview snapshot (ONLY used when !user, strictly tagged [Demo Data])
  const guestSnapshot = useMemo(
    () =>
      computeCitizenHonorsSnapshot({
        citizenName: "Aarav Sharma",
        userUid: null,
        ward: "Indiranagar",
        meritPoints: DEFAULT_PREVIEW_MERIT_POINTS,
        verifiedFixes: DEFAULT_PREVIEW_VERIFIED_FIXES,
        citywideRank: DEFAULT_PREVIEW_CITYWIDE_RANK,
      }),
    []
  );

  // Authenticated user's 100% live Firestore honors & dynamic Top 5 standing (ZERO mock numbers)
  const liveHonors = useMemo(() => {
    if (!user) return null;
    const activeProfile = liveUserProfile ?? profile;
    const citizenName =
      activeProfile?.displayName ||
      activeProfile?.alias ||
      displayAlias ||
      user.displayName ||
      "Bengaluru Citizen";
    const meritPoints = activeProfile?.points ?? activeProfile?.civicPoints ?? 0;
    const verifiedFixes =
      activeProfile?.resolvedCount ?? activeProfile?.resolvedReportsCount ?? 0;

    const dynamicTop5 = computeDynamicTop5Standing(livePublicProfiles, {
      uid: user.uid,
      displayName: citizenName,
      alias: activeProfile?.alias ?? citizenName,
      photoURL: activeProfile?.photoURL ?? user.photoURL ?? "",
      points: meritPoints,
      civicPoints: meritPoints,
      resolvedCount: verifiedFixes,
      resolvedReportsCount: verifiedFixes,
      reportsCount:
        activeProfile?.reportsCount ?? activeProfile?.acceptedReportsCount ?? 0,
    });

    const badges = evaluateStateCivicBadges(
      verifiedFixes,
      dynamicTop5.userRank
    );
    const unlockedBadges = badges.filter((b) => b.unlocked);
    const currentBadge = unlockedBadges[unlockedBadges.length - 1] ?? badges[0];
    const certificates = buildCertificateMilestones(
      citizenName,
      verifiedFixes,
      ANNUAL_CM_SEASON_YEAR,
      user.uid
    );
    const unlockedCertificateCount = certificates.filter(
      (c) => c.unlocked
    ).length;

    return {
      citizenName,
      ward: "Bengaluru",
      meritPoints,
      verifiedFixes,
      dynamicTop5,
      currentBadge,
      badges,
      certificates,
      unlockedCertificateCount,
    };
  }, [user, liveUserProfile, profile, displayAlias, livePublicProfiles]);

  if (!authReady || (user && loadingLiveHonors)) {
    return (
      <div className="mt-8">
        <LoadingState
          label="Syncing your live Firestore Civic Honors ledger..."
          rows={3}
        />
      </div>
    );
  }

  const citizenName = isGuestPreview
    ? guestSnapshot.citizenName
    : (liveHonors?.citizenName ?? "Bengaluru Citizen");
  const meritPoints = isGuestPreview
    ? guestSnapshot.meritPoints
    : (liveHonors?.meritPoints ?? 0);
  const verifiedFixes = isGuestPreview
    ? guestSnapshot.verifiedFixes
    : (liveHonors?.verifiedFixes ?? 0);
  const currentBadge = isGuestPreview
    ? guestSnapshot.currentBadge
    : (liveHonors?.currentBadge ?? guestSnapshot.badges[0]);
  const badges = isGuestPreview
    ? guestSnapshot.badges
    : (liveHonors?.badges ?? []);
  const certificates = isGuestPreview
    ? guestSnapshot.certificates
    : (liveHonors?.certificates ?? []);
  const unlockedCertificateCount = isGuestPreview
    ? guestSnapshot.unlockedCertificateCount
    : (liveHonors?.unlockedCertificateCount ?? 0);
  const wardLabel = isGuestPreview ? guestSnapshot.ward : "Bengaluru";

  const rankDisplay = isGuestPreview
    ? `Rank #${guestSnapshot.citywideRank}`
    : (liveHonors?.dynamicTop5.userRankLabel ?? "Unranked");

  const top5CutoffPoints = isGuestPreview
    ? guestSnapshot.top5ThresholdPoints
    : (liveHonors?.dynamicTop5.top5CutoffPoints ?? 0);
  const isPioneerZone = isGuestPreview
    ? false
    : (liveHonors?.dynamicTop5.isPioneerZone ?? true);
  const isTop5Finalist = isGuestPreview
    ? guestSnapshot.isTop5Finalist
    : (liveHonors?.dynamicTop5.isTop5Finalist ?? false);
  const pointsToTop5 = isGuestPreview
    ? guestSnapshot.pointsToTop5
    : (liveHonors?.dynamicTop5.pointsToTop5 ?? 0);
  const progressPercent = isGuestPreview
    ? guestSnapshot.top5ProgressPercent
    : (liveHonors?.dynamicTop5.progressPercent ?? 0);

  const handleReportClick = () => {
    if (!user) {
      openAuthModal({
        title: "Sign In to Report & Earn +50 Merit Points",
        message:
          "Sign in with Google to capture live-camera civic audits and earn +50 Merit Points strictly on verified fixes (AI Confidence Score ≥ 90% + Admin approval).",
        redirectTo: "/report",
      });
      return;
    }
    router.push("/report");
  };

  const openCertificateForMilestone = (milestone: CertificateMilestone) => {
    const verifiedCount = Math.max(verifiedFixes, milestone.requiredFixes);
    const sha256Hash = computeCertificateSha256({
      certificateId: milestone.certificateId,
      recipientName: citizenName,
      ward: wardLabel,
      verifiedFixes: verifiedCount,
      meritPoints,
      milestoneLevel: milestone.level,
    });
    setSelectedCertificate({
      recipientName: citizenName,
      ward: wardLabel,
      verifiedFixes: verifiedCount,
      milestoneLevel: milestone.level,
      milestoneTitle: milestone.title,
      certificateId: milestone.certificateId,
      issuedDate: formatCertificateIssueDate(),
      meritPoints,
      sha256Hash,
    });
  };

  const level1Remaining = Math.max(0, 5 - verifiedFixes);

  return (
    <PageTransition className="mt-8 space-y-10">
      {/* Guest Visitor Blue Banner — strictly shown ONLY when NOT logged in */}
      {isGuestPreview && (
        <section
          aria-label="Guest Sign-In Notice"
          data-testid="guest-preview-banner"
          className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/90 via-white to-amber-50/60 p-5 shadow-sm"
        >
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-amber-900 uppercase">
                  <Sparkles size={12} aria-hidden="true" />
                  <span>[Demo Data]</span>
                </span>
                <span className="text-xs font-semibold text-blue-700">
                  Guest Teaser Preview
                </span>
              </div>
              <p className="text-base font-bold text-slate-900">
                Sign in to view your real-time Citizen Ledger.
              </p>
              <p className="text-xs text-slate-600">
                The preview below shows [Demo Data] sample numbers (750 Merit
                Points · 7 Verified Fixes · Level 1 Certificate{" "}
                <span className="font-mono font-semibold text-slate-800">
                  CS-BLR-2026-DEMO
                </span>
                ). Sign in with Google to immediately switch to your 100% live
                Firestore profile.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                openAuthModal({
                  title: "Sign In to View Your Real-Time Citizen Ledger",
                  message:
                    "Sign in with Google to replace all [Demo Data] previews with your real Firestore Merit Points, verified fix count, and live Top 5 standing.",
                })
              }
              className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95 whitespace-nowrap"
            >
              <LogIn size={16} aria-hidden="true" />
              <span>Sign In with Google</span>
            </button>
          </div>
        </section>
      )}

      {/* Citizen Standing Card */}
      <section
        aria-label="Citizen Merit Standing"
        data-testid="citizen-honors-standing-card"
        className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm"
      >
        <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50/70 via-white to-amber-50/70 px-6 py-5">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                  <Crown size={13} aria-hidden="true" />
                  <span>{currentBadge.title}</span>
                </span>
                {isGuestPreview ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
                    [Demo Data] · Aarav Sharma
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <CheckCircle2 size={12} aria-hidden="true" />
                    <span>Live Verified Citizen Ledger · {citizenName}</span>
                  </span>
                )}
              </div>

              <h2 className="mt-3 font-[var(--font-heading)] text-xl font-bold text-slate-900 sm:text-2xl">
                {isGuestPreview
                  ? "[Demo Data] Sample Merit Points: "
                  : "Your Merit Points: "}
                <span
                  data-testid="honors-merit-points"
                  className="font-mono tabular-nums text-blue-700"
                >
                  {meritPoints.toLocaleString("en-IN")} Pts
                </span>{" "}
                <span className="text-slate-300" aria-hidden="true">
                  •
                </span>{" "}
                Current Standing:{" "}
                <span
                  data-testid="honors-rank-label"
                  className="font-mono tabular-nums text-amber-700"
                >
                  {rankDisplay}
                </span>
              </h2>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2.5">
              {isGuestPreview && (
                <button
                  type="button"
                  onClick={() =>
                    openAuthModal({
                      title: "Sign In to Sync Live Rank",
                      message:
                        "Sign in with Google to track your real Firestore standing.",
                    })
                  }
                  className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                >
                  <span>Sign In to Sync Live Rank</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleReportClick}
                className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95"
              >
                <Camera size={14} aria-hidden="true" />
                <span>Report &amp; Earn +50 Verified Pts</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Top 5 Vanguard Shortlist Zone Progress Bar */}
        <div className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p
              data-testid="honors-top5-status-text"
              className="font-semibold text-slate-900"
            >
              {isGuestPreview ? (
                <>
                  [Demo Data] {pointsToTop5.toLocaleString("en-IN")} sample
                  points to reach Top 5 preview threshold
                </>
              ) : isPioneerZone ? (
                "Pioneer Verifier Zone — Log your first verified fix to claim a Top 5 spot!"
              ) : isTop5Finalist ? (
                `Qualified inside the live Top 5 Vanguard Shortlist Zone (${rankDisplay})!`
              ) : (
                `${pointsToTop5.toLocaleString("en-IN")} points to enter the live Top 5 Vanguard Shortlist Zone`
              )}
            </p>
            <span
              data-testid="honors-top5-cutoff"
              className="font-mono text-xs font-bold tabular-nums text-blue-700"
            >
              {isGuestPreview
                ? `[Demo Data] ${meritPoints.toLocaleString("en-IN")} / ${top5CutoffPoints.toLocaleString("en-IN")} Pts`
                : `${meritPoints.toLocaleString("en-IN")} / ${top5CutoffPoints.toLocaleString("en-IN")} Pts (Live Top 5 Cutoff)`}
            </span>
          </div>

          <div
            className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-label="Progress toward Top 5 Vanguard Shortlist Zone"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="h-full rounded-full bg-gradient-to-r from-blue-600 via-blue-500 to-amber-500"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                Verified Fixes:{" "}
                <strong
                  data-testid="honors-verified-fixes"
                  className="font-mono font-bold tabular-nums text-slate-900"
                >
                  {verifiedFixes}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Certificates Unlocked:{" "}
                <strong
                  data-testid="honors-certificates-count"
                  className="font-mono font-bold tabular-nums text-emerald-700"
                >
                  {unlockedCertificateCount}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Ledger Mode:{" "}
                <strong className="font-semibold text-slate-900">
                  {isGuestPreview
                    ? "[Demo Data] Guest Preview"
                    : "Real-Time Firestore Sync"}
                </strong>
              </span>
            </div>

            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700"
            >
              <span>View Live Vanguard Standings</span>
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Real Logged-In User Locked Certificate Progress Banner (< 5 Verified Reports) */}
      {!isGuestPreview && verifiedFixes < 5 && (
        <section
          aria-label="Certificate Unlock Progress"
          data-testid="real-user-locked-banner"
          className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/80 via-white to-slate-50 p-5 shadow-sm sm:p-6"
        >
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                <Lock size={12} aria-hidden="true" />
                <span>Level 1 Civic Merit Certificate Locked</span>
              </span>
              <h3 className="mt-2 font-[var(--font-heading)] text-lg font-bold text-slate-900">
                Hi {citizenName}, complete 5 verified fixes to unlock your
                SHA-256 Civic Merit Certificate.
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Progress to First Certificate:{" "}
                <strong className="font-mono font-bold text-blue-700">
                  {verifiedFixes} / 5 Verified Fixes
                </strong>{" "}
                ({level1Remaining}{" "}
                {level1Remaining === 1 ? "verified fix" : "verified fixes"}{" "}
                remaining).
              </p>
            </div>
            <Link
              href="/report"
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95 whitespace-nowrap"
            >
              <Camera size={15} aria-hidden="true" />
              <span>Submit a Live Report</span>
            </Link>
          </div>
        </section>
      )}

      {/* Automated Digital Certificates Section */}
      <section aria-label="Automated Digital Civic Merit Certificates">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-wide text-blue-600">
              SHA-256 Tamper-Evident Credentials
            </p>
            <h2 className="mt-1.5 font-[var(--font-heading)] text-2xl font-bold text-slate-900">
              Automated Digital Civic Merit Certificates
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">
              Every 5 verified infrastructure repairs unlock a{" "}
              {CERTIFICATE_RECORD_LABEL} with a unique{" "}
              <span className="font-mono text-xs font-semibold text-slate-800">
                CS-BLR-2026
              </span>{" "}
              ID, deterministic SHA-256 hash, scannable QR link, and LinkedIn
              export.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {certificates.map((milestone) => (
            <HoverCard
              key={milestone.level}
              className={`flex flex-col justify-between p-6 ${
                milestone.unlocked
                  ? "border-amber-300/90 bg-gradient-to-b from-amber-50/40 via-white to-white ring-1 ring-amber-400/20"
                  : "bg-white"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      milestone.unlocked
                        ? isGuestPreview
                          ? "border-amber-300 bg-amber-50 text-amber-800"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-100 text-slate-600"
                    }`}
                  >
                    {milestone.unlocked ? (
                      <CheckCircle2 size={12} aria-hidden="true" />
                    ) : (
                      <Lock size={12} aria-hidden="true" />
                    )}
                    <span>
                      {milestone.unlocked
                        ? isGuestPreview
                          ? "[Demo Data] Sample"
                          : "Unlocked & Ready"
                        : "Locked"}
                    </span>
                  </span>
                  <span className="font-mono text-xs font-bold tabular-nums text-slate-500">
                    Level {milestone.level}
                  </span>
                </div>

                {/* Mini Certificate Frame Preview */}
                <div
                  className={`relative mt-4 rounded-xl border p-4 text-center ${
                    milestone.unlocked
                      ? "border-amber-300/80 bg-white"
                      : "border-dashed border-slate-200 bg-slate-50/80"
                  }`}
                >
                  {isGuestPreview && milestone.unlocked && (
                    <span className="absolute right-2.5 top-2.5 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-amber-900 uppercase">
                      [DEMO DATA]
                    </span>
                  )}
                  <div
                    className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full ${
                      milestone.unlocked
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-200/80 text-slate-500"
                    }`}
                  >
                    <FileCheck2 size={20} aria-hidden="true" />
                  </div>
                  <p className="mt-2.5 text-[10px] font-bold tracking-wider text-blue-700 uppercase">
                    {CERTIFICATE_RECORD_LABEL}
                  </p>
                  <h3 className="mt-1 text-sm font-bold leading-snug text-slate-900">
                    {milestone.title}
                  </h3>
                  <p className="mt-1 font-mono text-[11px] tabular-nums text-slate-500">
                    {milestone.unlocked
                      ? `ID: ${milestone.certificateId}`
                      : `${milestone.completedFixes}/${milestone.requiredFixes} Verified Fixes completed`}
                  </p>
                </div>

                <p className="mt-3 text-xs leading-5 text-slate-600">
                  {milestone.subtitle}
                </p>

                {/* Progress Bar for Locked Milestones */}
                {!milestone.unlocked && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                      <span>
                        {milestone.completedFixes}/{milestone.requiredFixes}{" "}
                        Verified Fixes completed
                      </span>
                      <span className="font-mono tabular-nums">
                        {milestone.progressPercent}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all"
                        style={{ width: `${milestone.progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 border-t border-slate-100 pt-4">
                {milestone.unlocked ? (
                  <button
                    type="button"
                    onClick={() => openCertificateForMilestone(milestone)}
                    className="inline-flex min-h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95"
                  >
                    <Award size={16} aria-hidden="true" />
                    <span>
                      {isGuestPreview
                        ? "Preview Sample Certificate"
                        : "View & Download Certificate"}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleReportClick}
                    className="inline-flex min-h-[42px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    <span>
                      Verify {milestone.requiredFixes - milestone.completedFixes}{" "}
                      more{" "}
                      {milestone.requiredFixes - milestone.completedFixes === 1
                        ? "fix"
                        : "fixes"}{" "}
                      to unlock
                    </span>
                    <ArrowRight size={13} aria-hidden="true" />
                  </button>
                )}
              </div>
            </HoverCard>
          ))}
        </div>
      </section>

      {/* Independent 5-Tier Civic Badge Showcase */}
      <section aria-label="CivicSnap 5-Tier Recognition Ladder">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-wide text-blue-600">
            5-Tier Independent Audit Recognition Ladder
          </p>
          <h2 className="mt-1.5 font-[var(--font-heading)] text-2xl font-bold text-slate-900">
            Bengaluru Civic Vanguard Badge Showcase
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-slate-600">
            Progress from neighborhood Ward Scout to Bengaluru Urban Sentinel,
            Infrastructure Audit Guardian, Bengaluru Civic Vanguard, and the Top
            5 Civic Vanguard Laureate shortlist.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {badges.map((badge) => {
            const Icon = BADGE_ICON_MAP[badge.id];
            const isShortlistExclusive = Boolean(badge.top5Only);
            return (
              <HoverCard
                key={badge.id}
                className={`flex flex-col justify-between p-5 ${
                  badge.unlocked
                    ? "border-blue-200 bg-white"
                    : isShortlistExclusive
                      ? "border-amber-200/90 bg-gradient-to-b from-amber-50/40 to-white"
                      : "border-slate-200/80 bg-slate-50/70"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                        badge.unlocked
                          ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                          : isShortlistExclusive
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-200/80 text-slate-500"
                      }`}
                    >
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <span className="font-mono text-[11px] font-bold text-slate-400">
                      LVL {badge.level}
                    </span>
                  </div>

                  <p
                    className={`mt-4 text-[11px] font-semibold ${
                      isShortlistExclusive ? "text-amber-700" : "text-blue-600"
                    }`}
                  >
                    {badge.tierScope}
                  </p>
                  <h3 className="mt-0.5 text-base font-bold text-slate-900">
                    {badge.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-5 text-slate-600">
                    {badge.description}
                  </p>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  {badge.unlocked ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 size={14} aria-hidden="true" />
                      <span>
                        {isGuestPreview ? "[Demo Data] · " : "Unlocked · "}
                        {badge.requirementLabel}
                      </span>
                    </span>
                  ) : isShortlistExclusive ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                      <Trophy size={13} aria-hidden="true" />
                      <span>Top 5 Shortlist · Panel Reviewed</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                      <Lock size={13} aria-hidden="true" />
                      <span>
                        Locked · {badge.fixesRemaining}{" "}
                        {badge.fixesRemaining === 1 ? "fix" : "fixes"} away
                      </span>
                    </span>
                  )}
                </div>
              </HoverCard>
            );
          })}
        </div>
      </section>

      {/* Bengaluru Civic Vanguard Citation Info Strip (No static fake close date) */}
      <section
        aria-label="Bengaluru Civic Vanguard Citation details"
        className="rounded-2xl border border-amber-200/90 bg-gradient-to-br from-white via-amber-50/35 to-blue-50/40 p-6 shadow-sm sm:p-8"
      >
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
              <Award size={13} aria-hidden="true" />
              <span>{ANNUAL_CM_SUMMIT_TITLE}</span>
            </div>
            <h2 className="mt-3 font-[var(--font-heading)] text-2xl font-bold text-slate-900">
              Bengaluru Civic Vanguard Citation
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">
              The Top 5 Bengaluru citizens with the highest verified Merit
              Points in the live Firestore ledger are reviewed by an independent
              community review panel for the Bengaluru Civic Vanguard Citation.
            </p>
          </div>
          <Link
            href="/leaderboard"
            className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95 whitespace-nowrap"
          >
            <Trophy size={15} aria-hidden="true" />
            <span>View Live Vanguard Shortlist</span>
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CM_ANNUAL_AWARD_PERKS.map((perk) => (
            <div
              key={perk.number}
              className="rounded-xl border border-slate-200/90 bg-white p-4"
            >
              <span className="font-mono text-xs font-bold text-amber-700">
                {perk.number}
              </span>
              <h3 className="mt-1.5 text-sm font-bold text-slate-900">
                {perk.title}
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                {perk.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-amber-200/70 pt-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
            <ShieldCheck size={14} className="text-blue-600" aria-hidden="true" />
            <span>
              +50 Merit Points are awarded strictly on Admin-approved repairs
              with an AI Confidence Score ≥ 90%.
            </span>
          </span>
          <span className="font-mono font-semibold text-emerald-700">
            Live Open Civic Audit Ledger
          </span>
        </div>
      </section>

      {/* Dynamic Client-Side Certificate Modal */}
      <CertificateModal
        certificate={selectedCertificate}
        isSamplePreview={isGuestPreview}
        onClose={() => setSelectedCertificate(null)}
      />
    </PageTransition>
  );
}
