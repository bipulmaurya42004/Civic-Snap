"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  LogIn,
  LogOut,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useFirebaseAuth } from "@/components/providers/FirebaseAuthProvider";
import { buildAuthHref, validateAuthInput } from "@/lib/civic-logic";

interface AuthFormProps {
  mode: "login" | "signup";
  redirectPath: string;
  /** Optional override when embedded inside a gate (e.g., /report) */
  onModeSwitch?: (nextMode: "login" | "signup") => void;
  /** When true, skips full-page navigation after auth because parent unlocks inline */
  stayInPlaceOnAuth?: boolean;
}

export function AuthForm({
  mode,
  redirectPath,
  onModeSwitch,
  stayInPlaceOnAuth = false,
}: AuthFormProps) {
  const router = useRouter();
  const {
    user,
    displayAlias,
    busy,
    errorMessage,
    statusMessage,
    clearError,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOutUser,
  } = useFirebaseAuth();

  const isSignup = mode === "signup";
  const [alias, setAlias] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [leaderboardOptIn, setLeaderboardOptIn] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleGoogleAuth = async () => {
    clearError();
    setValidationError(null);
    const ok = await signInWithGoogle(
      isSignup
        ? {
            preferredAlias: alias.trim() || undefined,
            leaderboardOptIn,
          }
        : undefined
    );
    if (ok && !stayInPlaceOnAuth) {
      router.push(redirectPath);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();

    const check = validateAuthInput({
      mode,
      alias,
      email,
      password,
    });
    if (!check.valid) {
      setValidationError(check.error ?? "Please check your details.");
      return;
    }

    setValidationError(null);
    const ok = isSignup
      ? await signUpWithEmail({
          alias: alias.trim(),
          email: email.trim(),
          password,
          leaderboardOptIn,
        })
      : await signInWithEmail({
          email: email.trim(),
          password,
        });

    if (ok && !stayInPlaceOnAuth) {
      router.push(redirectPath);
    }
  };

  // Already signed in view on standalone /login or /signup routes
  if (user && !stayInPlaceOnAuth) {
    return (
      <div className="rounded-[20px] border border-emerald-200 bg-white p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              You are signed in as {displayAlias}
            </h2>
            {user.email && (
              <p className="mt-0.5 text-sm text-slate-600">{user.email}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={redirectPath}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8]"
          >
            <span>Continue to {redirectPath === "/report" ? "Report an Issue" : "CivicSnap"}</span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={() => void signOutUser()}
            disabled={busy}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <LogOut size={15} aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  const activeError = validationError || errorMessage;
  const switchTargetHref = buildAuthHref(
    isSignup ? "login" : "signup",
    redirectPath
  );

  return (
    <div className="rounded-[20px] border border-slate-200 bg-white p-6 sm:p-8">
      {/* Primary Google Sign-In / Sign-Up button */}
      <button
        type="button"
        onClick={() => void handleGoogleAuth()}
        disabled={busy}
        className="inline-flex min-h-[46px] w-full items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? (
          <Loader2 size={17} className="animate-spin text-[#2563EB]" aria-hidden="true" />
        ) : (
          <ShieldCheck size={17} className="text-[#2563EB]" aria-hidden="true" />
        )}
        <span>
          {isSignup ? "Sign up with Google" : "Continue with Google"}
        </span>
      </button>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium text-slate-500">
          or use email &amp; password
        </span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {isSignup && (
          <div>
            <label
              htmlFor="auth-alias"
              className="mb-1.5 block text-sm font-medium text-slate-900"
            >
              Display alias
            </label>
            <input
              id="auth-alias"
              name="alias"
              type="text"
              autoComplete="nickname"
              maxLength={40}
              value={alias}
              onChange={(e) => {
                setAlias(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="e.g., CommuterNorth"
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400"
            />
            <p className="mt-1 text-xs text-slate-500">
              Shown only if you opt in to the public leaderboard. Never shown
              with your email.
            </p>
          </div>
        )}

        <div>
          <label
            htmlFor="auth-email"
            className="mb-1.5 block text-sm font-medium text-slate-900"
          >
            Email address
          </label>
          <input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (validationError) setValidationError(null);
            }}
            placeholder="you@example.com"
            className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400"
          />
        </div>

        <div>
          <label
            htmlFor="auth-password"
            className="mb-1.5 block text-sm font-medium text-slate-900"
          >
            Password
          </label>
          <input
            id="auth-password"
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            minLength={isSignup ? 8 : 1}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (validationError) setValidationError(null);
            }}
            placeholder={
              isSignup ? "Minimum 8 characters" : "Enter your password"
            }
            className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400"
          />
        </div>

        {isSignup && (
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <input
              id="auth-leaderboard-optin"
              type="checkbox"
              checked={leaderboardOptIn}
              onChange={(e) => setLeaderboardOptIn(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#2563EB]"
            />
            <label
              htmlFor="auth-leaderboard-optin"
              className="text-xs leading-5 text-slate-600"
            >
              Show my display alias on the public recognition leaderboard
              (optional — you can change this anytime in Profile).
            </label>
          </div>
        )}

        <input type="hidden" name="next" value={redirectPath} />

        {activeError && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700"
          >
            {activeError}
          </p>
        )}

        {statusMessage && (
          <p
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800"
          >
            {statusMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-2 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : isSignup ? (
            <UserPlus size={16} aria-hidden="true" />
          ) : (
            <LogIn size={16} aria-hidden="true" />
          )}
          <span>
            {busy
              ? isSignup
                ? "Creating account..."
                : "Signing in..."
              : isSignup
                ? "Create Account & Continue"
                : "Sign In & Continue"}
          </span>
        </button>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-5 text-sm text-slate-600">
        {isSignup ? (
          <p>
            Already have an account?{" "}
            {onModeSwitch ? (
              <button
                type="button"
                onClick={() => {
                  clearError();
                  setValidationError(null);
                  onModeSwitch("login");
                }}
                className="font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
              >
                Sign in
              </button>
            ) : (
              <Link
                href={switchTargetHref}
                className="font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
              >
                Sign in
              </Link>
            )}
          </p>
        ) : (
          <p>
            New to CivicSnap?{" "}
            {onModeSwitch ? (
              <button
                type="button"
                onClick={() => {
                  clearError();
                  setValidationError(null);
                  onModeSwitch("signup");
                }}
                className="font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
              >
                Create an account
              </button>
            ) : (
              <Link
                href={switchTargetHref}
                className="font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
              >
                Create an account
              </Link>
            )}
          </p>
        )}

        <Link
          href="/demo"
          className="text-xs font-semibold text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
        >
          Explore Demo without an account
        </Link>
      </div>
    </div>
  );
}
