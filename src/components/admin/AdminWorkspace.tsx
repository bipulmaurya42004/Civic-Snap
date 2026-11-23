"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  ImageOff,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
} from "lucide-react";
import { useFirebaseAuth } from "@/components/providers/FirebaseAuthProvider";
import { FixVerificationModal } from "@/components/admin/FixVerificationModal";
import { EngineeringInsightsCard } from "@/components/issues/EngineeringInsightsCard";
import {
  fetchAllReportsForAdmin,
  moderateReportAsAdmin,
  type StoredPrivateReport,
} from "@/lib/firebase-reports";
import {
  computeAdminReportStats,
  formatCivicDate,
  getCategoryLabel,
  POINTS_PER_ACCEPTED_REPORT,
  POINTS_PER_RESOLVED_REPORT,
} from "@/lib/civic-logic";
import { isSafeDisplayImageUrl } from "@/lib/ai-civic-helpers";
import {
  buildGoogleMapsUrl,
  detectHighPriorityZone,
  getBengaluruWardAnchor,
} from "@/lib/location-helpers";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { EmptyState, LoadingState } from "@/components/ui/StateViews";
import type { IssueStatus, ReviewState } from "@/types/civic";

export function AdminWorkspace() {
  const { user, isAdmin, authReady } = useFirebaseAuth();
  const [reports, setReports] = useState<StoredPrivateReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [verifyingReport, setVerifyingReport] =
    useState<StoredPrivateReport | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchAllReportsForAdmin();
      setReports(items);
    } catch {
      setError(
        "Could not load incoming civic reports right now. Please verify your authorised staff account permissions."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authReady && user && isAdmin) {
      void loadReports();
    }
  }, [authReady, user, isAdmin, loadReports]);

  const stats = useMemo(() => computeAdminReportStats(reports), [reports]);

  const handleAction = async (
    report: StoredPrivateReport,
    next: {
      status: IssueStatus;
      reviewState: ReviewState;
      publicApproved: boolean;
      defaultNote: string;
      actionLabel: string;
    }
  ) => {
    if (!user) return;
    setActiveId(report.id);
    setError(null);
    setFeedback(null);
    try {
      const customNote = (noteById[report.id] ?? "").trim();
      const result = await moderateReportAsAdmin(user, report, {
        status: next.status,
        reviewState: next.reviewState,
        publicApproved: next.publicApproved,
        note: customNote.length >= 2 ? customNote : next.defaultNote,
      });

      const deltaSummary =
        result.pointsDelta > 0
          ? ` (+${result.pointsDelta} CivicPoints credited to reporter, total ${result.pointsAwarded} pts for this report)`
          : result.pointsDelta < 0
            ? ` (${result.pointsDelta} CivicPoints reconciled)`
            : ` (${result.pointsAwarded} CivicPoints already credited)`;

      setFeedback(`${next.actionLabel} for ${report.id}.${deltaSummary}`);
      await loadReports();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save moderation update."
      );
    } finally {
      setActiveId(null);
    }
  };

  if (!authReady) {
    return (
      <LoadingState
        label="Verifying CivicSnap staff session..."
        rows={3}
      />
    );
  }

  if (!user || !isAdmin) {
    return (
      <section
        aria-label="Admin access denied"
        className="mt-6 rounded-[20px] border border-red-200 bg-white p-6 sm:p-8"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <ShieldAlert size={22} aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-red-600">
              Access Denied
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {user
                ? "Access Denied — Authorised CivicSnap Admin Required"
                : "Access Denied — Sign In With an Authorised Admin Account"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {user ? (
                <>
                  You are currently signed in as{" "}
                  <strong className="font-semibold text-slate-900">
                    {user.email}
                  </strong>
                  , which is not authorized for the CivicSnap Admin Dashboard.
                  Only verified project admin accounts are permitted to review
                  reports or award CivicPoints.
                </>
              ) : (
                <>
                  This Civic Management Operations Console is restricted strictly to
                  verified CivicSnap staff administrators. Please sign in with an
                  authorised staff account to continue.
                </>
              )}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {!user ? (
                <Link
                  href="/login?next=%2Fadmin"
                  className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8] whitespace-nowrap"
                >
                  Admin Sign In
                </Link>
              ) : (
                <Link
                  href="/profile"
                  className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8] whitespace-nowrap"
                >
                  Return to My Profile
                </Link>
              )}
              <Link
                href="/"
                className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6 space-y-6">
      {/* Verified Admin Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-emerald-900">
          <ShieldCheck size={17} aria-hidden="true" />
          <span>
            Verified CivicSnap Admin:{" "}
            <strong className="font-semibold">{user.email}</strong>
          </span>
        </div>
        <button
          type="button"
          onClick={() => void loadReports()}
          disabled={loading}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          <RefreshCw
            size={13}
            className={loading ? "animate-spin" : ""}
            aria-hidden="true"
          />
          <span>Refresh Reports</span>
        </button>
      </div>

      {/* KPI Stats Row: Total Reports, Pending, Resolved */}
      <div
        aria-label="Admin report statistics"
        className="grid gap-4 sm:grid-cols-3"
      >
        <div className="rounded-[18px] border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total Reports
            </p>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
              <FileText size={16} aria-hidden="true" />
            </span>
          </div>
          <p className="mt-3 font-mono text-3xl font-bold tabular-nums text-slate-900">
            {stats.total}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            All live civic reports submitted by residents
          </p>
        </div>

        <div className="rounded-[18px] border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Pending
            </p>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Clock size={16} aria-hidden="true" />
            </span>
          </div>
          <p className="mt-3 font-mono text-3xl font-bold tabular-nums text-amber-700">
            {stats.pending}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {stats.inProgress > 0
              ? `Plus ${stats.inProgress} currently in progress`
              : "Awaiting moderation or active follow-up"}
          </p>
        </div>

        <div className="rounded-[18px] border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Resolved
            </p>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <CheckCircle2 size={16} aria-hidden="true" />
            </span>
          </div>
          <p className="mt-3 font-mono text-3xl font-bold tabular-nums text-emerald-700">
            {stats.resolved}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Verified closed reports (+{POINTS_PER_RESOLVED_REPORT} pts each)
          </p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {feedback && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {feedback}
        </p>
      )}

      {/* Management Table */}
      {loading ? (
        <LoadingState label="Loading incoming live civic reports..." rows={3} />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck size={20} aria-hidden="true" />}
          title="No submitted reports yet"
          description="Reports submitted via /report will appear in this management table so you can accept them (+10 CivicPoints) or mark them resolved (+25 CivicPoints)."
          primaryAction={{ label: "Submit a Test Report", href: "/report" }}
        />
      ) : (
        <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/70 px-5 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Report Management Queue
              </h2>
              <p className="text-xs text-slate-500">
                Accept Report awards +{POINTS_PER_ACCEPTED_REPORT} CivicPoints ·
                Mark Resolved awards +{POINTS_PER_RESOLVED_REPORT} CivicPoints
                total
              </p>
            </div>
            <span className="font-mono text-xs font-semibold text-slate-600">
              {reports.length} {reports.length === 1 ? "report" : "reports"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60 text-xs font-semibold text-slate-600">
                  <th scope="col" className="px-4 py-3">
                    Photo
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Report &amp; Location
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Category
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Engineering Insights
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status &amp; Points
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Admin Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 align-top">
                {reports.map((report) => {
                  const isWorking = activeId === report.id;
                  const alreadyAccepted = report.reviewState === "accepted";
                  const alreadyResolved =
                    alreadyAccepted && report.status === "resolved";
                  const photoLabel = report.photoStoragePath
                    ? report.photoStoragePath.split("/").pop()
                    : null;
                  const wardAnchor = getBengaluruWardAnchor(report.locality);
                  const mapUrl = buildGoogleMapsUrl(
                    report.privateLat ?? wardAnchor?.lat,
                    report.privateLng ?? wardAnchor?.lng
                  );
                  const priorityZone = detectHighPriorityZone({
                    title: report.title,
                    description: report.description,
                    locality: report.locality,
                    detectedAddress: report.detectedAddress,
                    surroundingLandmarks: report.surroundingLandmarks,
                    lat: report.privateLat,
                    lng: report.privateLng,
                    explicitFlag: report.highPriorityZone,
                  });

                  return (
                    <tr
                      key={report.id}
                      className="transition-colors hover:bg-slate-50/50"
                    >
                      {/* Photo Column */}
                      <td className="px-4 py-4">
                        {report.beforeImageURL &&
                        isSafeDisplayImageUrl(report.beforeImageURL) ? (
                          <div className="space-y-1.5">
                            <img
                              src={report.beforeImageURL}
                              alt={`Before photo for ${report.id}`}
                              referrerPolicy="no-referrer"
                              className="h-16 w-20 rounded-xl border border-slate-200 object-cover"
                            />
                            {report.afterImageURL &&
                              isSafeDisplayImageUrl(report.afterImageURL) && (
                                <span className="block text-center text-[10px] font-semibold text-emerald-700">
                                  + After proof
                                </span>
                              )}
                          </div>
                        ) : report.hasPhoto ? (
                          <div className="flex h-16 w-20 flex-col items-center justify-center rounded-xl border border-blue-200 bg-blue-50/70 px-1.5 text-center text-[#2563EB]">
                            <Camera size={18} aria-hidden="true" />
                            <span className="mt-1 line-clamp-1 max-w-full font-mono text-[10px] font-medium text-slate-700">
                              {photoLabel || "Photo attached"}
                            </span>
                          </div>
                        ) : (
                          <div className="flex h-16 w-20 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-1.5 text-center text-slate-400">
                            <ImageOff size={16} aria-hidden="true" />
                            <span className="mt-1 text-[10px]">No photo</span>
                          </div>
                        )}
                      </td>

                      {/* Report & Location Column */}
                      <td className="max-w-xs px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-slate-500">
                            {report.id}
                          </span>
                          <span className="text-xs text-slate-400">·</span>
                          <span className="text-xs text-slate-500">
                            {formatCivicDate(report.createdAtIso)}
                          </span>
                        </div>
                        {priorityZone.isHighPriority && (
                          <div className="mt-1.5">
                            <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                              <Siren size={11} aria-hidden="true" />
                              <span>High Priority Zone</span>
                            </span>
                          </div>
                        )}
                        <p className="mt-1 font-semibold text-slate-900">
                          {report.title}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
                          {report.description}
                        </p>
                        <div className="mt-2 space-y-1.5">
                          <p className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                            <MapPin
                              size={12}
                              className="shrink-0 text-[#2563EB]"
                              aria-hidden="true"
                            />
                            <span>
                              {report.locality}
                              {report.detectedAddress
                                ? ` · ${report.detectedAddress}`
                                : ""}
                            </span>
                          </p>
                          <div className="flex flex-wrap items-center gap-2.5">
                            {mapUrl && (
                              <a
                                href={mapUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50/70 px-2 py-1 text-[11px] font-semibold text-[#2563EB] transition-colors hover:bg-blue-100/70 whitespace-nowrap"
                              >
                                <MapPin size={11} aria-hidden="true" />
                                <span>View on Google Maps</span>
                                <ExternalLink size={10} aria-hidden="true" />
                              </a>
                            )}
                            {report.publicApproved && (
                              <Link
                                href={`/issues/${encodeURIComponent(report.id)}`}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline"
                              >
                                <span>Public timeline</span>
                                <ExternalLink size={11} aria-hidden="true" />
                              </Link>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category Column */}
                      <td className="whitespace-nowrap px-4 py-4">
                        <span className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {getCategoryLabel(report.category)}
                        </span>
                      </td>

                      {/* Engineering Insights Column */}
                      <td className="px-4 py-4">
                        {report.surroundingLandmarks ||
                        report.materialEstimate ||
                        typeof report.socialImpactScore === "number" ||
                        report.economicCostOfDelay ? (
                          <EngineeringInsightsCard
                            variant="compact"
                            surroundingLandmarks={report.surroundingLandmarks}
                            materialEstimate={report.materialEstimate}
                            socialImpactScore={report.socialImpactScore}
                            economicCostOfDelay={report.economicCostOfDelay}
                          />
                        ) : (
                          <span className="text-xs text-slate-400">
                            No AI audit attached
                          </span>
                        )}
                      </td>

                      {/* Status & Points Column */}
                      <td className="whitespace-nowrap px-4 py-4">
                        <div className="space-y-2">
                          <StatusIndicator status={report.status} size="sm" />
                          <div className="text-xs text-slate-600 capitalize">
                            Review:{" "}
                            <strong className="font-semibold text-slate-800">
                              {report.reviewState}
                            </strong>
                          </div>
                          {report.verificationStatus === "verified" && (
                            <div className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                              <CheckCircle2 size={11} aria-hidden="true" />
                              <span>AI Verified Fix</span>
                            </div>
                          )}
                          {report.verificationStatus === "flagged" && (
                            <div className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                              <AlertTriangle size={11} aria-hidden="true" />
                              <span>AI Flagged</span>
                            </div>
                          )}
                          <div className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-0.5 font-mono text-xs font-semibold text-[#2563EB]">
                            <Sparkles size={11} aria-hidden="true" />
                            <span>{report.pointsAwarded} pts awarded</span>
                          </div>
                        </div>
                      </td>

                      {/* Admin Actions Column */}
                      <td className="min-w-[240px] px-4 py-4">
                        <div className="space-y-2.5">
                          <input
                            type="text"
                            value={noteById[report.id] ?? ""}
                            onChange={(e) =>
                              setNoteById((prev) => ({
                                ...prev,
                                [report.id]: e.target.value,
                              }))
                            }
                            placeholder="Optional audit note"
                            aria-label={`Audit note for ${report.id}`}
                            className="min-h-[34px] w-full rounded-lg border border-slate-200 px-2.5 text-xs text-slate-900 placeholder:text-slate-400"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={isWorking || alreadyAccepted}
                              onClick={() =>
                                void handleAction(report, {
                                  status:
                                    report.status === "resolved"
                                      ? "resolved"
                                      : "pending",
                                  reviewState: "accepted",
                                  publicApproved: true,
                                  defaultNote:
                                    "Report accepted by CivicSnap admin (+10 CivicPoints).",
                                  actionLabel: "Accepted report",
                                })
                              }
                              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[#2563EB] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isWorking && (
                                <Loader2
                                  size={13}
                                  className="animate-spin"
                                  aria-hidden="true"
                                />
                              )}
                              <span>
                                {alreadyAccepted
                                  ? "Accepted"
                                  : `Accept Report (+${POINTS_PER_ACCEPTED_REPORT} pts)`}
                              </span>
                            </button>

                            <button
                              type="button"
                              disabled={isWorking || alreadyResolved}
                              onClick={() => {
                                setError(null);
                                setVerifyingReport(report);
                              }}
                              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <ShieldCheck size={13} aria-hidden="true" />
                              <span>
                                {alreadyResolved
                                  ? "Resolved"
                                  : `Mark Resolved (+${POINTS_PER_RESOLVED_REPORT} pts)`}
                              </span>
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {verifyingReport && user && (
        <FixVerificationModal
          report={verifyingReport}
          adminUser={user}
          initialNote={noteById[verifyingReport.id] ?? ""}
          onClose={() => setVerifyingReport(null)}
          onCompleted={(summary) => {
            if (summary.verdict === "Verified") {
              setFeedback(
                `AI Verified fix for ${summary.reportId} — automatically marked Resolved (+${summary.pointsDelta} CivicPoints credited, total ${summary.pointsAwarded} pts). Reason: ${summary.reason}`
              );
            } else {
              setFeedback(
                `AI Flagged proof of fix for ${summary.reportId} — kept status as In Progress. Reason: ${summary.reason}`
              );
            }
            void loadReports();
          }}
        />
      )}
    </section>
  );
}
