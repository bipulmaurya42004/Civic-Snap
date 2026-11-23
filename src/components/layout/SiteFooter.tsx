import Link from "next/link";
import {
  ArrowUpRight,
  Camera,
  Compass,
  Facebook,
  Instagram,
  ShieldCheck,
} from "lucide-react";
import { CivicSnapLogo } from "@/components/brand/CivicSnapLogo";

const PLATFORM_LINKS = [
  { label: "Report an Issue", href: "/report" },
  { label: "Explore Issues", href: "/feed" },
  { label: "City Dashboard", href: "/admin?mode=judge" },
  { label: "Ward Wars Leaderboard", href: "/ward-wars" },
  { label: "Rewards Store", href: "/rewards" },
  { label: "Read-Only Demo", href: "/demo" },
] as const;

const ACCOUNT_LINKS = [
  { label: "Sign In", href: "/login" },
  { label: "Create Account", href: "/signup" },
  { label: "My Profile", href: "/profile" },
  { label: "Live Admin Queue", href: "/admin" },
  { label: "Privacy Guide", href: "/privacy" },
] as const;

const COVERED_ISSUES = [
  "Pothole / Road Damage",
  "Garbage / Waste",
  "Streetlight",
  "Other Civic Issues",
] as const;

const SOCIAL_LINKS = [
  {
    label: "Instagram",
    ariaLabel: "Follow CivicSnap on Instagram",
    href: "https://www.instagram.com/civic.snap/",
    icon: Instagram,
    hoverClass: "hover:border-pink-300 hover:bg-pink-50 hover:text-pink-700",
  },
  {
    label: "Facebook",
    ariaLabel: "Follow CivicSnap on Facebook",
    href: "https://www.facebook.com/profile.php?id=61596559902939",
    icon: Facebook,
    hoverClass: "hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700",
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="relative border-t border-slate-200 bg-white text-slate-600">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-14">
        {/* Top Clean Light action strip */}
        <div className="flex flex-col justify-between gap-6 pb-10 lg:flex-row lg:items-center">
          <div className="max-w-lg">
            <CivicSnapLogo size="lg" theme="light" showTagline />
            <p className="mt-4 text-sm font-semibold text-blue-600">
              Sirf photo nahi. Follow-up bhi.
            </p>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">
              Daylight-accessible Indian civic accountability for Bengaluru
              wards — report in Hinglish, audit contractor materials with Gemini
              AI, and earn neighborhood café perks.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              {SOCIAL_LINKS.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.ariaLabel}
                    className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors ${social.hoverClass}`}
                  >
                    <Icon size={16} aria-hidden="true" />
                    <span>{social.label}</span>
                  </a>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/report"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95"
            >
              <Camera size={16} aria-hidden="true" />
              <span>Report an Issue</span>
            </Link>
            <Link
              href="/admin?mode=judge"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-100"
            >
              <span>Judge Demo Mode</span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
            <Link
              href="/feed"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              <Compass size={15} aria-hidden="true" />
              <span>Explore Feed</span>
            </Link>
          </div>
        </div>

        {/* Middle structured directory + transparency panel */}
        <div className="grid gap-10 border-y border-slate-200 py-10 md:grid-cols-12">
          <div className="md:col-span-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Platform
            </h2>
            <ul className="mt-4 space-y-2.5">
              {PLATFORM_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-slate-600 transition-colors hover:text-blue-600"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Account &amp; Trust
            </h2>
            <ul className="mt-4 space-y-2.5">
              {ACCOUNT_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-slate-600 transition-colors hover:text-blue-600"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <ShieldCheck size={18} aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Independent Civic Platform Notice
                  </h2>
                  <p className="mt-1.5 text-xs leading-5 text-slate-600">
                    CivicSnap is an independent civic-technology prototype built
                    for transparent neighborhood issue tracking and AI repair
                    auditing in Bengaluru. It is not affiliated with any
                    government authority.
                  </p>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-200 pt-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Supported civic categories
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-700">
                  {COVERED_ISSUES.map((label) => (
                    <span key={label} className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                      />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 flex flex-col items-start justify-between gap-3 text-xs text-slate-500 sm:flex-row sm:items-center">
          <p>© 2026 CivicSnap · Bengaluru Pilot</p>
          <p className="text-slate-500">
            Privacy-first photo handling · Daylight-accessible Indian civic UI
          </p>
        </div>
      </div>
    </footer>
  );
}
