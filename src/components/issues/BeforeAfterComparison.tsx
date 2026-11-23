"use client";

import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { SafeCivicImage } from "@/components/ui/SafeCivicImage";
import { isSafeDisplayImageUrl } from "@/lib/ai-civic-helpers";
import type { VerificationStatus } from "@/types/civic";

interface BeforeAfterComparisonProps {
  title: string;
  beforeImageURL?: string;
  afterImageURL?: string;
  verificationStatus?: VerificationStatus;
  verificationReason?: string;
  isDemo?: boolean;
}

export function BeforeAfterComparison({
  title,
  beforeImageURL,
  afterImageURL,
  verificationStatus,
  verificationReason,
  isDemo = false,
}: BeforeAfterComparisonProps) {
  const safeBefore = isSafeDisplayImageUrl(beforeImageURL)
    ? beforeImageURL
    : undefined;
  const safeAfter = isSafeDisplayImageUrl(afterImageURL)
    ? afterImageURL
    : undefined;

  if (!safeAfter && !verificationStatus) {
    return null;
  }

  const isVerified = verificationStatus === "verified";
  const isFlagged = verificationStatus === "flagged";

  return (
    <section
      aria-label="Before and after AI fix verification"
      className="border-b border-slate-100 bg-slate-50/70 p-6 sm:px-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#2563EB]">
            <Sparkles size={13} aria-hidden="true" />
            Before vs After Accountability
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            AI Fix Verification Comparison
          </h2>
        </div>

        {isVerified && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            <CheckCircle2 size={14} aria-hidden="true" />
            <span>AI Verdict: Verified</span>
          </span>
        )}
        {isFlagged && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
            <AlertTriangle size={14} aria-hidden="true" />
            <span>AI Verdict: Flagged — Needs Re-check</span>
          </span>
        )}
      </div>

      {/* Side-by-side photos */}
      {(safeBefore || safeAfter) && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2">
              <span className="text-xs font-semibold text-slate-700">
                Before · Reported Issue
              </span>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                Original
              </span>
            </div>
            {safeBefore ? (
              <SafeCivicImage
                src={safeBefore}
                alt={`Before repair: ${title}`}
                className="h-52 w-full"
              />
            ) : (
              <div className="flex h-52 items-center justify-center bg-slate-100 px-4 text-center text-xs text-slate-500">
                Original reporter photo kept private
              </div>
            )}
          </figure>

          <figure className="overflow-hidden rounded-2xl border border-emerald-200/80 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2">
              <span className="text-xs font-semibold text-slate-900">
                After · Proof of Fix
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${
                  isVerified
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-800"
                }`}
              >
                {isVerified ? "Verified Repair" : "Submitted Proof"}
              </span>
            </div>
            {safeAfter ? (
              <SafeCivicImage
                src={safeAfter}
                alt={`After repair proof: ${title}`}
                className="h-52 w-full"
              />
            ) : (
              <div className="flex h-52 items-center justify-center bg-slate-100 px-4 text-center text-xs text-slate-500">
                Proof of fix photo pending upload
              </div>
            )}
          </figure>
        </div>
      )}

      {/* AI Verdict Reason Card */}
      {verificationReason && (
        <div
          className={`mt-4 rounded-xl border p-4 text-sm ${
            isVerified
              ? "border-emerald-200 bg-emerald-50/70 text-emerald-950"
              : isFlagged
                ? "border-amber-200 bg-amber-50/80 text-amber-950"
                : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
            CivicSnap Vision AI Assessment
          </p>
          <p className="mt-1 leading-6">{verificationReason}</p>
          {isDemo && (
            <p className="mt-2 text-xs text-slate-600">
              Sample Before-vs-After verification shown in Demo Mode.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
