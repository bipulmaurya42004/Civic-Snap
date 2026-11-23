import type { Metadata } from "next";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { DemoWorkspace, type DemoTabKey } from "@/components/demo/DemoWorkspace";

export const metadata: Metadata = {
  title: "Read-Only Demo",
  description:
    "Explore CivicSnap sample reports, timelines, area dashboard, and recognition leaderboard in clearly labelled read-only demo mode.",
};

interface DemoPageProps {
  searchParams: Promise<{ tab?: string }>;
}

function parseTab(tab: string | undefined): DemoTabKey {
  if (tab === "dashboard" || tab === "leaderboard") return tab;
  return "issues";
}

export default async function DemoPage({ searchParams }: DemoPageProps) {
  const resolvedParams = await searchParams;
  const initialTab = parseTab(resolvedParams.tab);

  return (
    <div>
      <DemoBanner />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold text-[#C2410C]">
            Read-only product preview
          </p>
          <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-bold text-slate-900">
            Explore CivicSnap with sample data
          </h1>
          <p className="mt-2.5 text-sm leading-6 text-slate-600 sm:text-base">
            Filter sample reports across Bengaluru pilot wards (Indiranagar,
            Koramangala, HSR Layout, Whitefield, Jayanagar, MG Road, and
            Malleshwaram), inspect High Priority Zone alerts, open Google Maps
            links, and explore the Ward-wise Breakdown. Nothing here writes to a
            production database or notifies authorities.
          </p>
        </div>

        <div className="mt-8">
          <DemoWorkspace initialTab={initialTab} />
        </div>
      </div>
    </div>
  );
}
