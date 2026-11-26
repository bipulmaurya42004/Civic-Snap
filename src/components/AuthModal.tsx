"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Shield,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { CivicSnapLogo } from "@/components/brand/CivicSnapLogo";
import { useFirebaseAuth } from "@/components/providers/FirebaseAuthProvider";
import { auth } from "@/lib/firebase";
import {
  resolvePostSignInOutcome,
  type AuthPortalRole,
} from "@/lib/admin-issues-logic";

export interface AuthModalRequest {
  title?: string;
  message?: string;
  redirectTo?: string;
  initialRole?: AuthPortalRole;
  onSuccess?: () => void;
}

interface AuthModalContextValue {
  isOpen: boolean;
  openAuthModal: (request?: AuthModalRequest) => void;
  closeAuthModal: () => void;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

const CITIZEN_VALUE_PROPS = [
  "Capture live-camera street hazards in 10 seconds with Hinglish voice",
  "Track neighborhood fixes on the Live Map with AI Confidence Scores",
  "Earn +50 CivicPoints after verification & unlock SHA-256 Certificates",
] as const;

const STAFF_VALUE_PROPS = [
  "Stream live Firestore citizen reports in the Independent Review Queue",
  "Audit evidence photos, GPS locations, and AI asphalt/cost estimates",
  "Execute real-time Repair Verification (+50 pts) & Independent Audit Verification",
] as const;

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, busy, errorMessage, clearError, signInWithGoogle } =
    useFirebaseAuth();
  const [modalRequest, setModalRequest] = useState<AuthModalRequest | null>(
    null
  );
  const [portalRole, setPortalRole] = useState<AuthPortalRole>("citizen");
  const [roleNotice, setRoleNotice] = useState<string | null>(null);
  const handlingSignInRef = useRef(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOpen = modalRequest !== null;

  const clearRedirectTimer = useCallback(() => {
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
  }, []);

  const openAuthModal = useCallback(
    (request: AuthModalRequest = {}) => {
      clearError();
      clearRedirectTimer();
      setRoleNotice(null);
      setPortalRole(request.initialRole ?? "citizen");
      setModalRequest(request);
    },
    [clearError, clearRedirectTimer]
  );

  const closeAuthModal = useCallback(() => {
    clearError();
    clearRedirectTimer();
    setRoleNotice(null);
    handlingSignInRef.current = false;
    setModalRequest(null);
  }, [clearError, clearRedirectTimer]);

  useEffect(() => {
    return () => {
      clearRedirectTimer();
    };
  }, [clearRedirectTimer]);

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

  // Automatically close if user signs in from another surface (but never swallow RBAC roleNotice)
  useEffect(() => {
    if (user && isOpen && !handlingSignInRef.current && !roleNotice) {
      const nextRoute = modalRequest?.redirectTo;
      const callback = modalRequest?.onSuccess;
      setModalRequest(null);
      if (callback) callback();
      if (nextRoute) router.push(nextRoute);
    }
  }, [user, isOpen, modalRequest, router, roleNotice]);

  const handleGoogleSignIn = async () => {
    clearError();
    clearRedirectTimer();
    setRoleNotice(null);
    handlingSignInRef.current = true;
    try {
      const ok = await signInWithGoogle();
      if (!ok) {
        return;
      }

      const signedInEmail = auth?.currentUser?.email ?? user?.email ?? null;
      const outcome = resolvePostSignInOutcome({
        portalRole,
        userEmail: signedInEmail,
        defaultRedirect: modalRequest?.redirectTo ?? null,
      });

      if (outcome.notice) {
        setRoleNotice(outcome.notice);
        const fallbackRoute = outcome.redirectTo || "/dashboard";
        redirectTimerRef.current = setTimeout(() => {
          setRoleNotice(null);
          setModalRequest(null);
          router.push(fallbackRoute);
        }, 2200);
        return;
      }

      const callback = modalRequest?.onSuccess;
      setModalRequest(null);
      if (callback) callback();
      if (outcome.redirectTo) {
        router.push(outcome.redirectTo);
      }
    } finally {
      handlingSignInRef.current = false;
    }
  };

  const isStaffTab = portalRole === "staff";
  const activeValueProps = isStaffTab ? STAFF_VALUE_PROPS : CITIZEN_VALUE_PROPS;

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
              className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-7"
            >
              {/* Top Row: Logo + Close */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CivicSnapLogo size="sm" theme="light" />
                  <span className="text-xs font-semibold text-[#2563EB]">
                    Role-Based Portal Access
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

              {/* Enterprise Civic Role Selector Tabs */}
              <div
                role="tablist"
                aria-label="Select sign-in portal role"
                className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-100/90 p-1.5"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={!isStaffTab}
                  data-testid="auth-role-tab-citizen"
                  onClick={() => {
                    clearRedirectTimer();
                    setPortalRole("citizen");
                    setRoleNotice(null);
                    clearError();
                  }}
                  className={`flex cursor-pointer flex-col items-start rounded-xl px-3 py-2.5 text-left transition-all ${
                    !isStaffTab
                      ? "bg-white text-slate-900 shadow-xs ring-1 ring-blue-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold sm:text-sm">
                    <User
                      size={14}
                      aria-hidden="true"
                      className={!isStaffTab ? "text-[#2563EB]" : "text-slate-400"}
                    />
                    <span>Citizen Portal</span>
                  </span>
                  <span className="mt-0.5 text-[11px] leading-4 text-slate-500">
                    Reports, Live Map, Vanguard Standings
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={isStaffTab}
                  data-testid="auth-role-tab-staff"
                  onClick={() => {
                    clearRedirectTimer();
                    setPortalRole("staff");
                    setRoleNotice(null);
                    clearError();
                  }}
                  className={`flex cursor-pointer flex-col items-start rounded-xl px-3 py-2.5 text-left transition-all ${
                    isStaffTab
                      ? "bg-[#1E293B] text-white shadow-xs ring-1 ring-slate-700"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold sm:text-sm">
                    <Shield
                      size={14}
                      aria-hidden="true"
                      className={isStaffTab ? "text-amber-300" : "text-slate-400"}
                    />
                    <span>Civic Verifier &amp; Admin</span>
                  </span>
                  <span
                    className={`mt-0.5 text-[11px] leading-4 ${
                      isStaffTab ? "text-slate-300" : "text-slate-500"
                    }`}
                  >
                    Review Queue, Repair Verification, Independent Audit
                  </span>
                </button>
              </div>

              <p
                data-testid="auth-modal-audit-tier-note"
                className="mt-2.5 rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-[11px] font-medium leading-4 text-amber-900"
              >
                🛡️ Independent Audit Tier — for Ward Leads, NGO Verifiers &amp; Hackathon Evaluators. Whitelisted emails only.
              </p>

              {/* Dynamic Portal Headline & Description */}
              <div className="mt-5">
                <h2
                  id="civicsnap-auth-modal-title"
                  className="font-[var(--font-heading)] text-xl font-bold tracking-tight text-slate-900"
                >
                  {isStaffTab
                    ? "Civic Verifier — Ward Auditor Portal"
                    : "Citizen Portal — Sign In to Report a Civic Issue"}
                </h2>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">
                  {isStaffTab
                    ? "Restricted to authorized CivicSnap Ward Auditors. Review queues, repair verification, and independent audit verification."
                    : "Sign in with Google to submit live-camera civic reports and earn +50 CivicPoints after verification."}
                </p>
              </div>

              {/* Role Capabilities Checklist */}
              <ul
                className={`mt-4 space-y-2 rounded-xl border p-4 text-xs leading-5 sm:text-sm ${
                  isStaffTab
                    ? "border-slate-200 bg-slate-900/[0.03] text-slate-700"
                    : "border-slate-200/80 bg-slate-50/80 text-slate-700"
                }`}
              >
                {activeValueProps.map((prop) => (
                  <li key={prop} className="flex items-start gap-2.5">
                    <CheckCircle2
                      size={16}
                      aria-hidden="true"
                      className={`mt-0.5 shrink-0 ${
                        isStaffTab ? "text-[#1E293B]" : "text-emerald-600"
                      }`}
                    />
                    <span>{prop}</span>
                  </li>
                ))}
              </ul>

              {/* Non-Whitelisted Citizen Fallback Banner */}
              {roleNotice && (
                <div
                  role="status"
                  data-testid="auth-modal-role-notice"
                  className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs leading-5 text-emerald-950"
                >
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2
                      size={16}
                      className="mt-0.5 shrink-0 text-emerald-600"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-semibold">{roleNotice}</p>
                      <button
                        type="button"
                        onClick={() => {
                          closeAuthModal();
                          router.push("/dashboard");
                        }}
                        className="mt-2 inline-flex cursor-pointer items-center gap-1 font-bold text-[#2563EB] hover:underline"
                      >
                        <span>Redirecting to Citizen Dashboard</span>
                        <ArrowRight size={13} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Auth Error Notice */}
              {errorMessage && (
                <div
                  role="alert"
                  className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700"
                >
                  {errorMessage}
                </div>
              )}

              {/* Dynamic Primary Google Sign-In CTA */}
              <div className="mt-5 space-y-2.5">
                {!roleNotice && (
                  <button
                    type="button"
                    data-testid="auth-modal-google-cta"
                    onClick={() => void handleGoogleSignIn()}
                    disabled={busy}
                    className={`inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
                      isStaffTab
                        ? "bg-[#1E293B] shadow-slate-900/20 hover:bg-[#0F172A]"
                        : "bg-[#2563EB] shadow-blue-600/20 hover:bg-[#1D4ED8]"
                    }`}
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
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-extrabold ${
                          isStaffTab ? "text-[#1E293B]" : "text-[#2563EB]"
                        }`}
                      >
                        G
                      </span>
                    )}
                    <span>
                      {busy
                        ? "Signing in with Google..."
                        : isStaffTab
                          ? "Sign in with Google (Ward Auditor)"
                          : "Sign in with Google (Citizen)"}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={closeAuthModal}
                  className="inline-flex min-h-[40px] w-full cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                >
                  {roleNotice ? "Close" : "Continue browsing as guest"}
                </button>
              </div>

              {/* Privacy & RBAC Footnote */}
              <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500">
                <ShieldCheck
                  size={13}
                  className="shrink-0 text-[#2563EB]"
                  aria-hidden="true"
                />
                <span>
                  {isStaffTab
                    ? "Ward Auditor access is verified in real time against NEXT_PUBLIC_ADMIN_EMAILS."
                    : "Verified identity & daily limits protect the 2026 Bengaluru Civic Vanguard ledger from spam."}
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
