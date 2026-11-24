import type { Metadata } from "next";
import Link from "next/link";
import { FaqAccordion } from "@/components/landing/FaqAccordion";

export const metadata: Metadata = {
  title: "FAQ & Transparency Protocol",
  description:
    "CivicSnap AI — Independent Bengaluru Public Infrastructure Ledger & AI Audit Protocol. Frequently asked questions on live camera capture, EXIF privacy, perceptual hash anti-spam, AI Confidence Scores, and SHA-256 certificates.",
};

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold tracking-wide text-blue-600">
          CivicSnap AI • Independent Open Civic Audit Protocol
        </p>
        <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Frequently Asked Questions
        </h1>
        <p className="mt-2.5 text-sm leading-6 text-slate-600 sm:text-base">
          Transparent answers on how CivicSnap enforces live-camera capture,
          strips EXIF metadata, prevents duplicate submissions, computes AI
          Confidence Scores, and issues SHA-256 Civic Merit Certificates.
        </p>
      </div>

      <div className="mt-8">
        <FaqAccordion />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-slate-200 pt-6 text-sm">
        <Link
          href="/report"
          className="font-semibold text-blue-600 hover:text-blue-700"
        >
          Start a Live-Camera Report →
        </Link>
        <span aria-hidden="true" className="text-slate-300">
          ·
        </span>
        <Link
          href="/privacy"
          className="font-semibold text-slate-700 hover:text-slate-900"
        >
          Read Plain-Language Privacy Guide
        </Link>
      </div>
    </div>
  );
}
