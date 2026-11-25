import type { Metadata } from "next";
import { WardWarsClient } from "@/components/leaderboard/WardWarsClient";

export const metadata: Metadata = {
  title:
    "2026 Bengaluru Civic Vanguard Standings — CivicSnap AI Independent Public Infrastructure Ledger",
  description:
    "Real-time Firestore citizen rankings and dynamic Bengaluru ward standings aggregated strictly from live civic reports and verified fixes.",
};

export default function WardWarsPage() {
  return <WardWarsClient />;
}
