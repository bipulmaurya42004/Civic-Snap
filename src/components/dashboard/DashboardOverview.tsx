"use client";

import { useMemo, useState } from "react";
import { MapPin, Siren } from "lucide-react";
import {
  ISSUE_CATEGORIES,
  type DateRangeFilter,
  type IssueCategory,
  type PublicIssueRecord,
} from "@/types/civic";
import {
  computeDashboardMetrics,
  filterIssuesByDateRange,
} from "@/lib/civic-logic";
import { detectHighPriorityZone } from "@/lib/location-helpers";
import { DEMO_REFERENCE_DATE } from "@/lib/demo-data";
import { EmptyState } from "@/components/ui/StateViews";

interface DashboardOverviewProps {
  issues: readonly PublicIssueRecord[];
  areas: readonly string[];
  isDemo?: boolean;
  compact?: boolean;
}

const DATE_RANGE_OPTIONS: Array<{ value: DateRangeFilter; label: string }> = [
  { value: "all", label: "All time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

export function DashboardOverview({
  issues,
  areas,
  isDemo = false,
  compact = false,
}: DashboardOverviewProps) {
  const [dateRange, setDateRange] = useState<DateRangeFilter>("all");
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<
    IssueCategory | "all"
  >("all");

  const wardOptions = useMemo(() => {
    const merged = new Set<string>(areas);
    for (const issue of issues) {
      if (issue.locality && issue.locality.trim().length > 0) {
        merged.add(issue.locality.trim());
      }
    }
    return Array.from(merged);
  }, [areas, issues]);

  const filteredIssues = useMemo(() => {
    const refDate = isDemo ? DEMO_REFERENCE_DATE : new Date();
    return filterIssuesByDateRange(issues, dateRange, refDate).filter((item) => {
      if (selectedArea !== "all" && item.locality !== selectedArea) {
        return false;
      }
      if (selectedCategory !== "all" && item.category !== selectedCategory) {
        return false;
      }
      return true;
    });
  }, [issues, dateRange, selectedArea, selectedCategory, isDemo]);

  const metrics = useMemo(
    () => computeDashboardMetrics(filteredIssues),
    [filteredIssues]
  );

  const wardBreakdown = useMemo(() => {
    const countByWard = new Map<string, number>();
    for (const ward of areas) {
      countByWard.set(ward, 0);
    }
    for (const item of metrics.byArea) {
      countByWard.set(item.area, item.count);
    }
    return Array.from(countByWard.entries())
      .map(([ward, count]) => ({ ward, count }))
      .sort((a, b) => b.count - a.count || a.ward.localeCompare(b.ward));
  }, [areas, metrics.byArea]);

  const highPriorityZoneCount = useMemo(() => {
    return filteredIssues.filter(
      (item) =>
        detectHighPriorityZone({
          title: item.title,
          publicSummary: item.publicSummary,
          locality: item.locality,
          detectedAddress: item.detectedAddress,
          surroundingLandmarks: item.surroundingLandmarks,
          lat: item.lat,
          lng: item.lng,
          explicitFlag: item.highPriorityZone,
        }).isHighPriority
    ).length;
  }, [filteredIssues]);

  const topWard = wardBreakdown.find((item) => item.count > 0) ?? null;

  const maxCategoryCount = Math.max(
    1,
    ...metrics.byCategory.map((item) => item.count)
  );
  const maxWardCount = Math.max(
    1,
    ...wardBreakdown.map((item) => item.count)
  );

  return (
    <div className="space-y-6">
      {/* Filter bar (omitted only in compact landing preview) */}
      {!compact && (
        <section
          aria-label="Dashboard filters"
          className="rounded-[18px] border border-slate-200 bg-white p-4 sm:p-5"
        >
          <div className="grid gap-3.5 sm:grid-cols-3">
            <div>
              <label
                htmlFor="dash-date-range"
                className="mb-1.5 block text-xs font-medium text-slate-700"
              >
                Date range
              </label>
              <select
                id="dash-date-range"
                value={dateRange}
                onChange={(e) =>
                  setDateRange(e.target.value as DateRangeFilter)
                }
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white pl-3 pr-8 text-sm text-slate-900"
              >
                {DATE_RANGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="dash-area"
                className="mb-1.5 block text-xs font-medium text-slate-700"
              >
                Ward
              </label>
              <select
                id="dash-area"
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white pl-3 pr-8 text-sm text-slate-900"
              >
                <option value="all">All wards</option>
                {wardOptions.map((ward) => (
                  <option key={ward} value={ward}>
                    {ward}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="dash-category"
                className="mb-1.5 block text-xs font-medium text-slate-700"
              >
                Category
              </label>
              <select
                id="dash-category"
                value={selectedCategory}
                onChange={(e) =>
                  setSelectedCategory(e.target.value as IssueCategory | "all")
                }
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              >
                <option value="all">All categories</option>
                {ISSUE_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>
      )}

      {/* KPI Summary Strip */}
      <section aria-label="Report status counts">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-[18px] border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-600">Total reports</p>
            <p className="mt-2 font-[var(--font-heading)] text-3xl font-bold tabular-nums text-slate-900">
              {metrics.total}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {isDemo ? "Demo dataset" : "On CivicSnap"}
            </p>
          </div>

          <div className="rounded-[18px] border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-[#C2410C]">Pending</p>
            <p className="mt-2 font-[var(--font-heading)] text-3xl font-bold tabular-nums text-slate-900">
              {metrics.pending}
            </p>
            <p className="mt-1 text-xs text-slate-500">Awaiting progress</p>
          </div>

          <div className="rounded-[18px] border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-[#1D4ED8]">In Progress</p>
            <p className="mt-2 font-[var(--font-heading)] text-3xl font-bold tabular-nums text-slate-900">
              {metrics.inProgress}
            </p>
            <p className="mt-1 text-xs text-slate-500">Active follow-up</p>
          </div>

          <div className="rounded-[18px] border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-[#047857]">Resolved</p>
            <p className="mt-2 font-[var(--font-heading)] text-3xl font-bold tabular-nums text-slate-900">
              {metrics.resolved}
            </p>
            <p className="mt-1 text-xs text-slate-500">Closed by project team</p>
          </div>
        </div>
      </section>

      {metrics.total === 0 ? (
        <EmptyState
          title={
            issues.length === 0
              ? "No production reports recorded yet"
              : "No reports in this filtered view"
          }
          description={
            issues.length === 0
              ? "Live dashboard charts populate automatically from approved public reports on CivicSnap Cloud. Submit a report or explore working filters and charts in the read-only demo now."
              : "Adjust the date range, ward, or category filters above to inspect other CivicSnap reports."
          }
          primaryAction={
            issues.length === 0
              ? { label: "Open Demo Dashboard", href: "/demo?tab=dashboard" }
              : undefined
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Reports by Category */}
          <section className="rounded-[18px] border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Reports by category
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Distribution across supported MVP categories
            </p>
            <ul className="mt-5 space-y-4">
              {metrics.byCategory.map((item) => {
                const widthPct = Math.round(
                  (item.count / maxCategoryCount) * 100
                );
                return (
                  <li key={item.category}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">
                        {item.label}
                      </span>
                      <span className="font-mono font-semibold tabular-nums text-slate-900">
                        {item.count}
                      </span>
                    </div>
                    <div
                      className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100"
                      role="progressbar"
                      aria-label={`${item.label}: ${item.count} reports`}
                      aria-valuenow={item.count}
                      aria-valuemin={0}
                      aria-valuemax={metrics.total}
                    >
                      <div
                        className="h-full rounded-full bg-[#2563EB]"
                        style={{ width: `${item.count === 0 ? 0 : Math.max(8, widthPct)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Ward-wise Breakdown */}
          <section className="rounded-[18px] border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <MapPin size={15} className="text-[#2563EB]" aria-hidden="true" />
                  <span>Ward-wise Breakdown</span>
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {topWard
                    ? `Most reported ward: ${topWard.ward} (${topWard.count})`
                    : "Bengaluru Pilot ward distribution"}
                </p>
              </div>
              {highPriorityZoneCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
                  <Siren size={12} aria-hidden="true" />
                  <span>{highPriorityZoneCount} High Priority</span>
                </span>
              )}
            </div>
            <ul className="mt-5 space-y-3.5">
              {wardBreakdown.map((item, idx) => {
                const widthPct = Math.round((item.count / maxWardCount) * 100);
                const isTop = idx === 0 && item.count > 0;
                return (
                  <li key={item.ward}>
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={`font-medium ${
                          isTop ? "text-slate-900 font-semibold" : "text-slate-700"
                        }`}
                      >
                        {item.ward}
                      </span>
                      <span className="font-mono font-semibold tabular-nums text-slate-900">
                        {item.count}
                      </span>
                    </div>
                    <div
                      className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100"
                      role="progressbar"
                      aria-label={`${item.ward}: ${item.count} reports`}
                      aria-valuenow={item.count}
                      aria-valuemin={0}
                      aria-valuemax={metrics.total}
                    >
                      <div
                        className={`h-full rounded-full ${
                          isTop ? "bg-[#2563EB]" : "bg-slate-700"
                        }`}
                        style={{
                          width: `${item.count === 0 ? 0 : Math.max(8, widthPct)}%`,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Status Distribution */}
          <section className="rounded-[18px] border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Status distribution
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Share of tracked reports by current status
            </p>
            <ul className="mt-5 space-y-4">
              {metrics.statusDistribution.map((item) => {
                const barColor =
                  item.status === "resolved"
                    ? "bg-[#10B981]"
                    : item.status === "in_progress"
                      ? "bg-[#2563EB]"
                      : "bg-[#F97316]";
                return (
                  <li key={item.status}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">
                        {item.label}
                      </span>
                      <span className="font-mono font-semibold tabular-nums text-slate-900">
                        {item.count} ({item.percentage}%)
                      </span>
                    </div>
                    <div
                      className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100"
                      role="progressbar"
                      aria-label={`${item.label}: ${item.percentage}%`}
                      aria-valuenow={item.percentage}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{
                          width: `${item.count === 0 ? 0 : Math.max(6, item.percentage)}%`,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}

      <p className="text-xs leading-5 text-slate-500">
        {isDemo
          ? "Demo statistics shown above use sample data. "
          : ""}
        Dashboard figures describe reports submitted on CivicSnap, not complete
        official city statistics.
      </p>
    </div>
  );
}
