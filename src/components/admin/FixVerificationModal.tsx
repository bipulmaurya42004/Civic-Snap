"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import {
  evaluateVerificationOutcome,
  isSafeDisplayImageUrl,
} from "@/lib/ai-civic-helpers";
import {
  getCategoryLabel,
  POINTS_PER_RESOLVED_REPORT,
  validatePhotoFileMeta,
} from "@/lib/civic-logic";
import {
  fileToCompactBase64,
  uploadCivicPhotoToStorage,
} from "@/lib/client-image-utils";
import {
  moderateReportAsAdmin,
  type StoredPrivateReport,
} from "@/lib/firebase-reports";
import type { FixVerificationResponse } from "@/types/civic";

interface FixVerificationModalProps {
  report: StoredPrivateReport;
  adminUser: User;
  initialNote?: string;
  onClose: () => void;
  onCompleted: (summary: {
    reportId: string;
    verdict: "Verified" | "Flagged";
    reason: string;
    pointsDelta: number;
    pointsAwarded: number;
  }) => void;
}

export function FixVerificationModal({
  report,
  adminUser,
  initialNote = "",
  onClose,
  onCompleted,
}: FixVerificationModalProps) {
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [afterPreviewUrl, setAfterPreviewUrl] = useState<string | null>(null);
  const [optionalBeforeFile, setOptionalBeforeFile] = useState<File | null>(null);
  const [optionalBeforePreviewUrl, setOptionalBeforePreviewUrl] = useState<
    string | null
  >(null);
  const [auditNote, setAuditNote] = useState(initialNote);
  const [stageMessage, setStageMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<{
    verdict: "Verified" | "Flagged";
    reason: string;
    demoMode: boolean;
    notice?: string;
    pointsDelta: number;
    pointsAwarded: number;
  } | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !working) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, working]);

  useEffect(() => {
    return () => {
      if (afterPreviewUrl) URL.revokeObjectURL(afterPreviewUrl);
      if (optionalBeforePreviewUrl) URL.revokeObjectURL(optionalBeforePreviewUrl);
    };
  }, [afterPreviewUrl, optionalBeforePreviewUrl]);

  const handleAfterFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const check = validatePhotoFileMeta({
      type: file.type,
      size: file.size,
      name: file.name,
    });
    if (!check.valid) {
      setError(check.error ?? "Invalid image file.");
      event.target.value = "";
      return;
    }
    if (afterPreviewUrl) URL.revokeObjectURL(afterPreviewUrl);
    setError(null);
    setVerificationResult(null);
    setAfterFile(file);
    setAfterPreviewUrl(URL.createObjectURL(file));
  };

  const handleOptionalBeforeFileChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const check = validatePhotoFileMeta({
      type: file.type,
      size: file.size,
      name: file.name,
    });
    if (!check.valid) {
      setError(check.error ?? "Invalid Before image file.");
      event.target.value = "";
      return;
    }
    if (optionalBeforePreviewUrl) URL.revokeObjectURL(optionalBeforePreviewUrl);
    setError(null);
    setOptionalBeforeFile(file);
    setOptionalBeforePreviewUrl(URL.createObjectURL(file));
  };

  const handleVerifyAndSave = async () => {
    if (!afterFile) {
      setError("Please upload the Proof of Fix (After Photo) first.");
      return;
    }

    setWorking(true);
    setError(null);
    setStorageWarning(null);
    setVerificationResult(null);

    try {
      // Step 1: Upload After photo (and optional Before photo if missing)
      setStageMessage("Uploading Proof of Fix photo securely...");
      const afterUpload = await uploadCivicPhotoToStorage(
        afterFile,
        `proof-of-fix/${report.id}`
      );

      let uploadedBeforeUrl = report.beforeImageURL;
      if (!uploadedBeforeUrl && optionalBeforeFile) {
        const beforeUpload = await uploadCivicPhotoToStorage(
          optionalBeforeFile,
          `reports/${report.reporterId}/${report.id}`
        );
        if (beforeUpload.url && isSafeDisplayImageUrl(beforeUpload.url)) {
          uploadedBeforeUrl = beforeUpload.url;
        }
      }

      if (!afterUpload.url) {
        setStorageWarning(
          `Cloud photo archive did not return a URL (${afterUpload.error ?? "check upload permissions"}). CivicSnap Vision AI verification will still run on your selected photo.`
        );
      }

      // Step 2: Prepare compact base64 payloads & call CivicSnap Vision AI route
      setStageMessage("Comparing Before vs After photos with CivicSnap Vision AI...");
      const afterInline = await fileToCompactBase64(afterFile);
      const beforeInline = optionalBeforeFile
        ? await fileToCompactBase64(optionalBeforeFile)
        : undefined;

      const geminiBody: Record<string, unknown> = {
        action: "verify_fix",
        reportTitle: report.title,
        category: getCategoryLabel(report.category),
        locality: report.locality,
        afterImage: afterInline,
      };

      if (beforeInline) {
        geminiBody.beforeImage = beforeInline;
      } else if (uploadedBeforeUrl && isSafeDisplayImageUrl(uploadedBeforeUrl)) {
        geminiBody.beforeImageUrl = uploadedBeforeUrl;
      }

      const aiRes = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      });

      const aiData = (await aiRes.json()) as Partial<FixVerificationResponse> & {
        error?: string;
      };

      if (!aiRes.ok || !aiData.verdict || !aiData.reason) {
        throw new Error(
          aiData.error || "CivicSnap Vision AI verification could not complete."
        );
      }

      // Step 3: Apply Verdict to Firestore (Verified -> Resolved +25 pts; Flagged -> In Progress)
      setStageMessage(
        aiData.verdict === "Verified"
          ? "AI Verified! Updating report to Resolved and crediting +25 CivicPoints..."
          : "AI Flagged! Keeping report In Progress and recording verification note..."
      );

      const outcome = evaluateVerificationOutcome(
        aiData.verdict,
        report.reviewState
      );

      const combinedNote = [
        auditNote.trim(),
        `AI Verification (${aiData.verdict}): ${aiData.reason}`,
      ]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 400);

      const modResult = await moderateReportAsAdmin(adminUser, report, {
        status: outcome.status,
        reviewState: outcome.reviewState,
        publicApproved: outcome.publicApproved,
        note: combinedNote,
        eventLabel:
          aiData.verdict === "Verified"
            ? "AI Fix Verified · Marked Resolved"
            : "AI Verification Flagged · Kept In Progress",
        beforeImageURL: uploadedBeforeUrl ?? null,
        afterImageURL: afterUpload.url ?? null,
        verificationStatus: outcome.verificationStatus,
        verificationReason: aiData.reason,
      });

      setVerificationResult({
        verdict: aiData.verdict,
        reason: aiData.reason,
        demoMode: Boolean(aiData.demoMode),
        notice: aiData.notice,
        pointsDelta: modResult.pointsDelta,
        pointsAwarded: modResult.pointsAwarded,
      });

      onCompleted({
        reportId: report.id,
        verdict: aiData.verdict,
        reason: aiData.reason,
        pointsDelta: modResult.pointsDelta,
        pointsAwarded: modResult.pointsAwarded,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not complete AI Before-vs-After verification."
      );
    } finally {
      setWorking(false);
      setStageMessage(null);
    }
  };

  const hasStoredBefore = Boolean(
    report.beforeImageURL && isSafeDisplayImageUrl(report.beforeImageURL)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[1px]"
      onClick={(e) => {
        if (e.target === e.currentTarget && !working) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fix-verification-modal-title"
        className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-[22px] border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2563EB]">
              <Sparkles size={14} aria-hidden="true" />
              AI Before-vs-After Fix Verification
            </p>
            <h2
              id="fix-verification-modal-title"
              className="mt-1 font-[var(--font-heading)] text-xl font-bold text-slate-900"
            >
              Upload Proof of Fix
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              <span className="font-mono font-semibold text-slate-800">
                {report.id}
              </span>{" "}
              · {report.title} ({getCategoryLabel(report.category)})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={working}
            aria-label="Close proof of fix modal"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Before vs After Image Slots */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {/* BEFORE photo */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              1. Before (Original Issue)
            </p>
            {hasStoredBefore ? (
              <div className="mt-2.5 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                <img
                  src={report.beforeImageURL}
                  alt={`Original civic issue for ${report.id}`}
                  referrerPolicy="no-referrer"
                  className="h-44 w-full object-cover"
                />
              </div>
            ) : optionalBeforePreviewUrl ? (
              <div className="mt-2.5 space-y-2">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                  <img
                    src={optionalBeforePreviewUrl}
                    alt="Reference Before photo"
                    className="h-44 w-full object-cover"
                  />
                </div>
                <p className="text-[11px] text-slate-600">
                  Reference Before photo attached for comparison.
                </p>
              </div>
            ) : (
              <div className="mt-2.5 flex h-44 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center">
                <Camera size={20} className="text-slate-400" aria-hidden="true" />
                <p className="mt-2 text-xs font-medium text-slate-700">
                  No stored Before photo URL
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Optionally attach the original issue photo for side-by-side AI
                  comparison.
                </p>
                <label className="mt-2.5 inline-flex min-h-[32px] cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100">
                  <Upload size={12} aria-hidden="true" />
                  <span>Attach Before Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleOptionalBeforeFileChange}
                    disabled={working}
                    className="sr-only"
                  />
                </label>
              </div>
            )}
          </div>

          {/* AFTER photo */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#2563EB]">
              2. After (Proof of Fix) *
            </p>
            {afterPreviewUrl ? (
              <div className="mt-2.5 space-y-2">
                <div className="overflow-hidden rounded-xl border border-blue-200 bg-slate-100">
                  <img
                    src={afterPreviewUrl}
                    alt="Uploaded proof of fix preview"
                    className="h-44 w-full object-cover"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] text-slate-600">
                    {afterFile?.name}
                  </span>
                  <label className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-[#2563EB] hover:underline">
                    <span>Change</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAfterFileChange}
                      disabled={working}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="mt-2.5 flex h-44 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-blue-300 bg-white p-4 text-center transition-colors hover:border-[#2563EB] hover:bg-blue-50/30">
                <Upload size={22} className="text-[#2563EB]" aria-hidden="true" />
                <span className="mt-2 text-xs font-semibold text-slate-900">
                  Upload After Photo
                </span>
                <span className="mt-0.5 text-[11px] text-slate-500">
                  JPEG, PNG, WebP, HEIC, or AVIF · Encrypted CivicSnap cloud archive
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAfterFileChange}
                  disabled={working}
                  className="sr-only"
                />
              </label>
            )}
          </div>
        </div>

        {/* Audit Note */}
        <div className="mt-4">
          <label
            htmlFor="fix-verification-audit-note"
            className="mb-1.5 block text-xs font-semibold text-slate-700"
          >
            Optional admin resolution note
          </label>
          <input
            id="fix-verification-audit-note"
            type="text"
            maxLength={200}
            value={auditNote}
            onChange={(e) => setAuditNote(e.target.value)}
            disabled={working}
            placeholder="e.g., Road patching crew finished resurfacing this morning"
            className="min-h-[40px] w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-900 placeholder:text-slate-400"
          />
        </div>

        {/* Rule reminder */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs leading-5 text-slate-600">
          <strong className="font-semibold text-slate-900">
            Automated Verification Rule:
          </strong>{" "}
          If CivicSnap Vision AI returns <strong className="text-emerald-700">Verified</strong>,
          status updates to <strong>Resolved</strong> and awards{" "}
          <strong>+{POINTS_PER_RESOLVED_REPORT} CivicPoints</strong> to the
          reporter. If <strong className="text-amber-700">Flagged</strong>, the
          report stays <strong>In Progress</strong> for follow-up.
        </div>

        {stageMessage && (
          <div
            role="status"
            className="mt-4 flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs font-medium text-blue-900"
          >
            <Loader2 size={15} className="shrink-0 animate-spin" aria-hidden="true" />
            <span>{stageMessage}</span>
          </div>
        )}

        {storageWarning && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
            {storageWarning}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700"
          >
            {error}
          </p>
        )}

        {/* Verification Verdict Result */}
        {verificationResult && (
          <div
            role="status"
            className={`mt-4 rounded-2xl border p-4 ${
              verificationResult.verdict === "Verified"
                ? "border-emerald-200 bg-emerald-50/80"
                : "border-amber-300 bg-amber-50/90"
            }`}
          >
            <div className="flex items-start gap-3">
              {verificationResult.verdict === "Verified" ? (
                <CheckCircle2
                  size={20}
                  className="mt-0.5 shrink-0 text-emerald-600"
                  aria-hidden="true"
                />
              ) : (
                <AlertTriangle
                  size={20}
                  className="mt-0.5 shrink-0 text-amber-600"
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-bold ${
                    verificationResult.verdict === "Verified"
                      ? "text-emerald-900"
                      : "text-amber-950"
                  }`}
                >
                  AI Verdict: {verificationResult.verdict}{" "}
                  {verificationResult.verdict === "Verified"
                    ? "— Report Marked Resolved"
                    : "— Report Kept In Progress"}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-700">
                  {verificationResult.reason}
                </p>
                {verificationResult.verdict === "Verified" ? (
                  <p className="mt-2 text-xs font-semibold text-emerald-800">
                    {verificationResult.pointsDelta > 0
                      ? `+${verificationResult.pointsDelta} CivicPoints credited (${verificationResult.pointsAwarded} pts total for this report).`
                      : `${verificationResult.pointsAwarded} CivicPoints credited for this report.`}
                  </p>
                ) : (
                  <p className="mt-2 text-xs font-semibold text-amber-900">
                    Resolution bonus was withheld. Upload a clearer or updated
                    repair photo to re-verify.
                  </p>
                )}
                {verificationResult.demoMode && verificationResult.notice && (
                  <p className="mt-2 text-[11px] text-slate-600">
                    {verificationResult.notice}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/issues/${encodeURIComponent(report.id)}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline"
                  >
                    <span>View Public Timeline Comparison</span>
                    <ExternalLink size={12} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Controls */}
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={working}
            className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {verificationResult ? "Done" : "Cancel"}
          </button>

          {(!verificationResult || verificationResult.verdict === "Flagged") && (
            <button
              type="button"
              onClick={() => void handleVerifyAndSave()}
              disabled={working || !afterFile}
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-[#2563EB] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {working ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <ShieldCheck size={14} aria-hidden="true" />
              )}
              <span>
                {working
                  ? "Verifying with AI..."
                  : verificationResult?.verdict === "Flagged"
                    ? "Re-Verify New Photo"
                    : "Upload & Run AI Verification"}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
