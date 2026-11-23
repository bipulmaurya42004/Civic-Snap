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
  { label: "Explore Issues", href: "/issues" },
  { label: "City Dashboard", href: "/dashboard" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Rewards Store", href: "/rewards" },
  { label: "Read-Only Demo", href: "/demo" },
] as const;

const ACCOUNT_LINKS = [
  { label: "Sign In", href: "/login" },
  { label: "Create Account", href: "/signup" },
  { label: "My Profile", href: "/profile" },
  { label: "Project Admin", href: "/admin" },
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
    hoverClass: "hover:border-pink-400/60 hover:bg-pink-500/15 hover:text-pink-300",
  },
  {
    label: "Facebook",
    ariaLabel: "Follow CivicSnap on Facebook",
    href: "https://www.facebook.com/profile.php?id=61596559902939",
    icon: Facebook,
    hoverClass: "hover:border-blue-400/60 hover:bg-blue-500/15 hover:text-blue-300",
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="relative bg-[#0B1527] text-slate-300">
      {/* Crisp Civic Blue to Emerald top accent line */}
      <div
        aria-hidden="true"
        className="h-1 w-full bg-gradient-to-r from-[#00C6FF] via-[#2563EB] to-[#10B981]"
      />

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-14">
        {/* Top editorial action strip */}
        <div className="flex flex-col justify-between gap-6 pb-10 lg:flex-row lg:items-center">
          <div className="max-w-lg">
            <CivicSnapLogo size="lg" theme="dark" showTagline />
            <p className="mt-4 text-sm font-medium text-emerald-400">
              Sirf photo nahi. Follow-up bhi.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              An independent civic platform where residents document local city
              issues with a photo, review editable AI category suggestions, and
              follow transparent status timelines in one place.
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
                    className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-700/90 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-200 transition-colors ${social.hoverClass}`}
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
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8]"
            >
              <Camera size={16} aria-hidden="true" />
              <span>Report an Issue</span>
            </Link>
            <Link
              href="/signup?next=%2Freport"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-sm font-semibold text-slate-100 transition-colors hover:border-slate-500 hover:bg-slate-800"
            >
              <span>Create Account</span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:text-white"
            >
              <Compass size={15} aria-hidden="true" />
              <span>Try Demo</span>
            </Link>
          </div>
        </div>

        {/* Middle structured directory + transparency panel */}
        <div className="grid gap-10 border-y border-slate-800/90 py-10 md:grid-cols-12">
          {/* Platform links */}
          <div className="md:col-span-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Platform
            </h2>
            <ul className="mt-4 space-y-2.5">
              {PLATFORM_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-slate-300 transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account & Trust links */}
          <div className="md:col-span-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Account &amp; Trust
            </h2>
            <ul className="mt-4 space-y-2.5">
              {ACCOUNT_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-slate-300 transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Transparency & Scope Card */}
          <div className="md:col-span-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-[#38BDF8]">
                  <ShieldCheck size={18} aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Independent Civic Platform Notice
                  </h2>
                  <p className="mt-1.5 text-xs leading-5 text-slate-400">
                    CivicSnap is an independent civic-technology prototype and
                    is not affiliated with any municipal corporation or
                    government authority. Submitting a report does not
                    automatically forward it to government departments or
                    guarantee a repair. Status updates are reviewed and updated
                    by authorised CivicSnap project admins.
                  </p>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-800/90 pt-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Supported MVP categories
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-300">
                  {COVERED_ISSUES.map((label) => (
                    <span key={label} className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-emerald-400"
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
          <p>© 2026 CivicSnap. Built for transparent civic issue tracking.</p>
          <p className="text-slate-400">
            Account required before reporting · Privacy-first photo handling
          </p>
        </div>
      </div>
    </footer>
  );
}
