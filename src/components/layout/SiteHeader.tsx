"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  Award,
  Camera,
  Compass,
  FileCheck2,
  HelpCircle,
  Home,
  Landmark,
  LogIn,
  LogOut,
  MapPin,
  MoreVertical,
  Shield,
  ShieldCheck,
  Sparkles,
  Trophy,
  User,
  X,
} from "lucide-react";
import { CivicSnapLogo } from "@/components/brand/CivicSnapLogo";
import { useFirebaseAuth } from "@/components/providers/FirebaseAuthProvider";

const PRIMARY_NAV_ITEMS = [
  {
    label: "Explore Issues",
    href: "/feed",
    matchPrefixes: ["/feed", "/issues"],
    isStaff: false,
  },
  {
    label: "Leaderboard",
    href: "/ward-wars",
    matchPrefixes: ["/ward-wars", "/leaderboard"],
    isStaff: false,
  },
  {
    label: "Civic Honors",
    href: "/rewards",
    matchPrefixes: ["/rewards"],
    isStaff: false,
  },
  {
    label: "Dashboard",
    href: "/admin",
    matchPrefixes: ["/admin", "/dashboard"],
    isStaff: true,
  },
] as const;

const DRAWER_OVERVIEW_ITEMS = [
  { label: "Home", href: "/", icon: Home },
  { label: "CM Annual Honors", href: "/#cm-honors", icon: Landmark },
  { label: "Merit Certificates", href: "/#certificates", icon: FileCheck2 },
  { label: "How It Works", href: "/#how-it-works", icon: Sparkles },
  { label: "FAQ & Help", href: "/#faq", icon: HelpCircle },
] as const;

const DRAWER_PLATFORM_ITEMS = [
  { label: "Explore Issues", href: "/feed", icon: MapPin },
  { label: "Leaderboard", href: "/ward-wars", icon: Trophy },
  { label: "Civic Honors", href: "/rewards", icon: Award },
  { label: "Dashboard (Staff)", href: "/admin", icon: Shield },
  { label: "Read-Only Audit View", href: "/admin?mode=judge", icon: ShieldCheck },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const { user, displayAlias, busy, signInWithGoogle, signOutUser } =
    useFirebaseAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6 lg:gap-4 lg:px-8">
          {/* Zone 1: Brand Logo + Green Bengaluru Pilot Pill */}
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/"
              aria-label="CivicSnap home"
              className="inline-flex min-h-[40px] shrink-0 items-center rounded-xl focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <CivicSnapLogo size="md" theme="light" />
            </Link>
            <span className="hidden xl:inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 whitespace-nowrap shrink-0">
              Bengaluru Pilot
            </span>
          </div>

          {/* Zone 2: Center Nav Links (Exact Order: Explore Issues, Leaderboard, Civic Honors, Dashboard) */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-0.5 lg:gap-1"
          >
            {PRIMARY_NAV_ITEMS.map((item) => {
              const isActive = item.matchPrefixes.some(
                (prefix) =>
                  pathname === prefix || pathname.startsWith(`${prefix}/`)
              );
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative whitespace-nowrap shrink-0 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors lg:px-3 lg:text-sm ${
                    isActive
                      ? "text-blue-700 font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="activeNavIndicator"
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 34,
                      }}
                      className="absolute inset-x-2 -bottom-[15px] h-0.5 rounded-full bg-blue-600"
                    />
                  )}
                  <span className="relative z-10 inline-flex items-center gap-1.5">
                    {item.isStaff && (
                      <Shield
                        size={14}
                        aria-hidden="true"
                        className={
                          isActive ? "text-blue-600" : "text-slate-400"
                        }
                      />
                    )}
                    <span>{item.label}</span>
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Zone 3: Right Actions (Sign In, My Profile, Report an Issue) + Three-Dots Drawer */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {user ? (
              <>
                <Link
                  href="/profile"
                  className="hidden lg:inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-100 whitespace-nowrap shrink-0 xl:text-sm"
                >
                  <User size={15} aria-hidden="true" className="text-blue-600" />
                  <span className="max-w-[96px] truncate">
                    {displayAlias || "My Profile"}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => void signOutUser()}
                  disabled={busy}
                  aria-label="Sign out"
                  className="hidden xl:inline-flex min-h-[40px] cursor-pointer items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap shrink-0"
                >
                  <LogOut size={14} aria-hidden="true" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden lg:inline-flex min-h-[40px] items-center rounded-xl px-2.5 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap shrink-0 xl:text-sm"
                >
                  Sign In
                </Link>
                <Link
                  href="/profile"
                  className="hidden lg:inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-all hover:bg-slate-100 whitespace-nowrap shrink-0 xl:text-sm"
                >
                  <User size={14} aria-hidden="true" className="text-blue-600" />
                  <span>My Profile</span>
                </Link>
              </>
            )}

            <Link
              href="/report"
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95 whitespace-nowrap shrink-0 sm:px-4 sm:text-sm"
            >
              <Camera size={15} aria-hidden="true" className="hidden sm:inline" />
              <span className="sm:hidden">Report</span>
              <span className="hidden sm:inline">Report an Issue</span>
            </Link>

            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-expanded={drawerOpen}
              aria-haspopup="dialog"
              aria-controls="civicsnap-slide-drawer"
              aria-label="Open navigation menu"
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-all hover:bg-slate-100 active:scale-95 touch-manipulation"
            >
              <MoreVertical
                size={19}
                aria-hidden="true"
                className="pointer-events-none"
              />
            </button>
          </div>
        </div>

        {/* Mobile Top Navigation Strip (Explore Issues, Leaderboard, Civic Honors, Dashboard) */}
        <nav
          aria-label="Mobile quick navigation"
          className="flex md:hidden items-center justify-between gap-1 border-t border-slate-100 bg-slate-50/90 px-2 py-1.5"
        >
          {PRIMARY_NAV_ITEMS.map((item) => {
            const isActive = item.matchPrefixes.some(
              (prefix) =>
                pathname === prefix || pathname.startsWith(`${prefix}/`)
            );
            return (
              <Link
                key={`mobile-${item.href}`}
                href={item.href}
                className={`inline-flex shrink-0 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-white hover:text-slate-900"
                }`}
              >
                {item.isStaff && (
                  <Shield
                    size={11}
                    aria-hidden="true"
                    className={isActive ? "text-blue-100" : "text-slate-400"}
                  />
                )}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Right-Edge Spring Slide-Over Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              key="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
              className="fixed inset-0 bg-slate-900/35 backdrop-blur-[2px]"
            />

            <motion.aside
              key="drawer-panel"
              id="civicsnap-slide-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="CivicSnap navigation drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 34 }}
              className="relative z-10 flex h-full w-full max-w-xs flex-col border-l border-slate-200 bg-white shadow-2xl sm:max-w-sm"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4">
                <div className="flex items-center gap-2">
                  <CivicSnapLogo size="sm" theme="light" />
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Bengaluru Pilot
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close navigation menu"
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  <X size={17} aria-hidden="true" />
                </button>
              </div>

              {/* Scrollable Sections */}
              <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
                {/* Section 1: Site Overview */}
                <section aria-label="Site overview links">
                  <p className="px-3 pb-2 text-xs font-semibold tracking-wide text-slate-400">
                    Site Overview
                  </p>
                  <ul className="space-y-1">
                    {DRAWER_OVERVIEW_ITEMS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setDrawerOpen(false)}
                            className="flex min-h-[42px] items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Icon
                              size={16}
                              aria-hidden="true"
                              className="shrink-0 text-blue-600"
                            />
                            <span>{item.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>

                <div className="border-t border-slate-100" />

                {/* Section 2: CivicSnap Platform */}
                <section aria-label="CivicSnap platform links">
                  <p className="px-3 pb-2 text-xs font-semibold tracking-wide text-slate-400">
                    CivicSnap Platform
                  </p>
                  <ul className="space-y-1">
                    {DRAWER_PLATFORM_ITEMS.map((item) => {
                      const Icon = item.icon;
                      const isDemoLink = item.href.includes("mode=judge");
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setDrawerOpen(false)}
                            className={`flex min-h-[42px] items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
                              isDemoLink
                                ? "bg-blue-50/70 text-blue-700 hover:bg-blue-100/70"
                                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                            }`}
                          >
                            <Icon
                              size={16}
                              aria-hidden="true"
                              className="shrink-0 text-blue-600"
                            />
                            <span>{item.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>

                <div className="border-t border-slate-100" />

                {/* Section 3: State Honors Details */}
                <section
                  aria-label="State Civic Honors details"
                  className="rounded-2xl border border-amber-200/90 bg-amber-50/50 p-3.5"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                    <Landmark size={15} className="text-amber-700" aria-hidden="true" />
                    <span>State Civic Honors 2025</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-slate-700">
                    Top 5 Bengaluru citizens are felicitated by the Hon&apos;ble
                    Chief Minister at the Annual Urban Governance Summit. Every
                    5 verified fixes automatically issue an official Digital
                    Civic Merit Certificate.
                  </p>
                  <Link
                    href="/rewards"
                    onClick={() => setDrawerOpen(false)}
                    className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline"
                  >
                    <Compass size={13} aria-hidden="true" />
                    <span>Open Civic Honors Portal →</span>
                  </Link>
                </section>

                <div className="border-t border-slate-100" />

                {/* Section 4: Account & Legal */}
                <section aria-label="Account and legal links">
                  <p className="px-3 pb-2 text-xs font-semibold tracking-wide text-slate-400">
                    Account &amp; Legal
                  </p>
                  <ul className="space-y-1">
                    <li>
                      <Link
                        href="/profile"
                        onClick={() => setDrawerOpen(false)}
                        className="flex min-h-[42px] items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                      >
                        <User
                          size={16}
                          aria-hidden="true"
                          className="shrink-0 text-slate-500"
                        />
                        <span>
                          {user
                            ? `My Profile (${displayAlias})`
                            : "My Profile & Certificates"}
                        </span>
                      </Link>
                    </li>

                    {user ? (
                      <li>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setDrawerOpen(false);
                            void signOutUser();
                          }}
                          className="flex min-h-[42px] w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50"
                        >
                          <LogOut
                            size={16}
                            aria-hidden="true"
                            className="shrink-0"
                          />
                          <span>Sign Out</span>
                        </button>
                      </li>
                    ) : (
                      <li>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setDrawerOpen(false);
                            void signInWithGoogle();
                          }}
                          className="flex min-h-[42px] w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50"
                        >
                          <LogIn
                            size={16}
                            aria-hidden="true"
                            className="shrink-0 text-blue-600"
                          />
                          <span>Sign In with Google</span>
                        </button>
                      </li>
                    )}

                    <li>
                      <Link
                        href="/privacy"
                        onClick={() => setDrawerOpen(false)}
                        className="flex min-h-[42px] items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                      >
                        <Shield
                          size={16}
                          aria-hidden="true"
                          className="shrink-0 text-slate-500"
                        />
                        <span>Privacy Policy</span>
                      </Link>
                    </li>
                  </ul>
                </section>
              </div>

              {/* Drawer Footer CTA */}
              <div className="border-t border-slate-200/80 bg-slate-50/70 p-4">
                <Link
                  href="/report"
                  onClick={() => setDrawerOpen(false)}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95"
                >
                  <Camera size={16} aria-hidden="true" />
                  <span>Report an Issue</span>
                </Link>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
