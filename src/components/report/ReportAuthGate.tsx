"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Lock,
  LogOut,
  Mail,
  MapPin,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { useFirebaseAuth } from "@/components/providers/FirebaseAuthProvider";
import { AuthForm } from "@/components/auth/AuthForm";
import { ReportWizard } from "@/components/report/ReportWizard";
import { LoadingState } from "@/components/ui/StateViews";

export function ReportAuthGate() {
  const {
    user,
    displayAlias,
    authReady,
    busy,
    errorMessage,
    statusMessage,
    signInWithGoogle,
    refreshEmailVerification,
    resendVerificationEmail,
    signOutUser,
  } = useFirebaseAuth();
  const [authTab, setAuthTab] = useState<"login" | "signup">("login");

  if (!authReady) {
    return (
      <LoadingState
        label="Checking your CivicSnap sign-in session..."
        rows={3}
      />
    );
  }

  // Require Sign In or Sign Up before snapping or submitting a civic report
  if (!user) {
    return (
      <section
        aria-labelledby="report-auth-gate-heading"
        className="space-y-6"
      >
        <div className="rounded-[20px] border border-blue-200 bg-white p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#2563EB]">
                <Lock size={14} aria-hidden="true" />
                Account required before snapping or reporting
              </span>
              <h2
                id="report-auth-gate-heading"
                className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-slate-900"
              >
                Sign in or sign up to report an issue
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Before you upload a snap or file a civic report, sign in with
                your CivicSnap account or create a free account in seconds.
              </p>
            </div>
          </div>

          {/* Why sign-in comes first */}
          <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3">
            <div className="flex items-start gap-2.5 text-xs leading-5 text-slate-600">
              <Camera
                size={16}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-[#2563EB]"
              />
              <span>
                <strong className="font-semibold text-slate-900">
                  Private photos:
                </strong>{" "}
                Your uploaded snaps stay linked privately to your account.
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-xs leading-5 text-slate-600">
              <MapPin
                size={16}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-[#10B981]"
              />
              <span>
                <strong className="font-semibold text-slate-900">
                  Protected location:
                </strong>{" "}
                Optional GPS coordinates are never exposed on public feeds.
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-xs leading-5 text-slate-600">
              <ShieldCheck
                size={16}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-[#F97316]"
              />
              <span>
                <strong className="font-semibold text-slate-900">
                  Follow-up tracking:
                </strong>{" "}
                Track review updates and status changes from your profile.
              </span>
            </div>
          </div>

          {/* Sign In / Sign Up Tab Switcher */}
          <div
            role="tablist"
            aria-label="Choose Sign In or Create Account"
            className="mt-6 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={authTab === "login"}
              onClick={() => setAuthTab("login")}
              className={`min-h-[42px] rounded-lg px-4 text-sm font-semibold transition-colors ${
                authTab === "login"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authTab === "signup"}
              onClick={() => setAuthTab("signup")}
              className={`min-h-[42px] rounded-lg px-4 text-sm font-semibold transition-colors ${
                authTab === "signup"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Sign Up
            </button>
          </div>
        </div>

        {/* Inline working Firebase Auth form that unlocks the ReportWizard immediately */}
        <AuthForm
          mode={authTab}
          redirectPath="/report"
          onModeSwitch={setAuthTab}
          stayInPlaceOnAuth
        />

        {/* Standalone page links for direct bookmarking/navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-xs text-slate-600">
          <span>Prefer dedicated pages?</span>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/login?next=%2Freport"
              className="font-semibold text-[#2563EB] hover:underline"
            >
              Open Sign In page
            </Link>
            <Link
              href="/signup?next=%2Freport"
              className="font-semibold text-[#2563EB] hover:underline"
            >
              Open Sign Up page
            </Link>
            <Link
              href="/demo"
              className="font-medium text-slate-700 hover:text-slate-900 hover:underline"
            >
              Browse Read-Only Demo
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {/* Verified signed-in reporter bar */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${
          user.emailVerified
            ? "border-emerald-200 bg-emerald-50/70"
            : "border-amber-200 bg-amber-50/80"
        }`}
      >
        <div className="flex items-center gap-2.5 text-slate-800">
          {user.emailVerified ? (
            <UserCheck
              size={18}
              aria-hidden="true"
              className="shrink-0 text-emerald-700"
            />
          ) : (
            <AlertTriangle
              size={18}
              aria-hidden="true"
              className="shrink-0 text-amber-700"
            />
          )}
          <span>
            Signed in as{" "}
            <strong className="font-semibold text-slate-900">
              {displayAlias}
            </strong>
            {user.email ? (
              <span className="ml-1.5 text-xs text-slate-600">
                ({user.email})
              </span>
            ) : null}
          </span>
          {user.emailVerified ? (
            <span className="hidden items-center gap-1 text-xs font-medium text-emerald-700 sm:inline-flex">
              <CheckCircle2 size={14} aria-hidden="true" />
              Ready to snap &amp; report
            </span>
          ) : (
            <span className="hidden items-center gap-1 text-xs font-semibold text-amber-800 sm:inline-flex">
              Email verification needed to save
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="text-xs font-semibold text-[#2563EB] hover:underline"
          >
            Profile
          </Link>
          <button
            type="button"
            onClick={() => void signOutUser()}
            disabled={busy}
            className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <LogOut size={13} aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {!user.emailVerified && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
        >
          <p className="font-semibold">
            Verify your email (or use Google Sign-In) before submitting
          </p>
          <p className="mt-1 text-xs leading-5 text-amber-900">
            Firestore security rules require a verified email address to save
            reports. Click the link sent to{" "}
            <strong className="font-semibold">{user.email}</strong>, then tap{" "}
            <strong className="font-semibold">Refresh Status</strong> — or sign
            in with Google for instant verification.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshEmailVerification()}
              disabled={busy}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[#2563EB] px-3.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60"
            >
              <RefreshCw size={13} aria-hidden="true" />
              <span>I Verified — Refresh Status</span>
            </button>
            <button
              type="button"
              onClick={() => void resendVerificationEmail()}
              disabled={busy}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3.5 text-xs font-semibold text-amber-950 hover:bg-amber-100/60 disabled:opacity-60"
            >
              <Mail size={13} aria-hidden="true" />
              <span>Resend Verification Email</span>
            </button>
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              disabled={busy}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              <ShieldCheck size={13} aria-hidden="true" className="text-[#2563EB]" />
              <span>Sign in with Google Instead</span>
            </button>
          </div>
          {errorMessage && (
            <p className="mt-2.5 text-xs font-medium text-red-700">
              {errorMessage}
            </p>
          )}
          {statusMessage && (
            <p className="mt-2.5 text-xs font-medium text-emerald-800">
              {statusMessage}
            </p>
          )}
        </div>
      )}

      <ReportWizard />
    </div>
  );
}
