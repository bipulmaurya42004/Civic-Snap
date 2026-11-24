import type { Metadata } from "next";
import { LiveDashboardWorkspace } from "@/components/dashboard/LiveDashboardWorkspace";

export const metadata: Metadata = {
  title: "Citizen & City Dashboard",
  description:
    "CivicSnap AI — Independent Bengaluru Public Infrastructure Ledger & AI Audit Protocol. Track your real Firestore civic reports, verified fixes, and cryptographic certificate progress.",
};

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold tracking-wide text-[#2563EB] uppercase">
          CivicSnap AI · Live Citizen &amp; Bengaluru Ledger
        </p>
        <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-bold text-slate-900">
          Civic Audit Dashboard
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
          Real-time Firestore ledger of your audited street issues, verified
          repair count, Merit Points (+50 strictly on Verified Fixes with AI
          Confidence Score ≥ 90% + Admin approval), and SHA-256 certificate
          unlock progress.
        </p>
      </div>

      <div className="mt-6">
        <LiveDashboardWorkspace />
      </div>
    </div>
  );
}
