import type { Metadata } from "next";
import { CertificateVerifyClient } from "@/components/verify/CertificateVerifyClient";

interface VerifyPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: VerifyPageProps): Promise<Metadata> {
  const { id } = await params;
  const decoded = decodeURIComponent(id || "").toUpperCase();
  return {
    title: `Verify Independent Civic Record ${decoded}`,
    description:
      "CivicSnap AI — Independent Bengaluru Public Infrastructure Ledger & AI Audit Protocol. Public SHA-256 verification portal for Certificate of Civic Merit records issued by CivicSnap (Independent Prototype).",
  };
}

export default async function VerifyCertificatePage({
  params,
}: VerifyPageProps) {
  const { id } = await params;
  return <CertificateVerifyClient certificateId={id} />;
}
