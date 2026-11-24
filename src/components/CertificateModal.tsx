"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  Award,
  Check,
  Copy,
  Download,
  ExternalLink,
  Printer,
  ShieldCheck,
  X,
} from "lucide-react";
import { generateQrMatrix } from "@/lib/bengaluru-feed-data";
import {
  ANNUAL_CM_SUMMIT_TITLE,
  buildCertificateHtmlDocument,
  buildCertificateVerifyUrl,
  buildLinkedInAddCertificationUrl,
  buildLinkedInShareText,
} from "@/lib/civic-honors";
import { useFirebaseAuth } from "@/components/providers/FirebaseAuthProvider";
import { useAuthModal } from "@/components/AuthModal";
import type { CivicCertificateData } from "@/types/civic";

interface CertificateModalProps {
  certificate: CivicCertificateData | null;
  isSamplePreview?: boolean;
  onClose: () => void;
}

export function CertificateModal({
  certificate,
  isSamplePreview = false,
  onClose,
}: CertificateModalProps) {
  const { user } = useFirebaseAuth();
  const { openAuthModal } = useAuthModal();
  const [downloadedNotice, setDownloadedNotice] = useState(false);
  const [copiedShareText, setCopiedShareText] = useState(false);

  useEffect(() => {
    if (!certificate) return;
    setDownloadedNotice(false);
    setCopiedShareText(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [certificate, onClose]);

  const verifyUrl = useMemo(
    () =>
      certificate ? buildCertificateVerifyUrl(certificate.certificateId) : "",
    [certificate]
  );

  const qrMatrix = useMemo(
    () => (certificate ? generateQrMatrix(verifyUrl) : []),
    [certificate, verifyUrl]
  );

  const handleDownloadCertificate = () => {
    if (!certificate) return;
    if (!user) {
      onClose();
      openAuthModal({
        title: "Sign in to Download Official Certificate",
        message:
          "Sign in with Google to verify your identity, track your 2026 verified reports, and download your personalized Bengaluru Urban Merit Certificate.",
        redirectTo: "/rewards",
      });
      return;
    }
    const html = buildCertificateHtmlDocument(certificate);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${certificate.certificateId}-Civic-Merit-Certificate.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloadedNotice(true);
    setTimeout(() => setDownloadedNotice(false), 3200);
  };

  const handlePrintCertificate = () => {
    if (!user) {
      onClose();
      openAuthModal({
        title: "Sign in to Print Official Certificate",
        message:
          "Sign in with Google to print or export your official 2026 Certificate of Civic Merit.",
        redirectTo: "/rewards",
      });
      return;
    }
    if (typeof window !== "undefined" && typeof window.print === "function") {
      window.print();
    }
  };

  const handleCopyShareText = async () => {
    if (!certificate) return;
    try {
      await navigator.clipboard.writeText(buildLinkedInShareText(certificate));
      setCopiedShareText(true);
      setTimeout(() => setCopiedShareText(false), 2600);
    } catch {
      // Clipboard may be restricted in some preview frames
    }
  };

  const showSampleBadge = isSamplePreview || !user;

  return (
    <AnimatePresence>
      {certificate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
          {/* Backdrop */}
          <motion.div
            key="cert-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 bg-slate-900/55 backdrop-blur-[2px]"
          />

          {/* Modal Dialog */}
          <motion.div
            key="cert-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="civic-certificate-modal-title"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-6"
          >
            {/* Top Utility Bar */}
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-amber-800">
                <Award
                  size={16}
                  className="text-amber-600"
                  aria-hidden="true"
                />
                <span>{ANNUAL_CM_SUMMIT_TITLE}</span>
                {showSampleBadge && (
                  <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
                    SAMPLE PREVIEW
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close certificate modal"
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>

            {/* Official Gold-Framed Certificate Canvas */}
            <div
              data-testid="certificate-canvas"
              className="rounded-2xl border-4 border-double border-amber-500/90 bg-gradient-to-b from-amber-50/35 via-white to-amber-50/25 p-3 sm:p-5"
            >
              <div className="rounded-xl border border-amber-300/70 bg-white px-5 py-7 text-center sm:px-10 sm:py-9">
                {/* Official Government / Collaborative Crest Header */}
                <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-3.5 py-1 text-[11px] font-bold tracking-wider text-blue-800 uppercase">
                  <ShieldCheck size={13} aria-hidden="true" />
                  <span>
                    GOVERNMENT OF KARNATAKA • {ANNUAL_CM_SUMMIT_TITLE}
                  </span>
                </div>

                <h2
                  id="civic-certificate-modal-title"
                  className="mt-5 font-[var(--font-heading)] text-2xl font-extrabold tracking-wide text-slate-900 sm:text-4xl"
                >
                  CERTIFICATE OF CIVIC MERIT
                </h2>

                <p className="mt-1.5 text-xs font-semibold tracking-wide text-amber-700">
                  {certificate.milestoneTitle}
                </p>

                <div
                  aria-hidden="true"
                  className="mx-auto my-5 h-px w-36 bg-gradient-to-r from-transparent via-amber-400 to-transparent"
                />

                <p className="text-sm font-medium text-slate-500">
                  This is proudly presented to
                </p>

                <p
                  data-testid="certificate-recipient-name"
                  className="mx-auto mt-2 inline-block border-b-2 border-amber-400 px-6 pb-1.5 font-[var(--font-heading)] text-2xl font-extrabold text-blue-900 sm:text-3xl"
                >
                  {certificate.recipientName}
                </p>

                <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-slate-700 sm:text-[15px]">
                  This is proudly presented to{" "}
                  <strong className="font-semibold text-slate-900">
                    {certificate.recipientName}
                  </strong>{" "}
                  in recognition of outstanding civic stewardship and verifying{" "}
                  <strong className="font-mono font-bold tabular-nums text-blue-700">
                    {certificate.verifiedFixes}
                  </strong>{" "}
                  public infrastructure fixes in Bengaluru Urban (
                  {certificate.ward}), validated through CivicSnap AI Audit in
                  2026.
                </p>

                {/* Bottom Row: Hash + QR | Embossed Gold Seal | Directorate Signature */}
                <div className="mt-8 grid items-end gap-5 border-t border-slate-200/90 pt-6 text-left sm:grid-cols-[1.35fr_auto_1fr]">
                  {/* Left: Unique Hash ID + Dynamic Date + Scannable QR Link */}
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/verify/${encodeURIComponent(certificate.certificateId)}`}
                      onClick={onClose}
                      title={`Verify credential at ${verifyUrl}`}
                      aria-label={`Open public verification page for ${certificate.certificateId}`}
                      className="grid shrink-0 grid-cols-9 gap-0.5 rounded-lg border border-slate-200 bg-white p-1.5 transition-colors hover:border-blue-400"
                    >
                      {qrMatrix.flatMap((row, rIdx) =>
                        row.map((filled, cIdx) => (
                          <span
                            key={`${rIdx}-${cIdx}`}
                            className={`h-1.5 w-1.5 rounded-[1px] ${
                              filled ? "bg-slate-900" : "bg-transparent"
                            }`}
                          />
                        ))
                      )}
                    </Link>
                    <div className="text-[11px] leading-5 text-slate-600">
                      <p className="font-semibold text-slate-500">
                        Certificate ID
                      </p>
                      <p
                        data-testid="certificate-hash-id"
                        className="whitespace-nowrap font-mono text-xs font-bold tabular-nums text-slate-900"
                      >
                        {certificate.certificateId}
                      </p>
                      <p className="mt-0.5 whitespace-nowrap text-slate-500">
                        Issued: {certificate.issuedDate}
                      </p>
                      <Link
                        href={`/verify/${encodeURIComponent(certificate.certificateId)}`}
                        onClick={onClose}
                        className="mt-0.5 inline-flex items-center gap-1 whitespace-nowrap font-semibold text-blue-600 hover:underline"
                      >
                        <span>Verify Credential</span>
                        <ExternalLink size={10} aria-hidden="true" />
                      </Link>
                    </div>
                  </div>

                  {/* Center: Gold Embossed Bengaluru Urban Governance Summit 2026 Seal */}
                  <div className="flex flex-col items-center justify-center">
                    <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full border-4 border-double border-amber-600 bg-gradient-to-br from-amber-100 via-amber-200 to-amber-400 p-2 text-center shadow-sm">
                      <ShieldCheck
                        size={18}
                        className="text-amber-900"
                        aria-hidden="true"
                      />
                      <span className="mt-1 text-[9px] font-extrabold leading-tight tracking-wider text-amber-950 uppercase">
                        Summit 2026
                      </span>
                      <span className="text-[8px] font-bold tracking-wide text-amber-900 uppercase">
                        AI Verified
                      </span>
                    </div>
                  </div>

                  {/* Right: Digital Signature of Urban Development Directorate */}
                  <div className="text-left sm:text-right">
                    <p className="font-serif text-lg italic font-semibold text-blue-900">
                      Urban Dev. Directorate
                    </p>
                    <div className="mt-1 h-px w-full bg-slate-300" />
                    <p className="mt-1.5 text-xs font-bold text-slate-900">
                      Urban Development Directorate
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {ANNUAL_CM_SUMMIT_TITLE}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Public Verification URL Strip */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 py-2 text-[11px] text-slate-600">
              <span className="truncate font-mono">
                Verification URL:{" "}
                <strong className="text-slate-800">{verifyUrl}</strong>
              </span>
              <Link
                href={`/verify/${encodeURIComponent(certificate.certificateId)}`}
                onClick={onClose}
                className="font-semibold text-blue-600 hover:underline whitespace-nowrap"
              >
                Open Public Verification Page →
              </Link>
            </div>

            {/* Action Buttons Row */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadCertificate}
                  className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95"
                >
                  {downloadedNotice ? (
                    <Check size={16} aria-hidden="true" />
                  ) : (
                    <Download size={16} aria-hidden="true" />
                  )}
                  <span>
                    {downloadedNotice
                      ? "Certificate Downloaded!"
                      : "Download Certificate (Print/PDF)"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintCertificate}
                  className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-100 active:scale-95"
                >
                  <Printer size={15} aria-hidden="true" />
                  <span>Print</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={buildLinkedInAddCertificationUrl(certificate)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition-all hover:bg-blue-100"
                >
                  <span>Add to LinkedIn</span>
                  <ExternalLink size={14} aria-hidden="true" />
                </a>

                <button
                  type="button"
                  onClick={() => void handleCopyShareText()}
                  className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-100"
                >
                  {copiedShareText ? (
                    <Check
                      size={14}
                      className="text-emerald-600"
                      aria-hidden="true"
                    />
                  ) : (
                    <Copy size={14} aria-hidden="true" />
                  )}
                  <span>
                    {copiedShareText ? "Copied Caption" : "Copy Post"}
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
