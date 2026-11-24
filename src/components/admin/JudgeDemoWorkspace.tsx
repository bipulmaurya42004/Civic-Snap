"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Lock,
  LogIn,
  MapPin,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Wrench,
  XCircle,
} from "lucide-react";
import {
  JUDGE_DEMO_VERIFICATIONS,
  type JudgeVerificationItem,
} from "@/lib/bengaluru-feed-data";
import { buildGoogleMapsUrl } from "@/lib/location-helpers";
import { useFirebaseAuth } from "@/components/providers/FirebaseAuthProvider";
import { SafeCivicImage } from "@/components/ui/SafeCivicImage";
import { PageTransition } from "@/components/ui/MotionPrimitives";

type AuditDecision = "pending" | "approved" | "rejected";

export function JudgeDemoWorkspace() {
  const { user, isAdmin, busy, signInWithGoogle } = useFirebaseAuth();
  const [decisions, setDecisions] = useState<Record<string, AuditDecision>>({});
  const [selectedId, setSelectedId] = useState<string>(
    JUDGE_DEMO_VERIFICATIONS[0].id
  );

  // Only verified users in NEXT_PUBLIC_ADMIN_EMAILS (enforced alongside Firestore rules) may trigger Approve/Reject
  const canModerate = Boolean(user && user.emailVerified && isAdmin);

  const selectedItem: JudgeVerificationItem =
    JUDGE_DEMO_VERIFICATIONS.find((item) => item.id === selectedId) ??
    JUDGE_DEMO_VERIFICATIONS[0];

  const stats = useMemo(() => {
    let approved = 0;
    let rejected = 0;
    let pending = 0;
    for (const item of JUDGE_DEMO_VERIFICATIONS) {
      const state = decisions[item.id] ?? "pending";
      if (state === "approved") approved += 1;
      else if (state === "rejected") rejected += 1;
      else pending += 1;
    }
    return { approved, rejected, pending };
  }, [decisions]);

  const activeDecision: AuditDecision = decisions[selectedItem.id] ?? "pending";
  const mapsUrl = buildGoogleMapsUrl(selectedItem.lat, selectedItem.lng);
  const isHighConfidence = selectedItem.aiMatchPercent >= 90;

  const setDecisionFor = (id: string, decision: AuditDecision) => {
    if (!canModerate) return;
    setDecisions((prev) => ({ ...prev, [id]: decision }));
  };

  return (
    <PageTransition className="mt-6 space-y-6">
      {/* Clean Light Permission-Aware Banner */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-3.5 ${
          canModerate
            ? "border-emerald-200 bg-emerald-50/70"
            : "border-amber-200 bg-amber-50/75"
        }`}
      >
        <div className="flex items-center gap-2.5 text-sm">
          {canModerate ? (
            <ShieldCheck
              size={18}
              className="shrink-0 text-emerald-700"
              aria-hidden="true"
            />
          ) : (
            <ShieldAlert
              size={18}
              className="shrink-0 text-amber-700"
              aria-hidden="true"
            />
          )}
          <p className="text-slate-800">
            {canModerate ? (
              <>
                <strong className="font-semibold text-slate-900">
                  Authorised Reviewer Session ({user?.email}):
                </strong>{" "}
                Inspect Before-vs-After repair photos, CivicSnap AI Confidence
                Scores (≥ 90% required for +50 pts), and approve or reject
                submissions.
              </>
            ) : (
              <>
                <strong className="font-semibold text-slate-900">
                  Read-Only Public Audit View:
                </strong>{" "}
                Inspect Before-vs-After photos and CivicSnap AI Confidence
                Scores. Sign in with an authorised CivicSnap reviewer account to
                approve or reject repairs.
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canModerate ? (
            <button
              type="button"
              onClick={() => setDecisions({})}
              className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
            >
              <RotateCcw size={13} aria-hidden="true" />
              <span>Reset Decisions</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void signInWithGoogle()}
              className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 disabled:opacity-60"
            >
              <LogIn size={13} aria-hidden="true" />
              <span>Admin Sign In</span>
            </button>
          )}
          <Link
            href="/feed"
            className="inline-flex min-h-[36px] items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          >
            Public Feed
          </Link>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Pending Audits</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-amber-600">
            {stats.pending}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Verified Approved</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-700">
            {stats.approved}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Rejected Claims</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-rose-700">
            {stats.rejected}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Bengaluru Queue</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900">
            {JUDGE_DEMO_VERIFICATIONS.length}
          </p>
        </div>
      </div>

      {/* Queue Selector Tabs */}
      <div
        role="tablist"
        aria-label="Select contractor audit submission"
        className="grid gap-3 md:grid-cols-3"
      >
        {JUDGE_DEMO_VERIFICATIONS.map((item) => {
          const isSelected = item.id === selectedItem.id;
          const itemDecision = decisions[item.id] ?? "pending";
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setSelectedId(item.id)}
              className={`cursor-pointer rounded-2xl border p-4 text-left transition-all ${
                isSelected
                  ? "border-blue-600 bg-white shadow-md ring-2 ring-blue-600/15"
                  : "border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-slate-500">
                  {item.id}
                </span>
                {itemDecision === "approved" ? (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    Approved
                  </span>
                ) : itemDecision === "rejected" ? (
                  <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                    Rejected
                  </span>
                ) : (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    Pending Audit
                  </span>
                )}
              </div>
              <p className="mt-2 line-clamp-1 text-sm font-bold text-slate-900">
                {item.title}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {item.ward} ·{" "}
                <span
                  className={
                    item.aiMatchPercent >= 90
                      ? "font-semibold text-emerald-700"
                      : "font-semibold text-amber-700"
                  }
                >
                  {item.aiMatchPercent}% AI Confidence Score
                </span>
              </p>
            </button>
          );
        })}
      </div>

      {/* Main Side-by-Side Before vs After Verification Card */}
      <article className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        {/* Card Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold text-slate-500">
                {selectedItem.id}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                <MapPin size={12} className="text-blue-600" aria-hidden="true" />
                <span>{selectedItem.ward}</span>
              </span>
              {selectedItem.highPriorityZone && (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">
                  <Siren size={12} aria-hidden="true" />
                  <span>High Priority ({selectedItem.priorityLabel})</span>
                </span>
              )}
            </div>

            <h2 className="mt-2.5 text-xl font-bold text-slate-900">
              {selectedItem.title}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Contractor:{" "}
              <strong className="font-semibold text-slate-800">
                {selectedItem.contractorName}
              </strong>{" "}
              · Street: {selectedItem.streetAddress} · Reporter:{" "}
              {selectedItem.reporterAlias}
            </p>
          </div>

          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
            >
              <MapPin size={13} className="text-blue-600" aria-hidden="true" />
              <span>View on Google Maps</span>
              <ExternalLink size={12} className="text-slate-400" aria-hidden="true" />
            </a>
          )}
        </div>

        {/* Side-by-Side Before Photo vs Contractor's After Photo */}
        <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
          <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            <figcaption className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700">
              <span>Before Photo · Citizen Report</span>
              <span className="font-mono text-slate-400">Original</span>
            </figcaption>
            <div className="h-60 w-full">
              <SafeCivicImage
                src={selectedItem.beforeImageUrl}
                alt={`Before repair: ${selectedItem.title}`}
                className="h-full w-full object-cover"
              />
            </div>
          </figure>

          <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            <figcaption className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700">
              <span>After Photo · Contractor Proof</span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                  isHighConfidence
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                {isHighConfidence ? "Verified" : "Needs Review"}
              </span>
            </figcaption>
            <div className="h-60 w-full">
              <SafeCivicImage
                src={selectedItem.afterImageUrl}
                alt={`Contractor after photo: ${selectedItem.title}`}
                className="h-full w-full object-cover"
              />
            </div>
          </figure>
        </div>

        {/* AI Confidence Score Meter & Engineering Material Audit */}
        <div className="border-t border-slate-100 bg-slate-50/70 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {isHighConfidence ? (
                <Sparkles
                  size={16}
                  className="text-emerald-600"
                  aria-hidden="true"
                />
              ) : (
                <AlertTriangle
                  size={16}
                  className="text-amber-600"
                  aria-hidden="true"
                />
              )}
              <span className="text-sm font-bold text-slate-900">
                AI Confidence Score: {selectedItem.aiHeadline}
              </span>
            </div>
            <span
              className={`font-mono text-sm font-extrabold tabular-nums ${
                isHighConfidence ? "text-emerald-700" : "text-amber-700"
              }`}
            >
              {selectedItem.aiMatchPercent}%
            </span>
          </div>

          <div
            className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-label="AI Confidence Score"
            aria-valuenow={selectedItem.aiMatchPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <motion.div
              key={selectedItem.id}
              initial={{ width: 0 }}
              animate={{ width: `${selectedItem.aiMatchPercent}%` }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className={`h-full rounded-full ${
                isHighConfidence ? "bg-emerald-600" : "bg-amber-500"
              }`}
            />
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            {selectedItem.aiSummary}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs">
              <p className="font-semibold text-slate-500">Contractor Claimed</p>
              <p className="mt-1 font-medium text-slate-900">
                {selectedItem.materialClaimed}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs">
              <p className="flex items-center gap-1 font-semibold text-slate-500">
                <Wrench size={12} className="text-blue-600" aria-hidden="true" />
                <span>AI Material Audit</span>
              </p>
              <p className="mt-1 font-medium text-slate-900">
                {selectedItem.materialAudited}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs">
              <p className="font-semibold text-slate-500">
                Audited Cost &amp; Citizen Reward
              </p>
              <p className="mt-1 font-mono font-bold text-slate-900">
                {selectedItem.estimatedCost} · +{selectedItem.rewardPoints} Pts
              </p>
            </div>
          </div>
        </div>

        {/* Approve (Green) and Reject (Red) Decision Bar */}
        <div className="flex flex-col justify-between gap-4 border-t border-slate-200/80 bg-white p-5 sm:flex-row sm:items-center sm:p-6">
          <div>
            {activeDecision === "approved" ? (
              <p
                role="status"
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
              >
                <CheckCircle2 size={14} aria-hidden="true" />
                <span>
                  Repair Approved · Marked Verified Fixed &amp; +
                  {selectedItem.rewardPoints} CivicPoints credited
                </span>
              </p>
            ) : activeDecision === "rejected" ? (
              <p
                role="status"
                className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700"
              >
                <XCircle size={14} aria-hidden="true" />
                <span>
                  Contractor Proof Rejected · Ticket kept In Progress &amp;
                  payout held
                </span>
              </p>
            ) : !canModerate ? (
              <p className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
                <Lock size={13} aria-hidden="true" />
                <span>
                  Approval actions locked — authorised staff in
                  NEXT_PUBLIC_ADMIN_EMAILS required
                </span>
              </p>
            ) : (
              <p className="text-sm text-slate-600">
                Review the Before-vs-After visual evidence and confirm your
                verification decision:
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!canModerate}
              title={
                canModerate
                  ? "Reject contractor proof and hold payout"
                  : "Only authorised admin accounts can reject proofs"
              }
              onClick={() => setDecisionFor(selectedItem.id, "rejected")}
              className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-rose-600/20 transition-all hover:bg-rose-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 whitespace-nowrap"
            >
              {canModerate ? (
                <XCircle size={16} aria-hidden="true" />
              ) : (
                <Lock size={15} aria-hidden="true" />
              )}
              <span>Reject Proof</span>
            </button>

            <button
              type="button"
              disabled={!canModerate}
              title={
                canModerate
                  ? "Approve repair proof and mark Verified Fixed"
                  : "Only authorised admin accounts can approve proofs"
              }
              onClick={() => setDecisionFor(selectedItem.id, "approved")}
              className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition-all hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 whitespace-nowrap"
            >
              {canModerate ? (
                <CheckCircle2 size={16} aria-hidden="true" />
              ) : (
                <Lock size={15} aria-hidden="true" />
              )}
              <span>Approve &amp; Verify Fix</span>
            </button>
          </div>
        </div>
      </article>
    </PageTransition>
  );
}
