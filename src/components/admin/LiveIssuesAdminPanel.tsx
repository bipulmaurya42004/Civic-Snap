"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  ImageOff,
  Loader2,
  Mail,
  MapPin,
  Navigation,
  Search,
  ShieldCheck,
  Sparkles,
  User,
  Wrench,
  XCircle,
} from "lucide-react";
import { useFirebaseAuth } from "@/components/providers/FirebaseAuthProvider";
import {
  ADMIN_DEFAULT_REJECTION_NOTE,
  ADMIN_POINTS_PER_RESOLVED_ISSUE,
  canAccessAdminDashboard,
  computeAdminIssuesKpis,
  formatGpsCoordinates,
  type AdminIssueStatus,
  type LiveAdminIssue,
  type ReporterIdentity,
} from "@/lib/admin-issues-logic";
import {
  approveAndResolveIssue,
  fetchReporterIdentitiesForAdmin,
  rejectIssueAsInvalid,
  subscribeToLiveIssues,
} from "@/lib/firebase-admin-issues";
import { formatCivicDate } from "@/lib/civic-logic";
import {
  buildGoogleMapsUrl,
  getBengaluruWardAnchor,
} from "@/lib/location-helpers";
import { LoadingState } from "@/components/ui/StateViews";

type StatusFilter = "all" | "pending" | "resolved" | "rejected";

function getStatusBadgeMeta(status: AdminIssueStatus): {
  label: string;
  className: string;
} {
  if (status === "Resolved") {
    return {
      label: "Resolved",
      className: "border-emerald-300 bg-emerald-50 text-emerald-800",
    };
  }
  if (status === "Rejected") {
    return {
      label: "Rejected",
      className: "border-rose-300 bg-rose-50 text-rose-800",
    };
  }
  if (status === "Under_AI_Verification") {
    return {
      label: "Under_AI_Verification",
      className: "border-blue-300 bg-blue-50 text-blue-800",
    };
  }
  return {
    label: "Reported",
    className: "border-amber-300 bg-amber-50 text-amber-800",
  };
}

export function LiveIssuesAdminPanel() {
  const { user } = useFirebaseAuth();

  const [issues, setIssues] = useState<LiveAdminIssue[]>([]);
  const [reporterMap, setReporterMap] = useState<
    Record<string, ReporterIdentity>
  >({});
  const fetchedUidsRef = useRef<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<{
    id: string;
    type: "approve" | "reject";
  } | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Optimistic local state overrides so UI badges respond instantaneously alongside onSnapshot
  const [optimisticOverrides, setOptimisticOverrides] = useState<
    Record<
      string,
      Partial<
        Pick<
          LiveAdminIssue,
          "status" | "adminVerified" | "adminActionBy" | "rejectionNote"
        >
      >
    >
  >({});

  const adminEmail = user?.email?.trim() ?? "";
  const isAuthorizedAdmin = Boolean(
    user && canAccessAdminDashboard({ userEmail: adminEmail })
  );

  useEffect(() => {
    if (!isAuthorizedAdmin) {
      setIssues([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setStreamError(null);

    const unsubscribe = subscribeToLiveIssues(
      (liveList) => {
        setIssues(liveList);
        setLoading(false);
        setStreamError(null);
      },
      (errMessage) => {
        setStreamError(errMessage);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isAuthorizedAdmin]);

  // Securely hydrate reporting citizens' name & email from private `users/{uid}` docs
  useEffect(() => {
    if (!isAuthorizedAdmin || issues.length === 0) {
      return;
    }

    const missingUids = Array.from(
      new Set(
        issues
          .map((item) => item.reportedByUid)
          .filter((uid) => uid.length > 0 && !fetchedUidsRef.current.has(uid))
      )
    );

    if (missingUids.length === 0) {
      return;
    }

    for (const uid of missingUids) {
      fetchedUidsRef.current.add(uid);
    }

    let cancelled = false;
    void fetchReporterIdentitiesForAdmin(missingUids).then((resolved) => {
      if (cancelled || Object.keys(resolved).length === 0) {
        return;
      }
      setReporterMap((prev) => ({ ...prev, ...resolved }));
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthorizedAdmin, issues]);

  const mergedIssues = useMemo(() => {
    return issues.map((item) => {
      const patch = optimisticOverrides[item.id];
      return patch ? { ...item, ...patch } : item;
    });
  }, [issues, optimisticOverrides]);

  const kpis = useMemo(
    () => computeAdminIssuesKpis(mergedIssues),
    [mergedIssues]
  );

  const filteredIssues = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return mergedIssues.filter((item) => {
      if (
        statusFilter === "pending" &&
        item.status !== "Reported" &&
        item.status !== "Under_AI_Verification"
      ) {
        return false;
      }
      if (statusFilter === "resolved" && item.status !== "Resolved") {
        return false;
      }
      if (statusFilter === "rejected" && item.status !== "Rejected") {
        return false;
      }
      if (!q) return true;
      const reporter = reporterMap[item.reportedByUid];
      return (
        item.id.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.ward.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (reporter?.name.toLowerCase().includes(q) ?? false) ||
        (reporter?.email?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [mergedIssues, statusFilter, searchQuery, reporterMap]);

  const handleApproveAndResolve = async (issue: LiveAdminIssue) => {
    if (busyAction?.id === issue.id) return;
    setActionError(null);
    setActionFeedback(null);

    if (!isAuthorizedAdmin || !adminEmail) {
      setActionError(
        "Authorized CivicSnap municipal admin sign-in is required to approve issues."
      );
      return;
    }

    setBusyAction({ id: issue.id, type: "approve" });
    setOptimisticOverrides((prev) => ({
      ...prev,
      [issue.id]: {
        status: "Resolved" as AdminIssueStatus,
        adminVerified: true,
        adminActionBy: adminEmail,
        rejectionNote: null,
      },
    }));

    try {
      const { pointsCredited } = await approveAndResolveIssue(
        issue,
        adminEmail
      );
      const reporter = reporterMap[issue.reportedByUid];
      const reporterLabel = reporter?.name || issue.reportedByUid;
      setActionFeedback(
        pointsCredited > 0
          ? `Approved & Marked Resolved (${issue.id}) by ${adminEmail} — atomically credited +${pointsCredited} points & +1 resolved fix to ${reporterLabel}.`
          : `Approved & Marked Resolved (${issue.id}) by ${adminEmail} in Firestore.`
      );
    } catch (err) {
      setOptimisticOverrides((prev) => {
        const copy = { ...prev };
        delete copy[issue.id];
        return copy;
      });
      setActionError(
        err instanceof Error
          ? err.message
          : "Could not approve and resolve this issue in Firestore."
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleRejectAsInvalid = async (issue: LiveAdminIssue) => {
    if (busyAction?.id === issue.id) return;
    setActionError(null);
    setActionFeedback(null);

    if (!isAuthorizedAdmin || !adminEmail) {
      setActionError(
        "Authorized CivicSnap municipal admin sign-in is required to reject issues."
      );
      return;
    }

    setBusyAction({ id: issue.id, type: "reject" });
    setOptimisticOverrides((prev) => ({
      ...prev,
      [issue.id]: {
        status: "Rejected" as AdminIssueStatus,
        adminVerified: false,
        adminActionBy: adminEmail,
        rejectionNote: ADMIN_DEFAULT_REJECTION_NOTE,
      },
    }));

    try {
      await rejectIssueAsInvalid(
        issue,
        adminEmail,
        ADMIN_DEFAULT_REJECTION_NOTE
      );
      setActionFeedback(
        `Rejected ${issue.id} by ${adminEmail} — Note saved: "${ADMIN_DEFAULT_REJECTION_NOTE}".`
      );
    } catch (err) {
      setOptimisticOverrides((prev) => {
        const copy = { ...prev };
        delete copy[issue.id];
        return copy;
      });
      setActionError(
        err instanceof Error
          ? err.message
          : "Could not reject this issue in Firestore."
      );
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="mt-6 space-y-6">
      {/* Authenticated Live Session Bar */}
      <section
        data-testid="admin-session-bar"
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/75 px-5 py-3.5 text-sm"
      >
        <div className="flex items-center gap-2.5 text-slate-800">
          <ShieldCheck
            size={18}
            className="shrink-0 text-emerald-700"
            aria-hidden="true"
          />
          <p>
            <strong className="font-semibold text-emerald-950">
              Authenticated Municipal Admin ({adminEmail})
            </strong>{" "}
            · Real-time Firestore audit stream active. Approving records{" "}
            <code className="rounded bg-emerald-100 px-1 py-0.5 font-mono text-xs text-emerald-900">
              adminActionBy
            </code>{" "}
            and credits +{ADMIN_POINTS_PER_RESOLVED_ISSUE} pts &amp; +1 resolved
            fix atomically.
          </p>
        </div>

        <Link
          href="/report"
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
        >
          <Camera size={14} aria-hidden="true" />
          <span>Log Live Issue</span>
        </Link>
      </section>

      {/* Live Firestore KPI Summary Strip */}
      <section
        aria-label="Live Firestore Issue Counts"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              All Reports
            </p>
            <FileText size={16} className="text-blue-600" aria-hidden="true" />
          </div>
          <p
            data-testid="admin-kpi-total"
            className="mt-2 font-mono text-3xl font-extrabold tabular-nums text-slate-900"
          >
            {kpis.total}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Ordered by createdAt desc
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Pending Review
            </p>
            <Clock size={16} className="text-amber-600" aria-hidden="true" />
          </div>
          <p
            data-testid="admin-kpi-pending"
            className="mt-2 font-mono text-3xl font-extrabold tabular-nums text-amber-700"
          >
            {kpis.pending}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Reported / Under AI Verification
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Resolved
            </p>
            <CheckCircle2
              size={16}
              className="text-emerald-600"
              aria-hidden="true"
            />
          </div>
          <p
            data-testid="admin-kpi-resolved"
            className="mt-2 font-mono text-3xl font-extrabold tabular-nums text-emerald-700"
          >
            {kpis.resolved}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            +{ADMIN_POINTS_PER_RESOLVED_ISSUE} pts &amp; +1 resolved count
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Rejected
            </p>
            <XCircle size={16} className="text-rose-600" aria-hidden="true" />
          </div>
          <p
            data-testid="admin-kpi-rejected"
            className="mt-2 font-mono text-3xl font-extrabold tabular-nums text-rose-700"
          >
            {kpis.rejected}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Marked invalid / spam (0 pts)
          </p>
        </div>
      </section>

      {/* Alerts & Action Notifications */}
      {streamError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{streamError}</span>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      {actionFeedback && (
        <div
          role="status"
          data-testid="admin-action-feedback"
          className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
        >
          <CheckCircle2
            size={16}
            className="mt-0.5 shrink-0 text-emerald-700"
            aria-hidden="true"
          />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Filter Tabs + Search */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center">
        <div
          role="tablist"
          aria-label="Filter reports by review status"
          className="inline-flex flex-wrap items-center gap-1.5"
        >
          {(
            [
              { key: "all", label: `All Reports (${kpis.total})` },
              { key: "pending", label: `Pending Review (${kpis.pending})` },
              { key: "resolved", label: `Resolved (${kpis.resolved})` },
              { key: "rejected", label: `Rejected (${kpis.rejected})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={statusFilter === tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`min-h-[36px] cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === tab.key
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200/70"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            aria-label="Search live Firestore reports"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ID, ward, citizen..."
            className="min-h-[38px] w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 sm:w-64"
          />
        </div>
      </div>

      {/* Real-Time Audit Feed */}
      {loading ? (
        <LoadingState
          label="Streaming live issues from Firestore (ordered by createdAt desc)..."
          rows={3}
        />
      ) : filteredIssues.length === 0 ? (
        <section
          data-testid="admin-empty-issues"
          className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-xs"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-blue-600">
            <ShieldCheck size={22} aria-hidden="true" />
          </div>
          <h2 className="mt-3 font-[var(--font-heading)] text-lg font-bold text-slate-900">
            {issues.length === 0
              ? "No civic reports submitted in Firestore yet."
              : "No reports match the selected filter."}
          </h2>
          <p className="mt-1.5 max-w-md text-xs leading-5 text-slate-600 sm:text-sm">
            {issues.length === 0
              ? "Citizen reports submitted via /report stream here in real time for municipal approval (+50 pts) or spam rejection."
              : "Clear the search bar or switch filter tabs to view all live Firestore reports."}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            {issues.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("all");
                  setSearchQuery("");
                }}
                className="inline-flex min-h-[40px] cursor-pointer items-center rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Show All Reports
              </button>
            ) : (
              <Link
                href="/report"
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                <Camera size={15} aria-hidden="true" />
                <span>Submit a Live Civic Issue</span>
              </Link>
            )}
          </div>
        </section>
      ) : (
        <div data-testid="live-issues-list" className="space-y-4">
          {filteredIssues.map((issue) => {
            const statusMeta = getStatusBadgeMeta(issue.status);
            const isApproving =
              busyAction?.id === issue.id && busyAction.type === "approve";
            const isRejecting =
              busyAction?.id === issue.id && busyAction.type === "reject";
            const isRowBusy = busyAction?.id === issue.id;
            const isAlreadyResolved =
              issue.status === "Resolved" && issue.adminVerified;
            const isAlreadyRejected = issue.status === "Rejected";

            const gpsText = formatGpsCoordinates(issue.lat, issue.lng);
            const anchor = getBengaluruWardAnchor(issue.ward);
            const mapsUrl =
              issue.lat !== null && issue.lng !== null
                ? buildGoogleMapsUrl(issue.lat, issue.lng)
                : anchor
                  ? buildGoogleMapsUrl(anchor.lat, anchor.lng)
                  : null;

            const reporter = reporterMap[issue.reportedByUid];

            return (
              <article
                key={issue.id}
                data-testid={`admin-issue-card-${issue.id}`}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition-shadow hover:shadow-sm"
              >
                <div className="grid gap-5 p-5 lg:grid-cols-12">
                  {/* Evidence Photo Column */}
                  <div className="lg:col-span-3">
                    {issue.evidencePhotoUrl ? (
                      <div className="relative h-48 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={issue.evidencePhotoUrl}
                          alt={`Evidence photo for ${issue.title}`}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute left-2.5 top-2.5 rounded-full bg-slate-900/75 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-white backdrop-blur-xs">
                          {issue.category}
                        </span>
                      </div>
                    ) : (
                      <div className="flex h-48 w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-400">
                        <ImageOff size={22} aria-hidden="true" />
                        <span className="mt-1.5 text-xs font-medium text-slate-500">
                          No evidence photo
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Report Audit Details */}
                  <div className="flex flex-col justify-between gap-4 lg:col-span-9">
                    <div>
                      {/* Status & adminVerified Flags Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-slate-500">
                            {issue.id}
                          </span>
                          <span
                            data-testid={`issue-status-badge-${issue.id}`}
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusMeta.className}`}
                          >
                            {issue.status === "Resolved" ? (
                              <CheckCircle2 size={12} aria-hidden="true" />
                            ) : issue.status === "Rejected" ? (
                              <XCircle size={12} aria-hidden="true" />
                            ) : (
                              <Clock size={12} aria-hidden="true" />
                            )}
                            <span>{statusMeta.label}</span>
                          </span>

                          {/* Explicit adminVerified boolean flag */}
                          <span
                            data-testid={`issue-admin-verified-badge-${issue.id}`}
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                              issue.adminVerified
                                ? "border-emerald-300 bg-emerald-100/80 text-emerald-900"
                                : "border-slate-200 bg-slate-100 text-slate-600"
                            }`}
                          >
                            <ShieldCheck size={12} aria-hidden="true" />
                            <span>
                              adminVerified:{" "}
                              {issue.adminVerified ? "true" : "false"}
                            </span>
                          </span>
                        </div>

                        <time
                          dateTime={issue.createdAtIso}
                          className="text-xs tabular-nums text-slate-500"
                        >
                          {formatCivicDate(issue.createdAtIso)}
                        </time>
                      </div>

                      {/* Title & Description */}
                      <h3 className="mt-2.5 font-[var(--font-heading)] text-lg font-bold text-slate-900">
                        {issue.title}
                      </h3>
                      {issue.description && (
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {issue.description}
                        </p>
                      )}

                      {/* GPS Location & Reporting Citizen Name + Email */}
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                          <MapPin
                            size={13}
                            className="text-blue-600"
                            aria-hidden="true"
                          />
                          <span>
                            {issue.ward}
                            {issue.location && issue.location !== issue.ward
                              ? ` · ${issue.location}`
                              : ""}
                          </span>
                        </span>

                        {gpsText && (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-700">
                            <Navigation
                              size={12}
                              className="text-slate-500"
                              aria-hidden="true"
                            />
                            <span>GPS: {gpsText}</span>
                          </span>
                        )}

                        {mapsUrl && (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline"
                          >
                            <span>Google Maps</span>
                            <ExternalLink size={11} aria-hidden="true" />
                          </a>
                        )}
                      </div>

                      {/* Reporting Citizen Identity Strip */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-xs text-slate-700">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                          <User
                            size={13}
                            className="text-blue-600"
                            aria-hidden="true"
                          />
                          <span>
                            Citizen:{" "}
                            {reporter?.name ||
                              (issue.reportedByUid
                                ? `UID ${issue.reportedByUid.slice(0, 10)}…`
                                : "Unknown")}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          <Mail
                            size={13}
                            className="text-slate-500"
                            aria-hidden="true"
                          />
                          <span className="font-mono text-[11px]">
                            {reporter?.email || "Email unavailable"}
                          </span>
                        </span>
                      </div>

                      {/* AI Material Estimate + AI Confidence Score */}
                      <div className="mt-3.5 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-2.5">
                          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            <Wrench
                              size={12}
                              className="text-blue-600"
                              aria-hidden="true"
                            />
                            <span>Asphalt Estimate</span>
                          </p>
                          <p className="mt-1 font-mono text-sm font-bold text-slate-900">
                            {issue.asphaltEstimateKg !== null
                              ? `${issue.asphaltEstimateKg.toLocaleString("en-IN")} kg`
                              : issue.materialEstimate || "Pending AI audit"}
                          </p>
                        </div>

                        <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Est. Repair Cost (INR)
                          </p>
                          <p className="mt-1 font-mono text-sm font-bold text-slate-900">
                            {issue.estimatedCostInr !== null
                              ? `₹${issue.estimatedCostInr.toLocaleString("en-IN")}`
                              : "Pending estimate"}
                          </p>
                        </div>

                        <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-2.5">
                          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            <Sparkles
                              size={12}
                              className="text-emerald-600"
                              aria-hidden="true"
                            />
                            <span>AI Confidence Score</span>
                          </p>
                          <p
                            className={`mt-1 font-mono text-sm font-bold ${
                              (issue.aiConfidenceScore ?? 0) >= 90
                                ? "text-emerald-700"
                                : "text-slate-900"
                            }`}
                          >
                            {issue.aiConfidenceScore !== null
                              ? `${issue.aiConfidenceScore}%`
                              : "Not scored yet"}
                          </p>
                        </div>
                      </div>

                      {issue.status === "Rejected" && issue.rejectionNote && (
                        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/80 px-3.5 py-2 text-xs font-medium text-rose-800">
                          <strong>Rejection Note:</strong> {issue.rejectionNote}
                        </div>
                      )}

                      {issue.adminActionBy && (
                        <p className="mt-2 font-mono text-[11px] text-slate-500">
                          Admin Action By: {issue.adminActionBy}
                        </p>
                      )}
                    </div>

                    {/* High-Contrast Real-Time Approve & Reject Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3.5">
                      <p className="text-xs text-slate-500">
                        {isAlreadyResolved
                          ? "Resolved & admin-verified in Firestore (+50 points & +1 resolved fix credited)."
                          : isAlreadyRejected
                            ? "Marked as invalid / spam in Firestore (0 points credited)."
                            : "Approving atomically credits +50 points & +1 resolved fix to the citizen."}
                      </p>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          disabled={isRowBusy || isAlreadyResolved}
                          onClick={() => void handleApproveAndResolve(issue)}
                          className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-emerald-600/20 transition-all hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100 whitespace-nowrap"
                        >
                          {isApproving ? (
                            <Loader2
                              size={15}
                              className="animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <CheckCircle2 size={15} aria-hidden="true" />
                          )}
                          <span>
                            {isApproving
                              ? "Resolving..."
                              : isAlreadyResolved
                                ? "Resolved (Verified)"
                                : "Approve & Mark Resolved"}
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={isRowBusy || isAlreadyRejected}
                          onClick={() => void handleRejectAsInvalid(issue)}
                          className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-rose-600/20 transition-all hover:bg-rose-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100 whitespace-nowrap"
                        >
                          {isRejecting ? (
                            <Loader2
                              size={15}
                              className="animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <XCircle size={15} aria-hidden="true" />
                          )}
                          <span>
                            {isRejecting
                              ? "Rejecting..."
                              : isAlreadyRejected
                                ? "Rejected"
                                : "Reject as Invalid / Spam"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
