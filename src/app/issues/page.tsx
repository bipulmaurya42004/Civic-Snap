import type { Metadata } from "next";
import { BengaluruFeedClient } from "@/components/feed/BengaluruFeedClient";

export const metadata: Metadata = {
  title: "Explore Issues",
  description:
    "Filter live Bengaluru civic reports by ward, category, and status, with automatic High Priority Zone alerts near schools and hospitals.",
};

export default function IssuesPage() {
  return <BengaluruFeedClient />;
}
