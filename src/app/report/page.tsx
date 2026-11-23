import type { Metadata } from "next";
import { ReportAuthGate } from "@/components/report/ReportAuthGate";

export const metadata: Metadata = {
  title: "Report an Issue",
  description:
    "Snap a photo, speak in Hinglish, capture Bengaluru GPS coordinates, and get an instant Gemini AI material audit on CivicSnap.",
};

export default function ReportPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold tracking-wide text-blue-600">
          Bengaluru Pilot • Smart Civic Reporting
        </p>
        <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Report a local civic issue in 10 seconds
        </h1>
        <p className="mt-2.5 text-sm leading-6 text-slate-600 sm:text-base">
          Upload an auto-compressed photo, speak naturally in Hinglish, capture
          your exact Bengaluru ward via GPS, and generate a transparent Gemini
          AI material estimate.
        </p>
      </div>

      <div className="mt-6">
        <ReportAuthGate />
      </div>
    </div>
  );
}
