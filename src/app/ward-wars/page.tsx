import type { Metadata } from "next";
import { WardWarsClient } from "@/components/leaderboard/WardWarsClient";

export const metadata: Metadata = {
  title: "Ward Wars Leaderboard",
  description:
    "Live Bengaluru Ward Wars leaderboard ranking Indiranagar, HSR Layout, Koramangala, Jayanagar, Malleshwaram, Whitefield, and MG Road by resolution rate and CivicPoints.",
};

export default function WardWarsPage() {
  return <WardWarsClient />;
}
