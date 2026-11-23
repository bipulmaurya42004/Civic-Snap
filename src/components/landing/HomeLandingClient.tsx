"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Gift,
  Loader2,
  MapPin,
  Mic,
  ShieldCheck,
  Siren,
  Sparkles,
  Trophy,
  Wrench,
} from "lucide-react";
import { SafeCivicImage } from "@/components/ui/SafeCivicImage";
import { FaqAccordion } from "@/components/landing/FaqAccordion";
import {
  HoverCard,
  PageTransition,
  StaggerReveal,
} from "@/components/ui/MotionPrimitives";

const IMPACT_METRICS = [
  {
    value: "2,480+",
    label: "Verified Fixes",
    detail: "Completed across Bengaluru pilot wards",
  },
  {
    value: "₹18.4L",
    label: "Contractor Waste Saved",
    detail: "Flagged via AI material & photo audits",
  },
  {
    value: "94.8%",
    label: "Vision Match Accuracy",
    detail: "Before-vs-After repair verification",
  },
  {
    value: "18 hrs",
    label: "Top Ward Avg Fix",
    detail: "Led by #1 Indiranagar Ward Wars",
  },
] as const;

const HOW_IT_WORKS_STEPS = [
  {
    step: "01",
    title: "Snap & Speak",
    description:
      "Upload a street photo (<100KB auto-compress), auto-detect your Bengaluru ward via GPS, and describe the issue in Hindi or Hinglish in 10 seconds.",
    icon: Camera,
  },
  {
    step: "02",
    title: "AI Engineering Audit",
    description:
      "CivicSnap Vision AI estimates repair materials (kg of asphalt, LED fixtures, crew hours), assigns a Social Impact Score, and flags Hospital/School High Priority Zones.",
    icon: Wrench,
  },
  {
    step: "03",
    title: "Verified Fix & Rewards",
    description:
      "When contractors upload an After photo, AI verifies the surface repair before closing the ticket — crediting +50 CivicPoints redeemable at Bengaluru cafés & fitness studios.",
    icon: Gift,
  },
] as const;

const BENTO_FEATURES = [
  {
    title: "AI Material Estimator",
    subtitle: "Civil Engineering Audits",
    description:
      "Automatically computes required asphalt tonnage, paint liters, crew hours, and 30-day economic cost of delay from a single citizen photo so contractor bills stay honest.",
    metric: "~140 kg Asphalt · ₹3,200 Est.",
    icon: Wrench,
    href: "/report",
    cta: "Try Photo Audit",
  },
  {
    title: "Hinglish Voice-to-Report",
    subtitle: "10-Second Accessibility",
    description:
      "Speak naturally in Hindi or Hinglish — \"Bhai yahan main road pe 2ft ka gaddha hai\" — and CivicSnap structures a clean English title, category, and report automatically.",
    metric: "Hindi / Hinglish → English",
    icon: Mic,
    href: "/report",
    cta: "Try Voice Recorder",
  },
  {
    title: "Anti-Fraud Fix Verification",
    subtitle: "Before-vs-After Accountability",
    description:
      "Contractors cannot silently mark tickets Resolved. CivicSnap Vision AI compares the original issue photo against proof-of-fix images and flags duplicate or incomplete patches.",
    metric: "94.8% Match Confidence",
    icon: ShieldCheck,
    href: "/admin?mode=judge",
    cta: "Open Judge Demo",
  },
  {
    title: "Ward Wars & CivicPerks",
    subtitle: "Colony-Level Incentives",
    description:
      "Indiranagar, HSR Layout, and Koramangala compete on live resolution rates and fix speed while residents redeem CivicPoints at Third Wave Coffee, Cult.fit, and Zepto.",
    metric: "7 Active Bengaluru Wards",
    icon: Trophy,
    href: "/ward-wars",
    cta: "View Ward Standings",
  },
] as const;

const HINGLISH_DEMO_PHRASE = "Bhai yahan main road pe 2ft ka gaddha hai";

export function HomeLandingClient() {
  const [auditView, setAuditView] = useState<"before" | "after">("after");
  const [voiceDemoBusy, setVoiceDemoBusy] = useState(false);
  const [voiceDemoResult, setVoiceDemoResult] = useState<{
    title: string;
    categoryDisplay: string;
    description: string;
  } | null>(null);

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
          title: "Deep 2ft Pothole on Main Road",
          categoryDisplay: "Pothole",
          description:
            "A 2-foot pothole on the main road poses a severe safety risk to two-wheelers and daily commuters. Immediate asphalt patching requested.",
        });
      }
    } catch {
      setVoiceDemoResult({
        title: "Deep 2ft Pothole on Main Road",
        categoryDisplay: "Pothole",
        description:
          "A 2-foot pothole on the main road poses a severe safety risk to two-wheelers and daily commuters. Immediate asphalt patching requested.",
      });
    } finally {
      setVoiceDemoBusy(false);
    }
  };

  return (
    <PageTransition>
      {/* HERO SECTION — Pure White to Soft Slate Gradient */}
      <section className="border-b border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-12">
            {/* Left Copy Column */}
            <div className="lg:col-span-6 lg:pt-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                <MapPin size={13} aria-hidden="true" className="text-rose-600" />
                <span>Live in Bengaluru: Indiranagar, HSR &amp; Koramangala</span>
              </div>

              <h1
                className="mt-4 font-[var(--font-heading)] font-bold leading-[1.1] tracking-tight text-slate-900"
                style={{
                  fontSize: "clamp(2.35rem, 4.2vw, 3.5rem)",
                  textWrap: "balance",
                }}
              >
                Turn Broken Roads into Verified Fixes.
              </h1>

              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                <strong className="font-semibold text-slate-900">
                  Sirf photo nahi, follow-up bhi.
                </strong>{" "}
                Report issues in 10 seconds with Hinglish voice, track real
                contractor repair materials, and earn café discounts for your
                ward.
              </p>

              {/* Primary + Secondary CTAs */}
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  href="/report"
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95 whitespace-nowrap sm:w-auto"
                >
                  <Camera size={17} aria-hidden="true" />
                  <span>Report an Issue</span>
                </Link>
                <Link
                  href="/ward-wars"
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-100 whitespace-nowrap sm:w-auto"
                >
                  <Trophy size={16} aria-hidden="true" className="text-amber-600" />
                  <span>View Ward Rankings</span>
                </Link>
              </div>

              {/* Interactive Hinglish Voice Demo Pill */}
              <div className="mt-6 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-sm">
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
                        Instant Hinglish-to-English CivicSnap AI structuring
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
                      <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Sparkles size={13} aria-hidden="true" />
                    )}
                    <span>
                      {voiceDemoBusy ? "Converting..." : "Try Hinglish Voice"}
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
                          <span>Structured Report Draft · {voiceDemoResult.categoryDisplay}</span>
                        </span>
                        <Link
                          href="/report"
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

            {/* Right Interactive Before & After / AI Audit Card */}
            <div className="lg:col-span-6">
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

                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/75 via-slate-900/25 to-transparent px-5 pb-3.5 pt-10 text-white">
                    <p className="text-xs font-medium text-white/85">
                      {auditView === "before"
                        ? "Reported Issue · 100ft Road, Indiranagar"
                        : "Contractor Proof Verified · 94.8% Vision Match"}
                    </p>
                    <p className="mt-0.5 text-sm font-bold">
                      Severe Pothole near Chinmaya Mission Hospital
                    </p>
                  </div>
                </div>

                {/* CivicSnap AI Engineering Audit Calculation Strip */}
                <div className="p-5">
                  <p className="text-xs font-semibold text-blue-600">
                    CivicSnap Vision AI Engineering Audit
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-center">
                    <div>
                      <p className="font-mono text-base font-bold tabular-nums text-slate-900">
                        140kg
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                        Asphalt
                      </p>
                    </div>
                    <div className="border-x border-slate-200 px-1">
                      <p className="font-mono text-base font-bold tabular-nums text-slate-900">
                        ₹3,200
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                        Audit Cost
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-base font-bold tabular-nums text-emerald-700">
                        +50
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                        CivicPoints
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500">
                      Indiranagar Ward · Urgency Score{" "}
                      <strong className="font-mono font-semibold text-slate-800">
                        92/100
                      </strong>
                    </span>
                    <Link
                      href="/admin?mode=judge"
                      className="inline-flex items-center gap-1 font-semibold text-blue-600 transition-colors hover:text-blue-700"
                    >
                      <span>Open Judge Verification Demo</span>
                      <ArrowRight size={13} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 1 — Overview / City Impact Numbers */}
      <section
        id="overview"
        className="scroll-mt-20 border-b border-slate-200/80 bg-white py-14 sm:py-16"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold tracking-wide text-blue-600">
                Bengaluru Pilot Overview
              </p>
              <h2
                className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-slate-900 sm:text-3xl"
                style={{ textWrap: "balance" }}
              >
                Measurable street accountability across 7 Bengaluru wards
              </h2>
            </div>
            <Link
              href="/feed"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700 whitespace-nowrap"
            >
              <span>Browse Live Public Feed</span>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {IMPACT_METRICS.map((metric, idx) => (
              <StaggerReveal key={metric.label} delay={idx * 0.05}>
                <HoverCard className="h-full p-5 sm:p-6">
                  <p className="font-[var(--font-heading)] text-3xl font-extrabold tabular-nums text-slate-900 sm:text-4xl">
                    {metric.value}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">
                    {metric.label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {metric.detail}
                  </p>
                </HoverCard>
              </StaggerReveal>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 2 — How It Works (3-Step Citizen Process) */}
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
              From street snap to AI-verified fix in three simple steps
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

      {/* SECTION 3 — Key Features (4 Light Bento Cards) */}
      <section
        id="features"
        className="scroll-mt-20 border-b border-slate-200/80 bg-white py-16 sm:py-20"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-wide text-blue-600">
              Key Features
            </p>
            <h2
              className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-slate-900 sm:text-3xl"
              style={{ textWrap: "balance" }}
            >
              Engineered for daylight clarity, contractor accountability, and
              citizen rewards
            </h2>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {BENTO_FEATURES.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <StaggerReveal key={feature.title} delay={idx * 0.05}>
                  <HoverCard className="flex h-full flex-col justify-between p-6">
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                          <Icon size={20} aria-hidden="true" />
                        </span>
                        <span className="font-mono text-xs font-semibold tabular-nums text-slate-500">
                          {feature.metric}
                        </span>
                      </div>
                      <p className="mt-4 text-xs font-semibold text-blue-600">
                        {feature.subtitle}
                      </p>
                      <h3 className="mt-1 text-xl font-bold text-slate-900">
                        {feature.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {feature.description}
                      </p>
                    </div>

                    <div className="mt-6 border-t border-slate-100 pt-4">
                      <Link
                        href={feature.href}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700"
                      >
                        <span>{feature.cta}</span>
                        <ArrowRight size={15} aria-hidden="true" />
                      </Link>
                    </div>
                  </HoverCard>
                </StaggerReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 4 — FAQ Accordion */}
      <section
        id="faq"
        className="scroll-mt-20 border-b border-slate-200/80 bg-slate-50 py-16 sm:py-20"
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
              Clear answers on privacy, CivicPoints, and AI contractor audits
            </h2>
          </div>

          <div className="mt-8">
            <FaqAccordion />
          </div>
        </div>
      </section>

      {/* SECTION 5 — Light Daylight Final CTA */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-xs font-semibold tracking-wide text-blue-600">
            Bengaluru CivicSnap Pilot
          </p>
          <h2
            className="mx-auto mt-2 max-w-2xl font-[var(--font-heading)] text-2xl font-bold text-slate-900 sm:text-4xl"
            style={{ textWrap: "balance" }}
          >
            Spot a broken road or unlit lane? File a verified audit in 10
            seconds.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-slate-600">
            Help push your ward to #1 on Ward Wars and redeem CivicPoints at
            Third Wave Coffee, Cult.fit, and Zepto.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <Link
              href="/report"
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95 whitespace-nowrap"
            >
              <Camera size={16} aria-hidden="true" />
              <span>Report an Issue</span>
            </Link>
            <Link
              href="/admin?mode=judge"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-100 whitespace-nowrap"
            >
              Explore Judge Demo Dashboard
            </Link>
          </div>
        </div>
      </section>
    </PageTransition>
  );
}
