import type { Metadata } from "next";
import Link from "next/link";
import { ProfileWorkspace } from "@/components/profile/ProfileWorkspace";

export const metadata: Metadata = {
  title: "My Profile",
  description:
    "Manage your CivicSnap display alias, public leaderboard opt-in preference, and submitted civic reports.",
};

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div>
        <p className="text-xs font-semibold text-[#2563EB]">Reporter profile</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-bold text-slate-900">
          Your reports &amp; preferences
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Manage your chosen display alias, control whether you appear on the
          public recognition leaderboard, and track every report you have
          submitted on CivicSnap.
        </p>
      </div>

      <ProfileWorkspace />

      <p className="mt-6 text-xs text-slate-500">
        Questions about how private report fields are stored securely on
        CivicSnap Cloud? Read our{" "}
        <Link
          href="/privacy"
          className="font-medium text-[#2563EB] hover:underline"
        >
          plain-language privacy guide
        </Link>
        .
      </p>
    </div>
  );
}
