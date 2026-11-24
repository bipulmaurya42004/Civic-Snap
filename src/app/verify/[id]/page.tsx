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
    title: `Verify Civic Credential ${decoded}`,
    description:
      "Public tamper-proof verification portal for official 2026 Bengaluru Urban Governance Summit Civic Merit Certificates issued via CivicSnap AI Audit.",
  };
}

export default async function VerifyCertificatePage({
  params,
}: VerifyPageProps) {
  const { id } = await params;
  return <CertificateVerifyClient certificateId={id} />;
}
