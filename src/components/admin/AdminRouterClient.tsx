"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Database,
  Lock,
  LogIn,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useFirebaseAuth } from "@/components/providers/FirebaseAuthProvider";
import { canAccessAdminDashboard } from "@/lib/admin-issues-logic";
import { LiveIssuesAdminPanel } from "@/components/admin/LiveIssuesAdminPanel";
import { AdminWorkspace } from "@/components/admin/AdminWorkspace";
import { LoadingState } from "@/components/ui/StateViews";

type AdminConsoleTab = "issues" | "reports";

export function AdminRouterClient() {
  const { user, isAdmin, authReady, signInWithGoogle, signOutUser, busy } =
    useFirebaseAuth();

  const [activeTab, setActiveTab] = useState<AdminConsoleTab>("issues");
  const [switchingAccount, setSwitchingAccount] = useState(false);

  const hasAccess = canAccessAdminDashboard({
    userEmail: user?.email,
  });

  const handleSwitchAccount = async () => {
    setSwitchingAccount(true);
    try {
      await signOutUser();
      await signInWithGoogle();
    } finally {
      setSwitchingAccount(false);
    }
  };

  if (!authReady) {
    return (
      <div className="mt-6">
        <LoadingState
          label="Verifying authenticated CivicSnap Admin credentials..."
          rows={3}
        />
      </div>
    );
  }

  if (!hasAccess) {
    const actionBusy = busy || switchingAccount;
    return (
      <section
        data-testid="admin-access-denied"
        aria-label="Municipal Admin Access Restricted"
        className="mt-6 rounded-2xl border border-rose-200 bg-white p-6 shadow-xs sm:p-8"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600">
            <Lock size={22} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-rose-600">
              Access Denied · Authenticated Whitelist Only
            </p>
            <h2 className="mt-1 font-[var(--font-heading)] text-xl font-bold text-slate-900 sm:text-2xl">
              Municipal Admin Access Restricted
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Sign in with an authorized CivicSnap admin email.
            </p>

            {user?.email && (
              <p className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-600">
                Currently signed in as{" "}
                <strong className="font-semibold text-slate-900">
                  {user.email}
                </strong>
                , which is not authorized in{" "}
                <code className="rounded bg-slate-200/70 px-1 py-0.5 font-mono text-[11px] text-slate-800">
                  NEXT_PUBLIC_ADMIN_EMAILS
                </code>
                .
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {user ? (
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => void handleSwitchAccount()}
                  className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap"
                >
                  <RefreshCw
                    size={15}
                    className={actionBusy ? "animate-spin" : ""}
                    aria-hidden="true"
                  />
                  <span>
                    {actionBusy ? "Switching Account..." : "Switch Account"}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => void signInWithGoogle()}
                  className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap"
                >
                  <LogIn size={15} aria-hidden="true" />
                  <span>
                    {actionBusy ? "Signing In..." : "Sign In with Google"}
                  </span>
                </button>
              )}

              <Link
                href="/dashboard"
                className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
              >
                Citizen Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="mt-6">
      {/* Authenticated Admin Queue Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-xs">
        <div
          role="tablist"
          aria-label="Admin dashboard views"
          className="inline-flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100/90 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "issues"}
            onClick={() => setActiveTab("issues")}
            className={`inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all sm:text-sm ${
              activeTab === "issues"
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Database size={15} aria-hidden="true" />
            <span>Real-Time Audit Feed</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "reports"}
              onClick={() => setActiveTab("reports")}
              className={`inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all sm:text-sm ${
                activeTab === "reports"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Sparkles size={15} aria-hidden="true" />
              <span>Private Reports &amp; Before/After Console</span>
            </button>
          )}
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          <ShieldCheck size={13} aria-hidden="true" />
          <span>Authorized Admin ({user?.email})</span>
        </span>
      </div>

      {activeTab === "issues" ? (
        <LiveIssuesAdminPanel />
      ) : (
        <div className="mt-6">
          <AdminWorkspace />
        </div>
      )}
    </div>
  );
}
