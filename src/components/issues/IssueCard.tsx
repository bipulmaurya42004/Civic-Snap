import Link from "next/link";
import { ArrowRight, MapPin, ShieldCheck, Siren } from "lucide-react";
import type { PublicIssueRecord } from "@/types/civic";
import {
  formatCivicDate,
  getCategoryLabel,
  getPendingAgeLabel,
} from "@/lib/civic-logic";
import { detectHighPriorityZone } from "@/lib/location-helpers";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { DEMO_REFERENCE_DATE } from "@/lib/demo-data";

interface IssueCardProps {
  issue: PublicIssueRecord;
}

export function IssueCard({ issue }: IssueCardProps) {
  const referenceDate = issue.isDemo ? DEMO_REFERENCE_DATE : new Date();
  const ageLabel = getPendingAgeLabel(
    issue.status,
    issue.createdAt,
    referenceDate
  );

  const priorityZone = detectHighPriorityZone({
    title: issue.title,
    publicSummary: issue.publicSummary,
    locality: issue.locality,
    detectedAddress: issue.detectedAddress,
    surroundingLandmarks: issue.surroundingLandmarks,
    lat: issue.lat,
    lng: issue.lng,
    explicitFlag: issue.highPriorityZone,
  });

  return (
    <article className="flex flex-col justify-between rounded-[18px] border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-xs tabular-nums text-slate-500">
            {issue.id}
            {issue.isDemo && (
              <>
                <span aria-hidden="true"> · </span>
                <span className="font-sans font-medium text-slate-600">
                  Sample data
                </span>
              </>
            )}
          </p>
          <StatusIndicator status={issue.status} size="sm" />
        </div>

        {priorityZone.isHighPriority && (
          <div className="mt-2.5">
            <span
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700"
              title={priorityZone.reason ?? "Near Hospital or School"}
            >
              <Siren size={12} aria-hidden="true" />
              <span>High Priority Zone</span>
              {priorityZone.reason && (
                <span className="font-normal text-red-600">
                  · {priorityZone.reason}
                </span>
              )}
            </span>
          </div>
        )}

        <h3 className="mt-2.5 text-base font-semibold leading-snug text-slate-900">
          <Link
            href={`/issues/${encodeURIComponent(issue.id)}`}
            className="hover:text-[#2563EB] transition-colors"
          >
            {issue.title}
          </Link>
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-600 line-clamp-2">
          {issue.publicSummary}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span className="font-medium text-slate-700">
            {getCategoryLabel(issue.category)}
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1 font-medium text-slate-700">
            <MapPin size={12} className="text-[#2563EB]" aria-hidden="true" />
            <span>{issue.locality}</span>
          </span>
          {issue.detectedAddress && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate max-w-[200px]" title={issue.detectedAddress}>
                {issue.detectedAddress}
              </span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <time dateTime={issue.createdAt} className="tabular-nums">
            {formatCivicDate(issue.createdAt)}
          </time>
          {ageLabel && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-slate-700 tabular-nums">
                {ageLabel}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 tabular-nums">
            {issue.timeline.length}{" "}
            {issue.timeline.length === 1 ? "timeline event" : "timeline events"}
          </span>
          {issue.verificationStatus === "verified" && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              <ShieldCheck size={12} aria-hidden="true" />
              <span>AI Verified</span>
            </span>
          )}
        </div>
        <Link
          href={`/issues/${encodeURIComponent(issue.id)}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors whitespace-nowrap"
        >
          <span>Open details</span>
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
