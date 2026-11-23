import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { sanitizeRedirectPath } from "@/lib/civic-logic";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to CivicSnap to submit reports and view your private report details.",
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolved = await searchParams;
  const redirectPath = sanitizeRedirectPath(resolved.next, "/profile");

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-6">
        <p className="text-xs font-semibold text-[#2563EB]">Account access</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-bold text-slate-900">
          Sign in to CivicSnap
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Access your submitted reports, private photos, and public leaderboard
          preferences.
        </p>
      </div>

      <AuthForm mode="login" redirectPath={redirectPath} />
    </div>
  );
}
