import type { Metadata } from "next";
import { LiveDashboardWorkspace } from "@/components/dashboard/LiveDashboardWorkspace";

export const metadata: Metadata = {
  title: "City Dashboard",
  description:
    "View Bengaluru ward-wise breakdowns, category distributions, and live resolution status progress on CivicSnap.",
};

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold text-[#2563EB]">
          Bengaluru Pilot · CivicSnap overview
        </p>
        <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-bold text-slate-900">
          City &amp; ward report dashboard
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
          Track ward-wise breakdowns across Bengaluru pilot localities alongside
          live category and resolution status counts on CivicSnap. Fewer
          reports in a ward can reflect lower participation rather than fewer
          local issues.
        </p>
      </div>

      <div className="mt-6">
        <LiveDashboardWorkspace />
      </div>
    </div>
  );
}
