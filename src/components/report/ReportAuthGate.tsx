"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { useFirebaseAuth } from "@/components/providers/FirebaseAuthProvider";
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

  if (!authReady) {
    return (
      <LoadingState
        label="Preparing Bengaluru smart civic reporter..."
        rows={3}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* If signed in, show compact verified session bar */}
      {user && (
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
                Firestore persistence active
              </span>
            ) : (
              <span className="hidden items-center gap-1 text-xs font-semibold text-amber-800 sm:inline-flex">
                Verify email to save to Firestore
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
              className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <LogOut size={13} aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {user && !user.emailVerified && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
        >
          <p className="font-semibold">
            Verify your email (or use Google Sign-In) to persist reports in
            Firestore
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshEmailVerification()}
              disabled={busy}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <RefreshCw size={13} aria-hidden="true" />
              <span>Refresh Status</span>
            </button>
            <button
              type="button"
              onClick={() => void resendVerificationEmail()}
              disabled={busy}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3.5 text-xs font-semibold text-amber-950 hover:bg-amber-100/60 disabled:opacity-60"
            >
              <Mail size={13} aria-hidden="true" />
              <span>Resend Email</span>
            </button>
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              disabled={busy}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              <ShieldCheck size={13} aria-hidden="true" className="text-blue-600" />
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
