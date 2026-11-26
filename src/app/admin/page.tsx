import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminRouterClient } from "@/components/admin/AdminRouterClient";
import { LoadingState } from "@/components/ui/StateViews";

export const metadata: Metadata = {
  title: "Audit Dashboard & Flagged Reports Review",
  description:
    "CivicSnap AI — Independent Bengaluru Public Infrastructure Ledger & AI Audit Protocol. Review flagged reports, audit Before vs After photos with AI Confidence Scores, and verify fixes.",
};

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <span
            data-testid="admin-protocol-pill"
            className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
          >
            Open Civic Audit Protocol
          </span>
          <span className="text-xs font-medium text-slate-500">
            (Independent Ward Triage &amp; Quality Verification Console)
          </span>
        </div>
        <h1 className="mt-2.5 font-[var(--font-heading)] text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          CivicSnap Civic Verifier &amp; Issue Verification Dashboard
        </h1>
        <p className="mt-2.5 text-sm leading-6 text-slate-600 sm:text-base">
          Restricted to authenticated CivicSnap Ward Auditors and Civic
          Verifiers. Stream live citizen reports from Firestore, audit evidence
          photos, GPS locations, AI material estimates, and AI Confidence
          Scores, and execute real-time Approve &amp; Mark Resolved (+50 pts) or
          Reject as Invalid / Spam actions.
        </p>
      </div>

      <Suspense
        fallback={
          <LoadingState
            label="Loading CivicSnap verification dashboard..."
            rows={3}
          />
        }
      >
        <AdminRouterClient />
      </Suspense>
    </div>
  );
}
