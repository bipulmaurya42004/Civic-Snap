import type { Metadata } from "next";
import { CivicHonorsWorkspace } from "@/components/honors/CivicHonorsWorkspace";

export const metadata: Metadata = {
  title:
    "Civic Honors & Vanguard Citation — CivicSnap AI Independent Bengaluru Public Infrastructure Ledger",
  description:
    "CivicSnap AI — Independent Bengaluru Public Infrastructure Ledger & AI Audit Protocol. Track verified fixes (AI Confidence Score >= 90%), unlock SHA-256 Civic Merit Certificates, and view the Bengaluru Civic Vanguard Citation ladder.",
};

export default function CivicHonorsAliasPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold tracking-wide text-blue-600">
          CivicSnap AI • Independent Civic Recognition &amp; SHA-256 Credentials
        </p>
        <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Civic Honors &amp; Vanguard Citation
        </h1>
        <p className="mt-2.5 text-sm leading-6 text-slate-600 sm:text-base">
          Track your verified Bengaluru infrastructure audits. Every 5
          Admin-approved fixes with an AI Confidence Score ≥ 90% unlock a
          tamper-evident SHA-256 Civic Merit Certificate and advance your
          standing toward the 2026 Bengaluru Civic Vanguard Citation.
        </p>
      </div>

      <CivicHonorsWorkspace />
    </div>
  );
}
