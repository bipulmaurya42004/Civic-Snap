import Link from "next/link";
import {
  ArrowUpRight,
  Camera,
  Compass,
  Facebook,
  Instagram,
  ShieldCheck,
  Twitter,
} from "lucide-react";
import { CivicSnapLogo } from "@/components/brand/CivicSnapLogo";

const PLATFORM_LINKS = [
  { label: "Report an Issue", href: "/report" },
  { label: "Explore Issues", href: "/feed" },
  { label: "Ward Wars Leaderboard", href: "/ward-wars" },
  { label: "Civic Honors", href: "/rewards" },
  { label: "City Dashboard", href: "/admin" },
  { label: "Read-Only Demo", href: "/demo" },
] as const;

const ACCOUNT_LINKS = [
  { label: "Sign In", href: "/login" },
  { label: "Create Account", href: "/signup" },
  { label: "My Profile", href: "/profile" },
  { label: "Staff Audit Queue", href: "/admin" },
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
    hoverClass: "hover:border-pink-300/70 hover:bg-pink-500/20 hover:text-white",
  },
  {
    label: "Facebook",
    ariaLabel: "Follow CivicSnap on Facebook",
    href: "https://www.facebook.com/profile.php?id=61596559902939",
    icon: Facebook,
    hoverClass: "hover:border-sky-300/70 hover:bg-sky-500/25 hover:text-white",
  },
  {
    label: "Twitter",
    ariaLabel: "Follow CivicSnap on Twitter",
    href: "https://x.com/civicsnap",
    icon: Twitter,
    hoverClass: "hover:border-sky-300/80 hover:bg-sky-400/25 hover:text-white",
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="relative border-t border-blue-400/30 bg-gradient-to-br from-[#0F2C67] via-[#1D4ED8] to-[#172554] text-blue-100">
      {/* Bright Civic Blue Top Accent Line */}
      <div
        aria-hidden="true"
        className="h-1 w-full bg-gradient-to-r from-sky-300 via-blue-400 to-cyan-300"
      />

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-14">
        {/* Top Action Strip */}
        <div className="flex flex-col justify-between gap-6 pb-10 lg:flex-row lg:items-center">
          <div className="max-w-lg">
            <CivicSnapLogo size="lg" theme="dark" showTagline />
            <p className="mt-4 text-sm font-semibold text-sky-200">
              Sirf photo nahi. Follow-up bhi.
            </p>
            <p className="mt-1.5 text-sm leading-6 text-blue-100/90">
              Citizen-driven civic accountability for Bengaluru wards — report
              in Hinglish, capture live camera street evidence, run Gemini AI
              Confidence Score audits, and earn Bengaluru Civic Vanguard
              Citations.
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
                    className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-sm transition-colors ${social.hoverClass}`}
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
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition-all hover:bg-blue-50 active:scale-95"
            >
              <Camera size={16} aria-hidden="true" />
              <span>Report an Issue</span>
            </Link>
            <Link
              href="/admin"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20"
            >
              <span>City Dashboard</span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
            <Link
              href="/feed"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-blue-100 transition-colors hover:text-white"
            >
              <Compass size={15} aria-hidden="true" />
              <span>Explore Feed</span>
            </Link>
          </div>
        </div>

        {/* Middle Structured Directory + Transparency Panel */}
        <div className="grid gap-10 border-y border-white/15 py-10 md:grid-cols-12">
          <div className="md:col-span-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-sky-200">
              Platform
            </h2>
            <ul className="mt-4 space-y-2.5">
              {PLATFORM_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-blue-100 transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-sky-200">
              Account &amp; Trust
            </h2>
            <ul className="mt-4 space-y-2.5">
              {ACCOUNT_LINKS.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-blue-100 transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-6">
            <div className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-sky-200">
                  <ShieldCheck size={18} aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Independent Open Civic Prototype Disclaimer
                  </h2>
                  <p
                    data-testid="footer-legal-disclaimer"
                    className="mt-1.5 text-xs leading-5 text-blue-100/90"
                  >
                    CivicSnap is an independent citizen-driven open civic tech
                    prototype. It is not affiliated with, nor an official agency
                    of, the BBMP, BDA, or the Government of Karnataka.
                  </p>
                </div>
              </div>

              <div className="mt-4 border-t border-white/15 pt-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-200">
                  Supported civic categories
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-white">
                  {COVERED_ISSUES.map((label) => (
                    <span key={label} className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-sky-300"
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
        <div className="mt-8 flex flex-col items-start justify-between gap-3 text-xs text-blue-200 sm:flex-row sm:items-center">
          <p>© 2026 CivicSnap · Bengaluru Pilot</p>
          <p className="text-blue-200/90">
            Privacy-first photo handling · Daylight-accessible Indian civic UI
          </p>
        </div>
      </div>
    </footer>
  );
}
