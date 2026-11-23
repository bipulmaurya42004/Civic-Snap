"use client";

import {
  AlertTriangle,
  Building2,
  Gauge,
  Sparkles,
  Wrench,
} from "lucide-react";
import {
  clampSocialImpactScore,
  getPriorityTierFromScore,
} from "@/lib/ai-civic-helpers";

interface EngineeringInsightsCardProps {
  surroundingLandmarks?: string;
  materialEstimate?: string;
  socialImpactScore?: number;
  economicCostOfDelay?: string;
  variant?: "full" | "compact";
  title?: string;
  demoMode?: boolean;
}

export function EngineeringInsightsCard({
  surroundingLandmarks,
  materialEstimate,
  socialImpactScore,
  economicCostOfDelay,
  variant = "full",
  title = "Engineering Insights",
  demoMode = false,
}: EngineeringInsightsCardProps) {
  const hasAny = Boolean(
    surroundingLandmarks ||
      materialEstimate ||
      typeof socialImpactScore === "number" ||
      economicCostOfDelay
  );

  if (!hasAny) {
    return null;
  }

  const score =
    typeof socialImpactScore === "number"
      ? clampSocialImpactScore(socialImpactScore)
      : null;
  const priority = score !== null ? getPriorityTierFromScore(score) : null;

  const priorityBadgeClass =
    priority?.tone === "high"
      ? "border-red-200 bg-red-50 text-red-700"
      : priority?.tone === "medium"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800";

  const scoreBarClass =
    priority?.tone === "high"
      ? "bg-red-500"
      : priority?.tone === "medium"
        ? "bg-amber-500"
        : "bg-emerald-500";

  if (variant === "compact") {
    return (
      <div className="min-w-[230px] max-w-[290px] space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs">
        {score !== null && priority && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                <Gauge size={12} className="text-[#2563EB]" aria-hidden="true" />
                Impact Score
              </span>
              <span
                className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums ${priorityBadgeClass}`}
              >
                {score}/100 · {priority.label.replace(" Priority", "")}
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
              aria-hidden="true"
            >
              <div
                className={`h-full rounded-full ${scoreBarClass}`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        )}

        {surroundingLandmarks && (
          <div className="flex items-start gap-1.5 text-slate-700">
            <Building2
              size={12}
              className="mt-0.5 shrink-0 text-slate-500"
              aria-hidden="true"
            />
            <p className="leading-4">
              <span className="font-semibold text-slate-900">Landmarks: </span>
              {surroundingLandmarks}
            </p>
          </div>
        )}

        {materialEstimate && (
          <div className="flex items-start gap-1.5 text-slate-700">
            <Wrench
              size={12}
              className="mt-0.5 shrink-0 text-slate-500"
              aria-hidden="true"
            />
            <p className="leading-4">
              <span className="font-semibold text-slate-900">Materials: </span>
              {materialEstimate}
            </p>
          </div>
        )}

        {economicCostOfDelay && (
          <div className="flex items-start gap-1.5 text-slate-700">
            <AlertTriangle
              size={12}
              className="mt-0.5 shrink-0 text-amber-600"
              aria-hidden="true"
            />
            <p className="leading-4">
              <span className="font-semibold text-slate-900">30-Day Delay Cost: </span>
              {economicCostOfDelay}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <section
      aria-label={title}
      className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100/80 text-[#2563EB]">
            <Sparkles size={16} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-500">
              {demoMode
                ? "Sample civil engineering audit estimate (Demo Mode)"
                : "CivicSnap Vision AI municipal engineering & priority audit"}
            </p>
          </div>
        </div>

        {score !== null && priority && (
          <div className="flex items-center gap-2.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${priorityBadgeClass}`}
            >
              <Gauge size={13} aria-hidden="true" />
              <span>{priority.label}</span>
            </span>
            <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-mono text-sm font-bold tabular-nums text-slate-900">
              {score}
              <span className="text-xs font-normal text-slate-500">/100</span>
            </span>
          </div>
        )}
      </div>

      {score !== null && (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-slate-600">
              Social Impact Score (Location &amp; Severity)
            </span>
            <span className="font-mono font-semibold tabular-nums text-slate-800">
              {score} / 100
            </span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-valuenow={score}
            aria-valuemin={1}
            aria-valuemax={100}
            aria-label="Social Impact Score"
          >
            <div
              className={`h-full rounded-full transition-all ${scoreBarClass}`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {surroundingLandmarks && (
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Building2 size={13} className="text-[#2563EB]" aria-hidden="true" />
              <span>Surrounding Landmarks</span>
            </div>
            <p className="mt-2 text-sm leading-5 text-slate-800">
              {surroundingLandmarks}
            </p>
          </div>
        )}

        {materialEstimate && (
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Wrench size={13} className="text-[#2563EB]" aria-hidden="true" />
              <span>Material Estimate</span>
            </div>
            <p className="mt-2 text-sm leading-5 text-slate-800">
              {materialEstimate}
            </p>
          </div>
        )}

        {economicCostOfDelay && (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
              <AlertTriangle size={13} className="text-amber-600" aria-hidden="true" />
              <span>30-Day Cost of Delay</span>
            </div>
            <p className="mt-2 text-sm leading-5 text-slate-800">
              {economicCostOfDelay}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
