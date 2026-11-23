import type { Metadata } from "next";
import { WardWarsClient } from "@/components/leaderboard/WardWarsClient";

export const metadata: Metadata = {
  title: "Ward Wars Leaderboard",
  description:
    "Bengaluru Ward Wars rankings by resolution rate, average fix hours, and colony CivicPoints.",
};

export default function LeaderboardPage() {
  return <WardWarsClient />;
}
