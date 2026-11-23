import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "Plain-language privacy guide explaining what information is public, private, and optional on CivicSnap.",
};

const PRIVACY_SECTIONS = [
  {
    title: "1. What is shown publicly",
    body: "Public issue listings and detail views show only explicitly approved, safe fields: report ID, issue title, category, general locality/area, current status (Pending, In Progress, Resolved), public summary text, and timestamped status timeline notes.",
  },
  {
    title: "2. What stays private",
    body: "Raw uploaded report photos, optional precise GPS coordinates, account email addresses, and unapproved draft content are restricted to the report owner and authorised CivicSnap project admins. They are never returned by public feed queries.",
  },
  {
    title: "3. Photo metadata removal and safety limits",
    body: "When real image uploads are stored on the server (Milestone 2), files are validated and re-encoded to strip unnecessary metadata such as EXIF camera/GPS tags. Metadata removal does not blur faces, vehicle number plates, or house numbers visible inside an image—so please photograph safely and avoid capturing identifiable people or private information.",
  },
  {
    title: "4. Optional GPS location",
    body: "Sharing browser GPS coordinates is optional. If you decline location permission or prefer not to share device coordinates, you can select a pilot locality or type an area name manually without blocking report submission.",
  },
  {
    title: "5. CivicSnap AI authenticity & engineering analysis",
    body: "Uploaded photos and report descriptions are inspected server-side by CivicSnap AI to verify genuine civic issues, filter out spam or non-civic images, and estimate repair materials and priority scores.",
  },
  {
    title: "6. Opt-in citizen leaderboard",
    body: "Public leaderboard visibility is opt-in only. If you choose to appear, CivicSnap displays your chosen display alias, accepted report count, and recognition points—never your email address or legal name. Recognition points carry no cash value.",
  },
  {
    title: "7. Independent prototype boundaries",
    body: "CivicSnap is an independent civic-technology prototype and is not affiliated with any government agency. Reports are not automatically forwarded to official municipal authorities.",
  },
] as const;

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold text-[#2563EB]">
        Plain-language privacy guide
      </p>
      <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-bold text-slate-900">
        How CivicSnap handles your information
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
        CivicSnap is designed around privacy-conscious civic reporting. Here is
        a clear breakdown of what is shared, what stays restricted, and what
        choices remain in your control.
      </p>

      <div className="mt-8 space-y-4">
        {PRIVACY_SECTIONS.map((section) => (
          <section
            key={section.title}
            className="rounded-[18px] border border-slate-200 bg-white p-6"
          >
            <h2 className="text-base font-semibold text-slate-900">
              {section.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {section.body}
            </p>
          </section>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-slate-200 pt-6 text-sm">
        <Link
          href="/report"
          className="font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
        >
          View Reporting Flow
        </Link>
        <span aria-hidden="true" className="text-slate-300">
          ·
        </span>
        <Link
          href="/demo"
          className="font-semibold text-slate-700 hover:text-slate-900"
        >
          Explore Read-Only Demo
        </Link>
      </div>
    </div>
  );
}
