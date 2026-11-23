import type { Metadata } from "next";
import { RewardsStoreWorkspace } from "@/components/rewards/RewardsStoreWorkspace";

export const metadata: Metadata = {
  title: "CivicPerks Rewards Store",
  description:
    "Redeem your CivicPoints for Bengaluru partner vouchers at Third Wave Coffee, Cult.fit, and Zepto with fraud-protected 15-minute counter verification timers.",
};

export default function RewardsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold tracking-wide text-blue-600">
          Bengaluru Pilot • CivicPerks Rewards Store
        </p>
        <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Redeem CivicPoints at Bengaluru partners
        </h1>
        <p className="mt-2.5 text-sm leading-6 text-slate-600 sm:text-base">
          Turn verified civic reports into neighborhood perks. Redeeming opens a
          fraud-protected 15-minute live merchant verification timer and QR code
          for instant counter redemption.
        </p>
      </div>

      <RewardsStoreWorkspace />
    </div>
  );
}
