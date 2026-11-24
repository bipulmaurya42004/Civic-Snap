"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Award,
  Camera,
  CheckCircle2,
  Clock,
  Coins,
  ExternalLink,
  FileCheck2,
  Landmark,
  Loader2,
  Medal,
  Mic,
  ShieldCheck,
  Siren,
  Sparkles,
  Trophy,
  Wrench,
} from "lucide-react";
import { SafeCivicImage } from "@/components/ui/SafeCivicImage";
import { FaqAccordion } from "@/components/landing/FaqAccordion";
import { CertificateModal } from "@/components/CertificateModal";
import { useFirebaseAuth } from "@/components/providers/FirebaseAuthProvider";
import { useAuthModal } from "@/components/AuthModal";
import {
  HoverCard,
  PageTransition,
  StaggerReveal,
} from "@/components/ui/MotionPrimitives";
import { generateQrMatrix } from "@/lib/bengaluru-feed-data";
import {
  ANNUAL_CM_SEASON_CLOSE_LABEL,
  ANNUAL_CM_SEASON_YEAR,
  ANNUAL_CM_SUMMIT_TITLE,
  buildCertificateVerifyUrl,
  CM_ANNUAL_AWARD_PERKS,
  CM_HERO_SPOTLIGHT_PILLARS,
  formatCertificateIssueDate,
  generateCertificateId,
} from "@/lib/civic-honors";
import type { CivicCertificateData } from "@/types/civic";

const HOW_IT_WORKS_STEPS = [
  {
    step: "01",
    title: "Snap & Speak",
    description:
      "CivicSnap AI captures your live GPS ward and converts natural Hindi or Hinglish speech into a structured English civic report in seconds.",
    icon: Camera,
  },
  {
    step: "02",
    title: "AI Material Audit",
    description:
      "Prevents contractor overbilling by estimating exact repair materials (asphalt tonnage, LED fixtures, labor hours) and flagging Hospital/School priority zones.",
    icon: Wrench,
  },
  {
    step: "03",
    title: "Verified Fix & 2026 State Honors",
    description:
      "CivicSnap Vision AI verifies the contractor's After photo, logs +50 Civic Merit Points toward Annual 2026 CM Standings, and automatically unlocks Digital Merit Certificates every 5 fixes.",
    icon: Award,
  },
] as const;

const PILLAR_ICONS = {
  medal: Medal,
  grant: Coins,
  warden: Landmark,
} as const;

const HINGLISH_DEMO_PHRASE = "Bhai Chinmaya Hospital road pe deep pothole hai";
const SAMPLE_CERT_ID = generateCertificateId(
  "Aarav Sharma",
  1,
  ANNUAL_CM_SEASON_YEAR
);

export function HomeLandingClient() {
  const { user } = useFirebaseAuth();
  const { openAuthModal } = useAuthModal();
  const [auditView, setAuditView] = useState<"before" | "after">("after");
  const [voiceDemoBusy, setVoiceDemoBusy] = useState(false);
  const [voiceDemoResult, setVoiceDemoResult] = useState<{
    title: string;
    categoryDisplay: string;
    description: string;
  } | null>(null);
  const [previewCertificate, setPreviewCertificate] =
    useState<CivicCertificateData | null>(null);

  const sampleQrMatrix = useMemo(
    () => generateQrMatrix(buildCertificateVerifyUrl(SAMPLE_CERT_ID)),
    []
  );

  const handleReportAction = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!user) {
      event.preventDefault();
      openAuthModal({
        title: "Sign In to Report a Civic Issue",
        message:
          "Sign in with Google to file verified 2026 road, streetlight, or waste audits and earn +50 Merit Points toward the Chief Minister's Civic Champions Award.",
        redirectTo: "/report",
      });
    }
  };

  const handleOpenSampleCertificate = () => {
    setPreviewCertificate({
      recipientName: "Aarav Sharma",
      ward: "Ward 82 · Indiranagar",
      verifiedFixes: 5,
      milestoneLevel: 1,
      milestoneTitle:
        "Official Civic Merit Certificate (Level 1: 5 Verified Fixes)",
      certificateId: SAMPLE_CERT_ID,
      issuedDate: formatCertificateIssueDate(),
      meritPoints: 750,
    });
  };

  const handleRunHinglishDemo = async () => {
    setVoiceDemoBusy(true);
    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "voice_to_report",
          transcript: HINGLISH_DEMO_PHRASE,
        }),
      });
      const data = (await res.json()) as {
        title?: string;
        categoryDisplay?: string;
        description?: string;
      };
      if (res.ok && data.title && data.description) {
        setVoiceDemoResult({
          title: data.title,
          categoryDisplay: data.categoryDisplay || "Pothole",
          description: data.description,
        });
      } else {
        setVoiceDemoResult({
          title: "Deep Pothole near Chinmaya Mission Hospital Road",
          categoryDisplay: "Pothole",
          description:
            "A deep road pothole on the Chinmaya Mission Hospital approach road poses an acute hazard to ambulances and two-wheelers. Immediate hot-mix asphalt patching requested.",
        });
      }
    } catch {
      setVoiceDemoResult({
        title: "Deep Pothole near Chinmaya Mission Hospital Road",
        categoryDisplay: "Pothole",
        description:
          "A deep road pothole on the Chinmaya Mission Hospital approach road poses an acute hazard to ambulances and two-wheelers. Immediate hot-mix asphalt patching requested.",
      });
    } finally {
      setVoiceDemoBusy(false);
    }
  };

  return (
    <PageTransition>
      {/* HERO SECTION — Clean White to Soft Slate Gradient with Grand 2026 CM Spotlight */}
      <section className="border-b border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
          <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-10">
            {/* Left Column: Royal Gold Badge + Power Dual Headline + Grand CM Spotlight Card + CTAs */}
            <div className="lg:col-span-7">
              {/* Top Royal Gold Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-900 shadow-sm sm:text-sm">
                <Trophy
                  size={15}
                  aria-hidden="true"
                  className="shrink-0 text-amber-600"
                />
                <span>
                  Official Karnataka State Initiative • Annual CM Civic Honors{" "}
                  {ANNUAL_CM_SEASON_YEAR}
                </span>
              </div>

              {/* Power Dual Headline */}
              <h1
                className="mt-4 font-[var(--font-heading)] font-extrabold leading-[1.08] tracking-tight text-slate-900"
                style={{
                  fontSize: "clamp(2.15rem, 3.8vw, 3.25rem)",
                  textWrap: "balance",
                }}
              >
                Turn Broken Roads into Verified Fixes.
                <span className="mt-1.5 block bg-gradient-to-r from-blue-700 via-blue-600 to-amber-600 bg-clip-text text-transparent">
                  Win the Chief Minister&apos;s State Medal &amp; Honors.
                </span>
              </h1>

              {/* Grand "CM Civic Champions Spotlight Card" Prominently Inside Hero */}
              <div
                data-testid="hero-cm-spotlight-card"
                className="mt-6 mb-6 rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50/90 via-white to-amber-50/70 p-5 text-left shadow-md shadow-amber-500/10 sm:p-6"
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-amber-900 uppercase sm:text-sm">
                    <Landmark
                      size={16}
                      aria-hidden="true"
                      className="shrink-0 text-amber-700"
                    />
                    <span>
                      THE CHIEF MINISTER&apos;S ANNUAL CIVIC CHAMPIONS TROPHY
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100/90 px-3 py-1 text-[11px] font-bold text-amber-950 whitespace-nowrap">
                    <Clock size={12} aria-hidden="true" />
                    <span>2026 Season Closes Dec 31</span>
                  </span>
                </div>

                {/* Hero Subtext */}
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  The Top 5 Bengaluru citizens with the highest AI-verified
                  fixes in 2026 will be personally felicitated by the
                  Hon&apos;ble Chief Minister at the Annual Urban Governance
                  Summit at Vidhana Soudha.
                </p>

                {/* 3 Prestige Pillars */}
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {CM_HERO_SPOTLIGHT_PILLARS.map((pillar) => {
                    const PillarIcon = PILLAR_ICONS[pillar.id];
                    return (
                      <div
                        key={pillar.id}
                        className="rounded-xl border border-amber-200/80 bg-white/95 p-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                            <PillarIcon size={15} aria-hidden="true" />
                          </span>
                          <p className="text-xs font-bold leading-snug text-slate-900">
                            {pillar.title}
                          </p>
                        </div>
                        <p className="mt-1.5 text-[11px] leading-4 text-slate-600">
                          {pillar.subtitle}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Certificate Tagline */}
                <p className="mt-4 border-t border-amber-200/70 pt-3 text-xs font-semibold text-amber-900">
                  ✦ Plus: Automatically receive official digital Bengaluru Urban
                  merit certificates for every 5 verified reports.
                </p>
              </div>

              {/* Action CTAs */}
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  href="/report"
                  onClick={handleReportAction}
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 active:scale-95 whitespace-nowrap sm:w-auto"
                >
                  <Camera size={17} aria-hidden="true" />
                  <span>Report an Issue</span>
                </Link>
                <Link
                  href="/ward-wars"
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-5 py-3 text-sm font-semibold text-amber-900 shadow-xs transition-all hover:bg-amber-50 whitespace-nowrap sm:w-auto"
                >
                  <Trophy
                    size={16}
                    aria-hidden="true"
                    className="text-amber-600"
                  />
                  <span>View 2026 CM Standings &amp; Leaderboard</span>
                </Link>
              </div>

              {/* Interactive Hinglish Voice Demo Pill */}
              <div className="mt-5 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Mic size={16} aria-hidden="true" />
                    </span>
                    <p className="text-xs leading-5 text-slate-700">
                      <span className="font-semibold text-slate-900">
                        &ldquo;{HINGLISH_DEMO_PHRASE}&rdquo;
                      </span>
                      <span className="block text-slate-500">
                        Sirf photo nahi, follow-up bhi · Hinglish Voice AI
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRunHinglishDemo()}
                    disabled={voiceDemoBusy}
                    className="inline-flex min-h-[38px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 transition-all hover:bg-blue-100 active:scale-95 disabled:opacity-60 whitespace-nowrap"
                  >
                    {voiceDemoBusy ? (
                      <Loader2
                        size={13}
                        className="animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Sparkles size={13} aria-hidden="true" />
                    )}
                    <span>
                      {voiceDemoBusy
                        ? "Converting..."
                        : "Try Hinglish Voice Report"}
                    </span>
                  </button>
                </div>

                <AnimatePresence>
                  {voiceDemoResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                      className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-800">
                          <CheckCircle2 size={13} aria-hidden="true" />
                          <span>
                            Structured Report Draft ·{" "}
                            {voiceDemoResult.categoryDisplay}
                          </span>
                        </span>
                        <Link
                          href="/report"
                          onClick={handleReportAction}
                          className="font-semibold text-blue-700 hover:underline"
                        >
                          Open in /report →
                        </Link>
                      </div>
                      <p className="mt-1.5 font-semibold text-slate-900">
                        {voiceDemoResult.title}
                      </p>
                      <p className="mt-0.5 leading-5 text-slate-600">
                        {voiceDemoResult.description}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Right Column: Interactive AI Audit & Verification Card */}
            <div className="lg:col-span-5">
              <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
                {/* Card Top Header + Interactive Toggle */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      <CheckCircle2 size={12} aria-hidden="true" />
                      <span>AI Verified</span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                      <Siren size={12} aria-hidden="true" />
                      <span>Hospital Zone</span>
                    </span>
                  </div>

                  {/* Interactive Before / After Switcher */}
                  <div
                    role="tablist"
                    aria-label="Toggle before and after road repair photo"
                    className="inline-flex rounded-xl border border-slate-200 bg-white p-1"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={auditView === "before"}
                      onClick={() => setAuditView("before")}
                      className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                        auditView === "before"
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Before
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={auditView === "after"}
                      onClick={() => setAuditView("after")}
                      className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                        auditView === "after"
                          ? "bg-blue-600 text-white"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      After Fix
                    </button>
                  </div>
                </div>

                {/* Photo Stage */}
                <div className="relative h-60 w-full overflow-hidden bg-slate-100 sm:h-64">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={auditView}
                      initial={{ opacity: 0.25 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0.25 }}
                      transition={{ duration: 0.22 }}
                      className="h-full w-full"
                    >
                      <SafeCivicImage
                        src={
                          auditView === "before"
                            ? "/demo/pothole.jpg"
                            : "/demo/pothole-fixed.jpg"
                        }
                        alt={
                          auditView === "before"
                            ? "Before repair: Severe pothole on 100ft Road Indiranagar"
                            : "After repair: Smooth freshly patched asphalt on 100ft Road Indiranagar"
                        }
                        className="h-full w-full object-cover"
                      />
                    </motion.div>
                  </AnimatePresence>

                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/80 via-slate-900/30 to-transparent px-5 pb-3.5 pt-10 text-white">
                    <p className="text-xs font-medium text-white/85">
                      {auditView === "before"
                        ? "Reported Hazard · Ward 82 (Indiranagar)"
                        : "Contractor Proof Verified · 94.8% Visual Match"}
                    </p>
                    <p className="mt-0.5 text-sm font-bold">
                      Severe Pothole near Chinmaya Mission Hospital
                    </p>
                  </div>
                </div>

                {/* CivicSnap AI Engineering Audit Box + Verification Merit Pill */}
                <div className="p-5">
                  <p className="text-xs font-semibold text-blue-600">
                    CivicSnap AI Engineering &amp; Material Audit
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-center">
                    <div>
                      <p className="font-mono text-sm font-bold tabular-nums text-slate-900 sm:text-base">
                        ~140 kg
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                        Asphalt Required
                      </p>
                    </div>
                    <div className="border-x border-slate-200 px-1">
                      <p className="font-mono text-sm font-bold tabular-nums text-slate-900 sm:text-base">
                        ₹3,200
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                        Estimated Cost
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-sm font-bold tabular-nums text-blue-700 sm:text-base">
                        Ward 82
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                        Indiranagar
                      </p>
                    </div>
                  </div>

                  {/* Verification Merit Pill */}
                  <div className="mt-3.5 rounded-xl border border-emerald-200/90 bg-emerald-50/70 px-3.5 py-2.5 text-xs font-semibold leading-5 text-emerald-900">
                    <span className="inline-flex items-start gap-2">
                      <CheckCircle2
                        size={15}
                        className="mt-0.5 shrink-0 text-emerald-600"
                        aria-hidden="true"
                      />
                      <span>
                        AI Before-vs-After Verified (94.8% Match) •{" "}
                        <strong className="text-amber-800">
                          +50 Merit Points
                        </strong>{" "}
                        awarded toward Annual 2026 CM Standings!
                      </span>
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <Link
                      href="/rewards"
                      className="font-semibold text-amber-800 hover:underline"
                    >
                      Track 2026 Badges &amp; Certificates
                    </Link>
                    <Link
                      href="/admin?mode=judge"
                      className="inline-flex items-center gap-1 font-semibold text-blue-600 transition-colors hover:text-blue-700"
                    >
                      <span>Open Audit Verification View</span>
                      <ArrowRight size={13} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 1 — Annual CM Summit 2026 Prestige Breakdown */}
      <section
        id="cm-honors"
        className="scroll-mt-20 border-b border-slate-200/80 bg-gradient-to-br from-white via-amber-50/40 to-blue-50/45 py-16 sm:py-20"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                <Landmark size={13} aria-hidden="true" />
                <span>{ANNUAL_CM_SUMMIT_TITLE}</span>
              </span>
              <h2
                className="mt-3 font-[var(--font-heading)] text-2xl font-bold text-slate-900 sm:text-4xl"
                style={{ textWrap: "balance" }}
              >
                The 2026 Chief Minister&apos;s Annual Civic Champions Trophy
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                Held annually once at the {ANNUAL_CM_SUMMIT_TITLE} at Vidhana
                Soudha. The top 5 citizen stewards with the highest AI-verified
                points receive official state honors, medals, and civic grants
                directly from the Hon&apos;ble Chief Minister.
              </p>
            </div>

            <Link
              href="/ward-wars"
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95 whitespace-nowrap"
            >
              <Trophy size={16} aria-hidden="true" />
              <span>View 2026 Top 5 CM Race</span>
            </Link>
          </div>

          {/* 4 Key Perks of Top 5 */}
          <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {CM_ANNUAL_AWARD_PERKS.map((perk, idx) => (
              <StaggerReveal key={perk.number} delay={idx * 0.05}>
                <HoverCard className="flex h-full flex-col justify-between border-amber-200/80 bg-white p-5 sm:p-6">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 font-mono text-xs font-bold text-amber-800">
                        {perk.number}
                      </span>
                      <span className="text-[11px] font-semibold text-amber-700">
                        2026 Top 5 Honor
                      </span>
                    </div>
                    <h3 className="mt-4 text-base font-bold leading-snug text-slate-900">
                      {perk.title}
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-slate-600 sm:text-sm sm:leading-6">
                      {perk.description}
                    </p>
                  </div>
                </HoverCard>
              </StaggerReveal>
            ))}
          </div>

          {/* Live 2026 Season Deadline Counter Bar */}
          <div className="mt-7 flex flex-col items-start justify-between gap-3 rounded-2xl border border-amber-300/80 bg-white px-5 py-4 shadow-xs sm:flex-row sm:items-center">
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-900">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                <Clock size={17} aria-hidden="true" />
              </span>
              <span>
                {ANNUAL_CM_SEASON_YEAR} Annual Season Closes:{" "}
                <strong className="text-blue-700">
                  {ANNUAL_CM_SEASON_CLOSE_LABEL}
                </strong>{" "}
                <span className="text-slate-300" aria-hidden="true">
                  •
                </span>{" "}
                Final Weeks to Qualify!
              </span>
            </div>
            <Link
              href="/rewards"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap"
            >
              <span>Check Your 2026 Merit Progress</span>
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 2 — Automated Tamper-Proof 2026 Digital Certificate Showcase */}
      <section
        id="certificates"
        className="scroll-mt-20 border-b border-slate-200/80 bg-white py-16 sm:py-20"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-12">
            {/* Left Description Column */}
            <div className="lg:col-span-5">
              <p className="text-xs font-semibold tracking-wide text-blue-600">
                Tamper-Proof 2026 Credentials · QR Public Verification
              </p>
              <h2
                className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-slate-900 sm:text-3xl"
                style={{ textWrap: "balance" }}
              >
                Earn Official State Recognition on Autopilot.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                Every 5 verified reports unlock an official 2026 digital
                &ldquo;Civic Merit Certificate&rdquo; branded for the{" "}
                {ANNUAL_CM_SUMMIT_TITLE}. Add directly to LinkedIn and verify
                via public QR code.
              </p>

              <ul className="mt-6 space-y-3 text-sm text-slate-700">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2
                    size={17}
                    className="mt-0.5 shrink-0 text-emerald-600"
                    aria-hidden="true"
                  />
                  <span>
                    Auto-generated at 5, 10, 15, and 20 verified fixes with
                    unique tamper-evident{" "}
                    <code className="font-mono text-xs text-slate-900">
                      CS-BLR-2026-XXXXXX
                    </code>{" "}
                    ID.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2
                    size={17}
                    className="mt-0.5 shrink-0 text-emerald-600"
                    aria-hidden="true"
                  />
                  <span>
                    Includes scannable QR code linked to{" "}
                    <code className="font-mono text-xs text-slate-900">
                      /verify/[id]
                    </code>{" "}
                    and {ANNUAL_CM_SUMMIT_TITLE} seal.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2
                    size={17}
                    className="mt-0.5 shrink-0 text-emerald-600"
                    aria-hidden="true"
                  />
                  <span>
                    One-click Print/PDF download and LinkedIn Add Certification
                    integration.
                  </span>
                </li>
              </ul>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleOpenSampleCertificate}
                  className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95"
                >
                  <FileCheck2 size={16} aria-hidden="true" />
                  <span>Preview Sample Certificate</span>
                </button>
                <Link
                  href={`/verify/${encodeURIComponent(SAMPLE_CERT_ID)}`}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-100"
                >
                  <span>Verify Sample ID</span>
                  <ExternalLink size={14} aria-hidden="true" />
                </Link>
              </div>
            </div>

            {/* Right Framed Gold-Bordered Certificate Visual Preview */}
            <div className="lg:col-span-7">
              <div className="rounded-2xl border-4 border-double border-amber-500/90 bg-gradient-to-b from-amber-50/40 via-white to-amber-50/30 p-3 shadow-md sm:p-5">
                <div className="rounded-xl border border-amber-300/80 bg-white px-5 py-6 text-center sm:px-8 sm:py-8">
                  <p className="text-[10px] font-bold tracking-[0.16em] text-blue-700 uppercase">
                    GOVERNMENT OF KARNATAKA • {ANNUAL_CM_SUMMIT_TITLE}
                  </p>
                  <h3 className="mt-3 font-[var(--font-heading)] text-xl font-extrabold tracking-wide text-slate-900 sm:text-2xl">
                    CERTIFICATE OF CIVIC MERIT
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-amber-700">
                    Level 1 · State Urban Sentinel (5 Verified Fixes · 2026)
                  </p>

                  <p className="mt-4 text-xs text-slate-500">
                    This is proudly presented to
                  </p>
                  <p className="mx-auto mt-1 inline-block border-b-2 border-amber-400 px-5 pb-1 font-[var(--font-heading)] text-xl font-extrabold text-blue-900 sm:text-2xl">
                    Aarav Sharma
                  </p>

                  <p className="mx-auto mt-3 max-w-md text-xs leading-6 text-slate-600">
                    in recognition of outstanding civic stewardship and
                    verifying{" "}
                    <strong className="font-semibold text-slate-900">
                      5 public infrastructure fixes
                    </strong>{" "}
                    in Bengaluru Urban, validated through CivicSnap AI Audit in{" "}
                    {ANNUAL_CM_SEASON_YEAR}.
                  </p>

                  <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-slate-200 pt-5 text-left">
                    {/* QR + Certificate Hash */}
                    <div className="flex items-center gap-2.5">
                      <div
                        aria-hidden="true"
                        className="grid grid-cols-9 gap-0.5 rounded-lg border border-slate-200 bg-white p-1"
                      >
                        {sampleQrMatrix.flatMap((row, rIdx) =>
                          row.map((filled, cIdx) => (
                            <span
                              key={`preview-${rIdx}-${cIdx}`}
                              className={`h-1 w-1 rounded-[0.5px] ${
                                filled ? "bg-slate-900" : "bg-transparent"
                              }`}
                            />
                          ))
                        )}
                      </div>
                      <div className="text-[10px] leading-4 text-slate-500">
                        <p className="font-mono text-[11px] font-bold text-slate-900">
                          {SAMPLE_CERT_ID}
                        </p>
                        <p>Summit 2026 Verified</p>
                      </div>
                    </div>

                    {/* Gold Embossed Seal */}
                    <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full border-2 border-double border-amber-600 bg-gradient-to-br from-amber-100 via-amber-200 to-amber-400 text-center">
                      <ShieldCheck
                        size={14}
                        className="text-amber-900"
                        aria-hidden="true"
                      />
                      <span className="mt-0.5 text-[7px] font-extrabold tracking-wide text-amber-950 uppercase">
                        Summit 2026
                      </span>
                    </div>

                    {/* Directorate Sign-off */}
                    <div className="text-right">
                      <p className="font-serif text-sm italic font-semibold text-blue-900">
                        Urban Dev. Directorate
                      </p>
                      <p className="text-[10px] font-medium text-slate-500">
                        Official Digital Signatory
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3 — How It Works (3 Steps) */}
      <section
        id="how-it-works"
        className="scroll-mt-20 border-b border-slate-200/80 bg-slate-50 py-16 sm:py-20"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-wide text-blue-600">
              How It Works
            </p>
            <h2
              className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-slate-900 sm:text-3xl"
              style={{ textWrap: "balance" }}
            >
              From street snap to AI-verified fix and 2026 state honors in three
              steps
            </h2>
          </div>

          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {HOW_IT_WORKS_STEPS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <StaggerReveal key={item.step} delay={idx * 0.06}>
                  <HoverCard className="flex h-full flex-col p-6">
                    <div className="flex items-center justify-between">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <Icon size={20} aria-hidden="true" />
                      </span>
                      <span className="font-mono text-sm font-bold tabular-nums text-slate-400">
                        {item.step}
                      </span>
                    </div>
                    <h3 className="mt-5 text-lg font-bold text-slate-900">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {item.description}
                    </p>
                  </HoverCard>
                </StaggerReveal>
              );
            })}
          </ol>
        </div>
      </section>

      {/* SECTION 4 — FAQ Accordion */}
      <section
        id="faq"
        className="scroll-mt-20 border-b border-slate-200/80 bg-white py-16 sm:py-20"
      >
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-wide text-blue-600">
              FAQ &amp; Help
            </p>
            <h2
              className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-slate-900 sm:text-3xl"
              style={{ textWrap: "balance" }}
            >
              Clear answers on 2026 State Honors, Certificates, and AI
              contractor audits
            </h2>
          </div>

          <div className="mt-8">
            <FaqAccordion />
          </div>
        </div>
      </section>

      {/* SECTION 5 — Light Daylight Final CTA */}
      <section className="bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-xs font-semibold tracking-wide text-blue-600">
            Bengaluru CivicSnap Pilot · State Urban Governance Honors{" "}
            {ANNUAL_CM_SEASON_YEAR}
          </p>
          <h2
            className="mx-auto mt-2 max-w-2xl font-[var(--font-heading)] text-2xl font-bold text-slate-900 sm:text-4xl"
            style={{ textWrap: "balance" }}
          >
            Spot a broken road or unlit lane? File a verified audit in 10
            seconds.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-slate-600">
            Earn +50 Civic Merit Points per AI-verified repair, unlock automated
            2026 Bengaluru Urban Merit Certificates, and compete for the Chief
            Minister&apos;s Annual Civic Champions Trophy.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <Link
              href="/report"
              onClick={handleReportAction}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95 whitespace-nowrap"
            >
              <Camera size={16} aria-hidden="true" />
              <span>Report an Issue</span>
            </Link>
            <Link
              href="/rewards"
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-5 py-3 text-sm font-semibold text-amber-900 transition-all hover:bg-amber-50 whitespace-nowrap"
            >
              <Award size={16} className="text-amber-600" aria-hidden="true" />
              <span>Explore 2026 Civic Honors</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Interactive Certificate Preview Modal */}
      <CertificateModal
        certificate={previewCertificate}
        isSamplePreview={true}
        onClose={() => setPreviewCertificate(null)}
      />
    </PageTransition>
  );
}
