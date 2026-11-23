"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Lock, MapPin, Siren } from "lucide-react";
import { DEMO_REFERENCE_DATE } from "@/lib/demo-data";
import { fetchPublicReportById } from "@/lib/firebase-reports";
import {
  formatCivicDate,
  getCategoryLabel,
  getPendingAgeLabel,
} from "@/lib/civic-logic";
import {
  buildGoogleMapsUrl,
  detectHighPriorityZone,
  getBengaluruWardAnchor,
} from "@/lib/location-helpers";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { StatusTimeline } from "@/components/issues/StatusTimeline";
import { BeforeAfterComparison } from "@/components/issues/BeforeAfterComparison";
import { EngineeringInsightsCard } from "@/components/issues/EngineeringInsightsCard";
import { SafeCivicImage } from "@/components/ui/SafeCivicImage";
import { EmptyState, LoadingState } from "@/components/ui/StateViews";
import type { PublicIssueRecord } from "@/types/civic";

interface IssueDetailClientProps {
  reportId: string;
  initialDemoIssue: PublicIssueRecord | null;
}

export function IssueDetailClient({
  reportId,
  initialDemoIssue,
}: IssueDetailClientProps) {
  const [issue, setIssue] = useState<PublicIssueRecord | null>(initialDemoIssue);
  const [loading, setLoading] = useState(!initialDemoIssue);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (initialDemoIssue) return;
    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    fetchPublicReportById(reportId)
      .then((found) => {
        if (!cancelled) {
          setIssue(found);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFetchError(
            "Unable to load this civic report right now."
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reportId, initialDemoIssue]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <LoadingState
          label={`Loading civic report ${reportId}...`}
          rows={4}
        />
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Link
          href="/issues"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back to Explore Issues</span>
        </Link>
        {fetchError && (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            {fetchError}
          </p>
        )}
        <EmptyState
          title={`Report “${reportId}” was not found`}
          description="Only admin-approved public reports appear here. You can also inspect sample reports including AI Before-vs-After verification on CS-DEMO-104."
          primaryAction={{
            label: "View Verified Sample CS-DEMO-104",
            href: "/issues/CS-DEMO-104",
          }}
          secondaryAction={{ label: "Explore Read-Only Demo", href: "/demo" }}
        />
      </div>
    );
  }

  const ageLabel = getPendingAgeLabel(
    issue.status,
    issue.createdAt,
    issue.isDemo ? DEMO_REFERENCE_DATE : new Date()
  );

  const hasBeforeAfterComparison = Boolean(
    issue.afterImageURL || issue.verificationStatus
  );

  const wardAnchor = getBengaluruWardAnchor(issue.locality);
  const resolvedLat = issue.lat ?? wardAnchor?.lat ?? null;
  const resolvedLng = issue.lng ?? wardAnchor?.lng ?? null;
  const googleMapsUrl = buildGoogleMapsUrl(resolvedLat, resolvedLng);

  const priorityZone = detectHighPriorityZone({
    title: issue.title,
    publicSummary: issue.publicSummary,
    locality: issue.locality,
    detectedAddress: issue.detectedAddress,
    surroundingLandmarks: issue.surroundingLandmarks,
    lat: resolvedLat,
    lng: resolvedLng,
    explicitFlag: issue.highPriorityZone,
  });

  return (
    <div>
      {issue.isDemo && <DemoBanner compact />}

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={issue.isDemo ? "/demo" : "/issues"}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>
              {issue.isDemo
                ? "Back to Read-Only Demo"
                : "Back to Explore Issues"}
            </span>
          </Link>
          <span className="font-mono text-xs tabular-nums text-slate-500">
            Report ID: {issue.id}
          </span>
        </div>

        {/* Main Report Card */}
        <article className="overflow-hidden rounded-[20px] border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                {issue.isDemo && (
                  <>
                    <span className="font-semibold text-[#C2410C]">
                      Demo report · Sample data
                    </span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                <span className="font-medium text-slate-800">
                  {getCategoryLabel(issue.category)}
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin
                    size={13}
                    aria-hidden="true"
                    className="text-[#2563EB]"
                  />
                  {issue.locality}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <StatusIndicator status={issue.status} size="md" />
                {ageLabel && (
                  <span className="text-xs font-medium tabular-nums text-slate-600">
                    {ageLabel}
                  </span>
                )}
              </div>
            </div>

            {priorityZone.isHighPriority && (
              <div className="mt-4">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                  <Siren size={14} aria-hidden="true" />
                  <span>High Priority Zone</span>
                  {priorityZone.reason && (
                    <span className="font-normal text-red-600">
                      · {priorityZone.reason}
                    </span>
                  )}
                </span>
              </div>
            )}

            <h1 className="mt-4 font-[var(--font-heading)] text-2xl font-bold text-slate-900 sm:text-3xl">
              {issue.title}
            </h1>

            <p className="mt-3 text-sm leading-7 text-slate-700 sm:text-base">
              {issue.publicSummary}
            </p>

            {/* Location & Google Maps Action Bar */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <div className="space-y-0.5 text-xs">
                <p className="font-semibold text-slate-900">
                  Ward: {issue.locality}
                  {issue.detectedAddress ? ` · ${issue.detectedAddress}` : ""}
                </p>
                {resolvedLat !== null && resolvedLng !== null && (
                  <p className="font-mono text-[11px] tabular-nums text-slate-500">
                    Coordinates: {resolvedLat}, {resolvedLng}
                    {issue.lat === undefined ? " (Ward center)" : " (GPS captured)"}
                  </p>
                )}
              </div>
              {googleMapsUrl && (
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#2563EB] transition-colors hover:bg-blue-50 whitespace-nowrap"
                >
                  <MapPin size={14} aria-hidden="true" />
                  <span>View on Google Maps</span>
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              )}
            </div>

            <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-5 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-slate-500">Created</dt>
                <dd className="mt-1 font-medium tabular-nums text-slate-900">
                  {formatCivicDate(issue.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Last updated</dt>
                <dd className="mt-1 font-medium tabular-nums text-slate-900">
                  {formatCivicDate(issue.updatedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">AI Verification</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {issue.verificationStatus === "verified"
                    ? "Verified by CivicSnap Vision AI"
                    : issue.verificationStatus === "flagged"
                      ? "Flagged for re-inspection"
                      : issue.aiSuggestionNote
                        ? "User-reviewed AI suggestion"
                        : "Pending repair verification"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Before vs After AI Verification Comparison (when present) */}
          {hasBeforeAfterComparison ? (
            <BeforeAfterComparison
              title={issue.title}
              beforeImageURL={issue.beforeImageURL ?? issue.demoImageUrl}
              afterImageURL={issue.afterImageURL}
              verificationStatus={issue.verificationStatus}
              verificationReason={issue.verificationReason}
              isDemo={issue.isDemo}
            />
          ) : (
            <div className="border-b border-slate-100 bg-slate-50/60 p-6 sm:px-8">
              {issue.demoImageUrl || issue.beforeImageURL ? (
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                    <SafeCivicImage
                      src={issue.beforeImageURL ?? issue.demoImageUrl ?? ""}
                      alt={issue.demoImageAlt ?? issue.title}
                      className="max-h-80 w-full"
                    />
                  </div>
                  <p className="flex items-start gap-2 text-xs leading-5 text-slate-600">
                    <Lock
                      size={14}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-slate-500"
                    />
                    <span>
                      {issue.isDemo
                        ? "Sample photo shown for demonstration only. Exact GPS coordinates remain private to the reporter and authorised project admins."
                        : "Approved issue photo shown for public transparency. Precise GPS coordinates remain private."}
                    </span>
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-3 text-sm text-slate-600">
                  <Lock
                    size={16}
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-slate-500"
                  />
                  <p className="leading-6">
                    Raw report photos and exact coordinates are private to the
                    reporter and authorised CivicSnap project admins. Public
                    views display approved summary details, AI Before-vs-After
                    verification, and status history.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Gemini Civil Engineering Insights */}
          {(issue.surroundingLandmarks ||
            issue.materialEstimate ||
            typeof issue.socialImpactScore === "number" ||
            issue.economicCostOfDelay) && (
            <div className="border-b border-slate-100 p-6 sm:px-8">
              <EngineeringInsightsCard
                surroundingLandmarks={issue.surroundingLandmarks}
                materialEstimate={issue.materialEstimate}
                socialImpactScore={issue.socialImpactScore}
                economicCostOfDelay={issue.economicCostOfDelay}
                demoMode={issue.isDemo}
              />
            </div>
          )}

          {/* Chronological Status Timeline */}
          <div className="p-6 sm:p-8">
            <h2 className="mb-5 text-lg font-semibold text-slate-900">
              Status timeline
            </h2>
            <StatusTimeline events={issue.timeline} />
          </div>
        </article>
      </div>
    </div>
  );
}
