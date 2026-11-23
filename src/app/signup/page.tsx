import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { sanitizeRedirectPath } from "@/lib/civic-logic";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create a CivicSnap account to submit photo-based civic reports and track updates.",
};

interface SignupPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const resolved = await searchParams;
  const redirectPath = sanitizeRedirectPath(resolved.next, "/report");

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-6">
        <p className="text-xs font-semibold text-[#2563EB]">Get started</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-bold text-slate-900">
          Create your account
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Accounts keep your raw report photos and optional coordinates private
          to you and authorised project admins.
        </p>
      </div>

      <AuthForm mode="signup" redirectPath={redirectPath} />
    </div>
  );
}
