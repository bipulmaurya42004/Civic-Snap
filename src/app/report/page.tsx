import type { Metadata } from "next";
import { ReportAuthGate } from "@/components/report/ReportAuthGate";

export const metadata: Metadata = {
  title: "Report an Issue — Live Camera Civic Audit",
  description:
    "CivicSnap AI — Independent Bengaluru Public Infrastructure Ledger & AI Audit Protocol. Capture a live camera photo, speak in Hinglish, validate GPS with EXIF stripping, and run an AI engineering audit.",
};

export default function ReportPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold tracking-wide text-blue-600">
          Live Camera Reporting · Anti-Spam &amp; AI Confidence Audit
        </p>
        <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Report a local civic issue in 10 seconds
        </h1>
        <p className="mt-2.5 text-sm leading-6 text-slate-600 sm:text-base">
          Capture the issue live with your camera (EXIF validated privately and
          stripped before upload), speak naturally in Hinglish, and log a
          transparent audit record on the Bengaluru public ledger.
        </p>
      </div>

      <div className="mt-6">
        <ReportAuthGate />
      </div>
    </div>
  );
}
