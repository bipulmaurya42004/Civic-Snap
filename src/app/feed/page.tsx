import type { Metadata } from "next";
import { BengaluruFeedClient } from "@/components/feed/BengaluruFeedClient";

export const metadata: Metadata = {
  title: "Explore Public Civic Reports",
  description:
    "Browse active Bengaluru civic reports across Indiranagar, Koramangala, HSR Layout, Whitefield, Jayanagar, and Malleshwaram with High Priority Zone tags and AI engineering audits.",
};

export default function FeedPage() {
  return <BengaluruFeedClient />;
}
