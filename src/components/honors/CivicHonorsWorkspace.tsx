"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight,
  Award,
  Camera,
  CheckCircle2,
  Compass,
  Crown,
  FileCheck2,
  Landmark,
  Lock,
  Medal,
  Shield,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useFirebaseAuth } from "@/components/providers/FirebaseAuthProvider";
import { CertificateModal } from "@/components/CertificateModal";
import { HoverCard, PageTransition } from "@/components/ui/MotionPrimitives";
import {
  ANNUAL_CM_SEASON_CLOSE_LABEL,
  ANNUAL_CM_SEASON_YEAR,
  CM_ANNUAL_AWARD_PERKS,
  computeCitizenHonorsSnapshot,
  DEFAULT_PREVIEW_CITYWIDE_RANK,
  DEFAULT_PREVIEW_MERIT_POINTS,
  DEFAULT_PREVIEW_VERIFIED_FIXES,
  formatCertificateIssueDate,
} from "@/lib/civic-honors";
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
  "cm-civic-laureate": Landmark,
};

export function CivicHonorsWorkspace() {
  const { user, profile, displayAlias } = useFirebaseAuth();
  const [selectedCertificate, setSelectedCertificate] =
    useState<CivicCertificateData | null>(null);
  const [previewSampleStanding, setPreviewSampleStanding] = useState(false);

  const hasLiveVerifiedFixes =
    Boolean(user) && (profile?.resolvedReportsCount ?? 0) > 0;
  const usingDemoPreview = !user || previewSampleStanding;

  const honors = useMemo(() => {
    const citizenName =
      usingDemoPreview && !user
        ? "Aarav Sharma (Bengaluru Pilot)"
        : displayAlias || user?.displayName || "Bengaluru Citizen Steward";

    const meritPoints = usingDemoPreview
      ? DEFAULT_PREVIEW_MERIT_POINTS
      : (profile?.civicPoints ?? 0);

    const verifiedFixes = usingDemoPreview
      ? DEFAULT_PREVIEW_VERIFIED_FIXES
      : (profile?.resolvedReportsCount ?? 0);

    const citywideRank = usingDemoPreview
      ? DEFAULT_PREVIEW_CITYWIDE_RANK
      : undefined;

    return computeCitizenHonorsSnapshot({
      citizenName,
      ward: "Indiranagar",
      meritPoints,
      verifiedFixes,
      citywideRank,
    });
  }, [displayAlias, profile, user, usingDemoPreview]);

  const openCertificateForMilestone = (milestone: CertificateMilestone) => {
    setSelectedCertificate({
      recipientName: honors.citizenName.replace(/\s*\(Bengaluru Pilot\)$/, ""),
      ward: honors.ward,
      verifiedFixes: Math.max(honors.verifiedFixes, milestone.requiredFixes),
      milestoneLevel: milestone.level,
      milestoneTitle: milestone.title,
      certificateId: milestone.certificateId,
      issuedDate: formatCertificateIssueDate(),
      meritPoints: honors.meritPoints,
    });
  };

  return (
    <PageTransition className="mt-8 space-y-10">
      {/* Citizen Standing Card */}
      <section
        aria-label="Citizen Merit Standing"
        className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm"
      >
        <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50/70 via-white to-amber-50/70 px-6 py-5">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                  <Crown size={13} aria-hidden="true" />
                  <span>{honors.currentBadge.title}</span>
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {usingDemoPreview
                    ? user
                      ? "Previewing 7-fix State Sentinel Standing"
                      : "Interactive Pilot Preview · Sign in to sync live standing"
                    : "Live Verified Citizen Ledger"}
                </span>
              </div>

              <h2 className="mt-3 font-[var(--font-heading)] text-xl font-bold text-slate-900 sm:text-2xl">
                Your Merit Points:{" "}
                <span className="font-mono tabular-nums text-blue-700">
                  {honors.meritPoints.toLocaleString("en-IN")} Pts
                </span>{" "}
                <span className="text-slate-300" aria-hidden="true">
                  •
                </span>{" "}
                Current Standing:{" "}
                <span className="font-mono tabular-nums text-amber-700">
                  Rank #{honors.citywideRank}
                </span>{" "}
                <span className="text-base font-medium text-slate-500">
                  (Bengaluru Wide)
                </span>
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {user && !hasLiveVerifiedFixes && (
                <button
                  type="button"
                  onClick={() => setPreviewSampleStanding((prev) => !prev)}
                  className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100"
                >
                  <Sparkles size={13} aria-hidden="true" />
                  <span>
                    {previewSampleStanding
                      ? "Show My Live Standing"
                      : "Preview Unlocked Certificates"}
                  </span>
                </button>
              )}
              {!user && (
                <Link
                  href="/login?next=%2Frewards"
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                >
                  <span>Sign In to Sync Live Rank</span>
                </Link>
              )}
              <Link
                href="/report"
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95"
              >
                <Camera size={14} aria-hidden="true" />
                <span>Report &amp; Earn +50 Merit Pts</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Top 5 CM Finalist Zone Progress Bar */}
        <div className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="font-semibold text-slate-900">
              {honors.isTop5Finalist
                ? "Qualified inside the Top 5 CM Finalist Zone for the Annual Urban Governance Summit!"
                : `${honors.pointsToTop5.toLocaleString("en-IN")} points to enter the Top 5 CM Finalist Zone`}
            </p>
            <span className="font-mono text-xs font-bold tabular-nums text-blue-700">
              {honors.meritPoints.toLocaleString("en-IN")} /{" "}
              {honors.top5ThresholdPoints.toLocaleString("en-IN")} Pts
            </span>
          </div>

          <div
            className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-label="Progress toward Top 5 CM Finalist Zone"
            aria-valuenow={honors.top5ProgressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${honors.top5ProgressPercent}%` }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="h-full rounded-full bg-gradient-to-r from-blue-600 via-blue-500 to-amber-500"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                Verified Fixes:{" "}
                <strong className="font-mono font-bold tabular-nums text-slate-900">
                  {honors.verifiedFixes}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Certificates Unlocked:{" "}
                <strong className="font-mono font-bold tabular-nums text-emerald-700">
                  {honors.unlockedCertificateCount}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {ANNUAL_CM_SEASON_YEAR} Season Closes:{" "}
                <strong className="font-semibold text-slate-900">
                  {ANNUAL_CM_SEASON_CLOSE_LABEL}
                </strong>
              </span>
            </div>

            <Link
              href="/ward-wars"
              className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700"
            >
              <span>View Annual CM Standings</span>
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Instant Auto-Generated Digital Certificates Section */}
      <section aria-label="Automated Digital Civic Merit Certificates">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-wide text-blue-600">
              Zero-Overhead Client-Side Credentials
            </p>
            <h2 className="mt-1.5 font-[var(--font-heading)] text-2xl font-bold text-slate-900">
              Automated Digital Civic Merit Certificates
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">
              Every 5 AI-verified infrastructure repairs automatically unlock a
              signed Bengaluru Urban Merit Certificate with a unique hash ID,
              embossed verification seal, and one-click LinkedIn sharing.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {honors.certificates.map((milestone) => (
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
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-100 text-slate-600"
                    }`}
                  >
                    {milestone.unlocked ? (
                      <CheckCircle2 size={12} aria-hidden="true" />
                    ) : (
                      <Lock size={12} aria-hidden="true" />
                    )}
                    <span>
                      {milestone.unlocked ? "Unlocked & Ready" : "Locked"}
                    </span>
                  </span>
                  <span className="font-mono text-xs font-bold tabular-nums text-slate-500">
                    Level {milestone.level}
                  </span>
                </div>

                {/* Mini Certificate Frame Preview */}
                <div
                  className={`mt-4 rounded-xl border p-4 text-center ${
                    milestone.unlocked
                      ? "border-amber-300/80 bg-white"
                      : "border-dashed border-slate-200 bg-slate-50/80"
                  }`}
                >
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
                    Bengaluru Urban Merit Seal
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
                    <span>View &amp; Download Certificate</span>
                  </button>
                ) : (
                  <Link
                    href="/report"
                    className="inline-flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
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
                  </Link>
                )}
              </div>
            </HoverCard>
          ))}
        </div>
      </section>

      {/* State & National Badge Showcase (5 Tiers) */}
      <section aria-label="State and National Civic Badges">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-wide text-blue-600">
            Official 5-Tier Recognition Ladder
          </p>
          <h2 className="mt-1.5 font-[var(--font-heading)] text-2xl font-bold text-slate-900">
            State &amp; National Civic Badge Showcase
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-slate-600">
            Progress from neighborhood Ward Scout to State Urban Sentinel,
            National Civic Vanguard, and the exclusive Chief Minister&apos;s
            Civic Laureate podium.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {honors.badges.map((badge) => {
            const Icon = BADGE_ICON_MAP[badge.id];
            const isCmExclusive = Boolean(badge.top5Only);
            return (
              <HoverCard
                key={badge.id}
                className={`flex flex-col justify-between p-5 ${
                  badge.unlocked
                    ? "border-blue-200 bg-white"
                    : isCmExclusive
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
                          : isCmExclusive
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
                      isCmExclusive ? "text-amber-700" : "text-blue-600"
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
                      <span>Unlocked · {badge.requirementLabel}</span>
                    </span>
                  ) : isCmExclusive ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                      <Trophy size={13} aria-hidden="true" />
                      <span>Exclusive to Annual Top 5</span>
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

      {/* Annual CM Summit Podium Perks Strip */}
      <section
        aria-label="Chief Minister Annual Civic Champions Award details"
        className="rounded-2xl border border-amber-200/90 bg-gradient-to-br from-white via-amber-50/35 to-blue-50/40 p-6 shadow-sm sm:p-8"
      >
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
              <Landmark size={13} aria-hidden="true" />
              <span>Annual Urban Governance Summit · Bengaluru</span>
            </div>
            <h2 className="mt-3 font-[var(--font-heading)] text-2xl font-bold text-slate-900">
              The Chief Minister&apos;s Annual Civic Champions Award
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">
              At year-end ({ANNUAL_CM_SEASON_CLOSE_LABEL}), the Top 5 Bengaluru
              citizens with the highest AI-verified Merit Points receive state
              honors directly from the Hon&apos;ble Chief Minister.
            </p>
          </div>
          <Link
            href="/ward-wars"
            className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95 whitespace-nowrap"
          >
            <Trophy size={15} aria-hidden="true" />
            <span>View Annual CM Race</span>
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
              Every Before-vs-After AI-verified repair logs +50 Merit Points
              towards your Annual CM Podium ranking.
            </span>
          </span>
          <span className="font-mono font-semibold text-amber-800">
            Season Closes: {ANNUAL_CM_SEASON_CLOSE_LABEL},{" "}
            {ANNUAL_CM_SEASON_YEAR}
          </span>
        </div>
      </section>

      {/* Dynamic Client-Side Certificate Modal */}
      <CertificateModal
        certificate={selectedCertificate}
        onClose={() => setSelectedCertificate(null)}
      />
    </PageTransition>
  );
}
