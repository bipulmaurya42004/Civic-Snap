import type { Metadata } from "next";
import { WardWarsClient } from "@/components/leaderboard/WardWarsClient";

export const metadata: Metadata = {
  title:
    "Live Citizen & Ward Leaderboard — CivicSnap AI Independent Bengaluru Public Infrastructure Ledger",
  description:
    "Live Firestore citizen Hall of Fame and dynamic Bengaluru ward standings computed from real verified civic infrastructure reports.",
};

export default function LeaderboardPage() {
  return <WardWarsClient />;
}
