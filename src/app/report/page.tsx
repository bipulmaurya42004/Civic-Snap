import type { Metadata } from "next";
import { ReportAuthGate } from "@/components/report/ReportAuthGate";

export const metadata: Metadata = {
  title: "Report an Issue",
  description:
    "Sign in or create an account to submit a photo-based civic report in four mobile-friendly steps on CivicSnap.",
};

export default function ReportPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div>
        <p className="text-xs font-semibold text-[#2563EB]">
          Photo-first reporting
        </p>
        <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-bold text-slate-900">
          Report a local civic issue
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
          Document potholes, garbage piles, unlit streetlights, or other civic
          issues in four simple steps. Submitting a report on CivicSnap saves it
          to Firestore for project-admin review and does not automatically send
          it to municipal authorities or guarantee a repair.
        </p>
      </div>

      <div className="mt-6">
        <ReportAuthGate />
      </div>
    </div>
  );
}
