import type { Metadata } from "next";
import { getDemoIssueById } from "@/lib/demo-data";
import { IssueDetailClient } from "@/components/issues/IssueDetailClient";

interface IssueDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: IssueDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const demoIssue = getDemoIssueById(id);
  if (demoIssue) {
    return {
      title: `${demoIssue.id} · ${demoIssue.title}`,
      description: demoIssue.publicSummary,
    };
  }
  return {
    title: `Report ${id}`,
    description:
      "CivicSnap issue detail, Before-vs-After AI fix verification, and status timeline.",
  };
}

export default async function IssueDetailPage({
  params,
}: IssueDetailPageProps) {
  const { id } = await params;
  const demoIssue = getDemoIssueById(id) ?? null;

  return <IssueDetailClient reportId={id} initialDemoIssue={demoIssue} />;
}
