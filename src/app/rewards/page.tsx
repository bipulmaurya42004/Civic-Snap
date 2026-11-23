import type { Metadata } from "next";
import { CivicHonorsWorkspace } from "@/components/honors/CivicHonorsWorkspace";

export const metadata: Metadata = {
  title: "Civic Honors & Achievements",
  description:
    "Track your journey toward the Chief Minister's Annual Civic Champions Award, unlock automated Digital Civic Merit Certificates every 5 verified fixes, and earn State & National civic badges.",
};

export default function CivicHonorsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold tracking-wide text-blue-600">
          Bengaluru Pilot • Official State Civic Honors &amp; Recognition
        </p>
        <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Civic Honors &amp; Achievements
        </h1>
        <p className="mt-2.5 text-sm leading-6 text-slate-600 sm:text-base">
          Track your journey toward the Chief Minister&apos;s Annual Honors.
          Every 5 AI-verified infrastructure fixes unlock an official digital
          Bengaluru Urban Civic Merit Certificate and advance your state badge
          rank.
        </p>
      </div>

      <CivicHonorsWorkspace />
    </div>
  );
}
