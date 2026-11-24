"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { useFirebaseAuth } from "@/components/providers/FirebaseAuthProvider";
import { useAuthModal } from "@/components/AuthModal";
import { ReportComposerClient } from "@/components/report/ReportComposerClient";
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
  const { openAuthModal } = useAuthModal();

  if (!authReady) {
    return (
      <LoadingState
        label="Preparing Bengaluru smart civic reporter..."
        rows={3}
      />
    );
  }

  // Action-gated lock for unauthenticated guests on direct /report navigation
  if (!user) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        {/* Softly blurred background preview of the report composer */}
        <div
          aria-hidden="true"
          className="pointer-events-none max-h-[540px] select-none overflow-hidden opacity-45 blur-sm"
        >
          <div className="p-6">
            <ReportComposerClient />
          </div>
        </div>

        {/* Centered Sign-In Required Overlay Card */}
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/15 p-4 backdrop-blur-[2px]">
          <div
            data-testid="report-signin-required-card"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl sm:p-8"
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Lock size={22} aria-hidden="true" />
            </div>
            <p className="mt-3 text-xs font-semibold tracking-wide text-blue-600 uppercase">
              2026 Verified Citizen Reporting
            </p>
            <h2 className="mt-1.5 font-[var(--font-heading)] text-xl font-bold text-slate-900 sm:text-2xl">
              Sign In Required to Submit Reports
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Sign in with Google to capture live-camera civic audits for the
              Bengaluru open ledger, earn +50 Merit Points strictly on verified
              fixes (AI Confidence Score ≥ 90% + Admin approval), and qualify
              for the 2026 Bengaluru Civic Vanguard Citation.
            </p>

            {errorMessage && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700"
              >
                {errorMessage}
              </div>
            )}

            <div className="mt-6 space-y-2.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => void signInWithGoogle()}
                className="inline-flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60"
              >
                {busy ? (
                  <Loader2
                    size={16}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-extrabold text-blue-600"
                  >
                    G
                  </span>
                )}
                <span>
                  {busy ? "Signing in with Google..." : "Continue with Google"}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  openAuthModal({
                    title: "Sign In Required to Submit Reports",
                    message:
                      "Verify your citizen account with Google to submit AI-audited infrastructure reports and earn 2026 Merit Points.",
                    redirectTo: "/report",
                  })
                }
                className="inline-flex min-h-[40px] w-full cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Why Sign In? View Benefits
              </button>

              <Link
                href="/feed"
                className="inline-flex min-h-[38px] w-full items-center justify-center text-xs font-semibold text-slate-500 transition-colors hover:text-blue-600"
              >
                ← Browse Public Issues Feed (Read-Only)
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Signed-in verified session bar */}
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
              2026 Verified Citizen Ledger Active
            </span>
          ) : (
            <span className="hidden items-center gap-1 text-xs font-semibold text-amber-800 sm:inline-flex">
              Verify email to submit live reports
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            Profile
          </Link>
          <button
            type="button"
            onClick={() => void signOutUser()}
            disabled={busy}
            className="inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
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
            Verify your email (or use Google Sign-In) to submit live verified
            civic reports
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshEmailVerification()}
              disabled={busy}
              className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <RefreshCw size={13} aria-hidden="true" />
              <span>Refresh Status</span>
            </button>
            <button
              type="button"
              onClick={() => void resendVerificationEmail()}
              disabled={busy}
              className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3.5 text-xs font-semibold text-amber-950 hover:bg-amber-100/60 disabled:opacity-60"
            >
              <Mail size={13} aria-hidden="true" />
              <span>Resend Email</span>
            </button>
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              disabled={busy}
              className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              <ShieldCheck
                size={13}
                aria-hidden="true"
                className="text-blue-600"
              />
              <span>Sign in with Google</span>
            </button>
          </div>
          {errorMessage && (
            <p className="mt-2 text-xs font-medium text-rose-700">
              {errorMessage}
            </p>
          )}
          {statusMessage && (
            <p className="mt-2 text-xs font-medium text-emerald-800">
              {statusMessage}
            </p>
          )}
        </div>
      )}

      <ReportComposerClient />
    </div>
  );
}
