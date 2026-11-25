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
        <p className="text-xs font-semibold tracking-wide text-blue-600">
          CivicSnap AI • Municipal Admin Verification Console
        </p>
        <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          CivicSnap Admin &amp; Issue Verification Dashboard
        </h1>
        <p className="mt-2.5 text-sm leading-6 text-slate-600 sm:text-base">
          Restricted to authenticated CivicSnap municipal admins. Stream live
          citizen reports from Firestore, audit evidence photos, GPS locations,
          AI material estimates, and AI Confidence Scores, and execute real-time
          Approve &amp; Mark Resolved (+50 pts) or Reject as Invalid / Spam
          actions.
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
