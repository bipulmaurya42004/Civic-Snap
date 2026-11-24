"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Loader2, ShieldCheck, X } from "lucide-react";
import { CivicSnapLogo } from "@/components/brand/CivicSnapLogo";
import { useFirebaseAuth } from "@/components/providers/FirebaseAuthProvider";

export interface AuthModalRequest {
  title?: string;
  message?: string;
  redirectTo?: string;
  onSuccess?: () => void;
}

interface AuthModalContextValue {
  isOpen: boolean;
  openAuthModal: (request?: AuthModalRequest) => void;
  closeAuthModal: () => void;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

const VALUE_PROPS = [
  "Capture live-camera road hazards in 10 seconds with Hinglish voice",
  "Track infrastructure repair audits with AI Confidence Scores",
  "Unlock SHA-256 Civic Merit Certificates & 2026 Vanguard Standings",
] as const;

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, busy, errorMessage, clearError, signInWithGoogle } =
    useFirebaseAuth();
  const [modalRequest, setModalRequest] = useState<AuthModalRequest | null>(
    null
  );

  const isOpen = modalRequest !== null;

  const openAuthModal = useCallback(
    (request: AuthModalRequest = {}) => {
      clearError();
      setModalRequest(request);
    },
    [clearError]
  );

  const closeAuthModal = useCallback(() => {
    clearError();
    setModalRequest(null);
  }, [clearError]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAuthModal();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, closeAuthModal]);

  // Automatically close if user signs in from another surface
  useEffect(() => {
    if (user && isOpen) {
      const nextRoute = modalRequest?.redirectTo;
      const callback = modalRequest?.onSuccess;
      setModalRequest(null);
      if (callback) callback();
      if (nextRoute) router.push(nextRoute);
    }
  }, [user, isOpen, modalRequest, router]);

  const handleGoogleSignIn = async () => {
    const ok = await signInWithGoogle();
    if (ok) {
      const nextRoute = modalRequest?.redirectTo;
      const callback = modalRequest?.onSuccess;
      setModalRequest(null);
      if (callback) callback();
      if (nextRoute) {
        router.push(nextRoute);
      }
    }
  };

  return (
    <AuthModalContext.Provider
      value={{ isOpen, openAuthModal, closeAuthModal }}
    >
      {children}

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              key="auth-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeAuthModal}
              aria-hidden="true"
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px]"
            />

            <motion.div
              key="auth-modal-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="civicsnap-auth-modal-title"
              data-testid="auth-modal-dialog"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-7"
            >
              {/* Top Row: Logo + Close */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CivicSnapLogo size="sm" theme="light" />
                  <span className="text-xs font-semibold text-blue-600">
                    Sign in to CivicSnap
                  </span>
                </div>
                <button
                  type="button"
                  onClick={closeAuthModal}
                  aria-label="Close sign in dialog"
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  <X size={17} aria-hidden="true" />
                </button>
              </div>

              {/* Headline & Contextual Message */}
              <div className="mt-5">
                <h2
                  id="civicsnap-auth-modal-title"
                  className="font-[var(--font-heading)] text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
                >
                  {modalRequest?.title ||
                    "Join Bengaluru's Verified Civic Stewards"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {modalRequest?.message ||
                    "Sign in with your Google account to submit live-camera civic reports, upvote neighborhood priorities, and unlock SHA-256 verifiable 2026 Civic Merit Certificates."}
                </p>
              </div>

              {/* Value Props Checklist */}
              <ul className="mt-5 space-y-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 text-xs leading-5 text-slate-700 sm:text-sm">
                {VALUE_PROPS.map((prop) => (
                  <li key={prop} className="flex items-start gap-2.5">
                    <CheckCircle2
                      size={16}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-emerald-600"
                    />
                    <span>{prop}</span>
                  </li>
                ))}
              </ul>

              {/* Auth Error Notice */}
              {errorMessage && (
                <div
                  role="alert"
                  className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700"
                >
                  {errorMessage}
                </div>
              )}

              {/* Primary Google Sign-In CTA */}
              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={() => void handleGoogleSignIn()}
                  disabled={busy}
                  className="inline-flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2
                      size={17}
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
                  onClick={closeAuthModal}
                  className="inline-flex min-h-[40px] w-full cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                >
                  Continue browsing as guest
                </button>
              </div>

              {/* Privacy Footnote */}
              <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500">
                <ShieldCheck
                  size={13}
                  className="shrink-0 text-blue-600"
                  aria-hidden="true"
                />
                <span>
                  Verified identity &amp; daily limits protect the 2026
                  Bengaluru Civic Vanguard ledger from spam.
                </span>
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AuthModalContext.Provider>
  );
}

export function useAuthModal(): AuthModalContextValue {
  const ctx = useContext(AuthModalContext);
  if (!ctx) {
    throw new Error("useAuthModal must be used within an AuthModalProvider.");
  }
  return ctx;
}
