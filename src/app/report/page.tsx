import type { Metadata } from "next";
import { ReportAuthGate } from "@/components/report/ReportAuthGate";

export const metadata: Metadata = {
  title: "Report an Issue",
  description:
    "Snap a photo, speak in Hinglish, capture your live GPS location, and get an instant CivicSnap AI authenticity & material audit.",
};

export default function ReportPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold tracking-wide text-blue-600">
          Smart Civic Reporting · CivicSnap AI Verified
        </p>
        <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Report a local civic issue in 10 seconds
        </h1>
        <p className="mt-2.5 text-sm leading-6 text-slate-600 sm:text-base">
          Capture a live street photo, speak naturally in Hinglish, detect your
          exact live GPS address, and generate a verified CivicSnap AI material
          audit.
        </p>
      </div>

      <div className="mt-6">
        <ReportAuthGate />
      </div>
    </div>
  );
}
