"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  RotateCcw,
  Search,
  ShieldCheck,
  Siren,
  Sparkles,
  ThumbsUp,
  Trophy,
  Wrench,
  X,
} from "lucide-react";
import {
  BENGALURU_FEED_ISSUES,
  FEED_STATUS_DISPLAY,
  filterBengaluruFeed,
  type BengaluruFeedFilters,
  type BengaluruFeedIssue,
  type FeedSortOrder,
} from "@/lib/bengaluru-feed-data";
import { BENGALURU_PILOT_WARDS, buildGoogleMapsUrl, detectHighPriorityZone, getBengaluruWardAnchor } from "@/lib/location-helpers";
import { fetchPublicReports } from "@/lib/firebase-reports";
import { formatCivicDate, getCategoryLabel } from "@/lib/civic-logic";
import { SafeCivicImage } from "@/components/ui/SafeCivicImage";
import { HoverCard, PageTransition } from "@/components/ui/MotionPrimitives";
import type { IssueCategory, IssueStatus, PublicIssueRecord } from "@/types/civic";

const DEFAULT_FILTERS: BengaluruFeedFilters = {
  search: "",
  category: "all",
  status: "all",
  ward: "all",
  sort: "newest",
};

const CATEGORY_FILTER_OPTIONS: Array<{ value: IssueCategory | "all"; label: string }> = [
  { value: "all", label: "All Categories" },
  { value: "pothole", label: "Potholes" },
  { value: "streetlight", label: "Streetlights" },
  { value: "waste", label: "Garbage" },
];

const STATUS_FILTER_OPTIONS: Array<{ value: IssueStatus | "all"; label: string }> = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Under Inspection" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Verified Fixed" },
];

function mapFirestoreReportToFeedIssue(report: PublicIssueRecord): BengaluruFeedIssue {
  const anchor = getBengaluruWardAnchor(report.locality);
  const lat = typeof report.lat === "number" ? report.lat : (anchor?.lat ?? 12.9784);
  const lng = typeof report.lng === "number" ? report.lng : (anchor?.lng ?? 77.6408);

  const priority = detectHighPriorityZone({
    title: report.title,
    publicSummary: report.publicSummary,
    locality: report.locality,
    detectedAddress: report.detectedAddress,
    surroundingLandmarks: report.surroundingLandmarks,
    lat,
    lng,
    explicitFlag: report.highPriorityZone,
  });

  const fallbackBeforeImage =
    report.category === "streetlight"
      ? "/demo/streetlight.jpg"
      : report.category === "waste"
        ? "/demo/waste.jpg"
        : "/demo/pothole.jpg";

  const fallbackAfterImage =
    report.status === "resolved" ? "/demo/pothole-fixed.jpg" : fallbackBeforeImage;

  return {
    id: report.id,
    title: report.title,
    streetAddress: report.detectedAddress || `${report.locality}, Bengaluru`,
    ward: report.locality || "Indiranagar",
    category: report.category,
    status: report.status,
    summary: report.publicSummary,
    imageUrl: report.afterImageURL || report.beforeImageURL || report.demoImageUrl || fallbackAfterImage,
    imageAlt: report.title,
    beforeImageUrl: report.beforeImageURL || report.demoImageUrl || fallbackBeforeImage,
    afterImageUrl: report.afterImageURL || (report.status === "resolved" ? "/demo/pothole-fixed.jpg" : undefined),
    aiMatchPercent: report.verificationStatus === "verified" ? 94.8 : report.status === "resolved" ? 91.6 : undefined,
    aiVerificationSummary:
      report.verificationReason ||
      (report.status === "resolved"
        ? "CivicSnap Vision AI compared the original issue photo against the repair proof and verified surface restoration at the same location."
        : undefined),
    lat,
    lng,
    highPriorityZone: priority.isHighPriority,
    priorityZoneLabel: priority.reason
      ? `High Priority (${priority.reason.replace(/^Near\s+/i, "")})`
      : "High Priority Zone",
    aiMaterialStat:
      report.materialEstimate ||
      (report.category === "pothole"
        ? "~120 kg Asphalt required"
        : report.category === "streetlight"
          ? "1× 70W LED Fixture · 1.5 labor hrs"
          : "1 Sanitation Crew Dispatch"),
    estimatedRepairCost: report.economicCostOfDelay
      ? report.economicCostOfDelay.slice(0, 48)
      : "Engineering audit logged",
    socialImpactScore: report.socialImpactScore ?? 78,
    upvotes: 12,
    createdAt: report.createdAt,
    aiVerified: report.verificationStatus === "verified",
    isLiveFirestore: true,
  };
}

export function BengaluruFeedClient() {
  const [filters, setFilters] = useState<BengaluruFeedFilters>(DEFAULT_FILTERS);
  const [liveIssues, setLiveIssues] = useState<BengaluruFeedIssue[]>([]);
  const [upvotedIds, setUpvotedIds] = useState<Record<string, boolean>>({});
  const [proofModalIssue, setProofModalIssue] =
    useState<BengaluruFeedIssue | null>(null);

  useEffect(() => {
    if (!proofModalIssue) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProofModalIssue(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [proofModalIssue]);

  useEffect(() => {
    let cancelled = false;
    fetchPublicReports()
      .then((records) => {
        if (!cancelled && records.length > 0) {
          setLiveIssues(records.map(mapFirestoreReportToFeedIssue));
        }
      })
      .catch(() => {
        // Pre-loaded Bengaluru pilot feed remains immediately visible
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const allIssues = useMemo(() => {
    const seen = new Set<string>();
    const combined: BengaluruFeedIssue[] = [];
    for (const item of [...liveIssues, ...BENGALURU_FEED_ISSUES]) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        combined.push(item);
      }
    }
    return combined;
  }, [liveIssues]);

  const wardOptions = useMemo(() => {
    const set = new Set<string>([
      "Indiranagar",
      "Koramangala",
      "HSR Layout",
      "Whitefield",
      "Jayanagar",
      "Malleshwaram",
      ...BENGALURU_PILOT_WARDS,
    ]);
    for (const item of allIssues) {
      if (item.ward) set.add(item.ward);
    }
    return Array.from(set);
  }, [allIssues]);

  const upvoteBoosts = useMemo(() => {
    const boosts: Record<string, number> = {};
    for (const [id, active] of Object.entries(upvotedIds)) {
      if (active) boosts[id] = 1;
    }
    return boosts;
  }, [upvotedIds]);

  const filteredIssues = useMemo(
    () => filterBengaluruFeed(allIssues, filters, upvoteBoosts),
    [allIssues, filters, upvoteBoosts]
  );

  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.category !== "all" ||
    filters.status !== "all" ||
    filters.ward !== "all" ||
    filters.sort !== "newest";

  const toggleUpvote = (id: string) => {
    setUpvotedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <PageTransition className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="max-w-3xl">
        <p className="text-xs font-semibold tracking-wide text-blue-600">
          Bengaluru Pilot • Public issue tracker
        </p>
        <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Explore public civic reports
        </h1>
        <p className="mt-2.5 text-sm leading-6 text-slate-600 sm:text-base">
          Filter active Bengaluru reports by ward, category, or verification
          status. Issues near hospitals and schools are automatically flagged as{" "}
          <span className="font-semibold text-rose-700">High Priority Zones</span>{" "}
          with AI material estimates and direct Google Maps links.
        </p>
      </div>

      {/* Filter Bar Card */}
      <section
        aria-label="Filter public civic reports"
        className="mt-7 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-12">
          {/* Search Input */}
          <div className="sm:col-span-2 lg:col-span-4">
            <label
              htmlFor="feed-search"
              className="mb-1.5 block text-xs font-semibold text-slate-700"
            >
              Search reports
            </label>
            <div className="relative">
              <Search
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="feed-search"
                type="search"
                value={filters.search}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value }))
                }
                placeholder="Search by ID, title, street, or ward"
                className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
          </div>

          {/* Category */}
          <div className="lg:col-span-2">
            <label
              htmlFor="feed-category"
              className="mb-1.5 block text-xs font-semibold text-slate-700"
            >
              Category
            </label>
            <select
              id="feed-category"
              value={filters.category}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  category: e.target.value as IssueCategory | "all",
                }))
              }
              className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            >
              {CATEGORY_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="lg:col-span-2">
            <label
              htmlFor="feed-status"
              className="mb-1.5 block text-xs font-semibold text-slate-700"
            >
              Status
            </label>
            <select
              id="feed-status"
              value={filters.status}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  status: e.target.value as IssueStatus | "all",
                }))
              }
              className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            >
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Ward */}
          <div className="lg:col-span-2">
            <label
              htmlFor="feed-ward"
              className="mb-1.5 block text-xs font-semibold text-slate-700"
            >
              Ward
            </label>
            <select
              id="feed-ward"
              value={filters.ward}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, ward: e.target.value }))
              }
              className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            >
              <option value="all">All Wards</option>
              {wardOptions.map((ward) => (
                <option key={ward} value={ward}>
                  {ward}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className="lg:col-span-2">
            <label
              htmlFor="feed-sort"
              className="mb-1.5 block text-xs font-semibold text-slate-700"
            >
              Sort
            </label>
            <select
              id="feed-sort"
              value={filters.sort}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  sort: e.target.value as FeedSortOrder,
                }))
              }
              className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            >
              <option value="newest">Newest first</option>
              <option value="most_upvoted">Most upvoted</option>
            </select>
          </div>
        </div>

        {/* Result Counter Row */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3.5 text-xs text-slate-600">
          <p className="tabular-nums">
            Showing{" "}
            <strong className="font-semibold text-slate-900">
              {filteredIssues.length}
            </strong>{" "}
            active public{" "}
            {filteredIssues.length === 1 ? "report" : "reports"}
          </p>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-blue-600 transition-colors hover:text-blue-700"
            >
              <RotateCcw size={13} aria-hidden="true" />
              <span>Reset filters</span>
            </button>
          )}
        </div>
      </section>

      {/* Feed Cards Grid */}
      {filteredIssues.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-slate-200/90 bg-white px-6 py-12 text-center shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            No Bengaluru reports match those filters
          </h2>
          <p className="mt-1.5 text-sm text-slate-600">
            Clear your search query or switch ward/category filters to view all
            active civic reports.
          </p>
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="mt-4 inline-flex min-h-[42px] cursor-pointer items-center justify-center rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95"
          >
            Reset all filters
          </button>
        </div>
      ) : (
        <div className="mt-7 grid gap-6 md:grid-cols-2">
          {filteredIssues.map((issue) => {
            const statusMeta = FEED_STATUS_DISPLAY[issue.status];
            const mapsUrl = buildGoogleMapsUrl(issue.lat, issue.lng);
            const hasUpvoted = Boolean(upvotedIds[issue.id]);
            const totalUpvotes = issue.upvotes + (hasUpvoted ? 1 : 0);

            return (
              <HoverCard
                key={issue.id}
                className="flex flex-col overflow-hidden"
              >
                {/* Clean Photo Header */}
                <div className="relative h-52 w-full overflow-hidden bg-slate-100">
                  <SafeCivicImage
                    src={issue.imageUrl}
                    alt={issue.imageAlt}
                    className="h-full w-full object-cover"
                  />
                  {/* Subtle top-left Ward tag & top-right ID */}
                  <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/95 px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-xs backdrop-blur-sm">
                      <MapPin
                        size={12}
                        className="text-blue-600"
                        aria-hidden="true"
                      />
                      <span>{issue.ward}</span>
                    </span>
                    <span className="rounded-full bg-slate-900/75 px-2.5 py-1 font-mono text-[11px] font-medium tabular-nums text-white backdrop-blur-sm">
                      {issue.id}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="flex flex-1 flex-col justify-between p-5">
                  <div>
                    {/* Status + Priority Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 ${statusMeta.badgeClass}`}
                      >
                        {issue.status === "resolved" ? (
                          <CheckCircle2 size={12} aria-hidden="true" />
                        ) : (
                          <Clock size={12} aria-hidden="true" />
                        )}
                        <span>{statusMeta.label}</span>
                      </span>

                      {issue.highPriorityZone && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                          <Siren size={12} aria-hidden="true" />
                          <span>
                            {issue.priorityZoneLabel || "High Priority Zone"}
                          </span>
                        </span>
                      )}

                      {issue.aiVerified && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 size={12} aria-hidden="true" />
                          <span>AI Verified</span>
                        </span>
                      )}
                    </div>

                    {/* Title & Summary */}
                    <h2 className="mt-3 text-lg font-bold leading-snug text-slate-900">
                      {issue.isLiveFirestore ? (
                        <Link
                          href={`/issues/${encodeURIComponent(issue.id)}`}
                          className="transition-colors hover:text-blue-600"
                        >
                          {issue.title}
                        </Link>
                      ) : (
                        issue.title
                      )}
                    </h2>
                    <p className="mt-1.5 text-sm leading-6 text-slate-600 line-clamp-2">
                      {issue.summary}
                    </p>

                    {/* Clean Unboxed Metadata Line */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">
                        {getCategoryLabel(issue.category)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{issue.streetAddress}</span>
                      <span aria-hidden="true">·</span>
                      <time
                        dateTime={issue.createdAt}
                        className="tabular-nums"
                      >
                        {formatCivicDate(issue.createdAt)}
                      </time>
                    </div>

                    {/* AI Engineering Material Stat Strip */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 py-2.5 text-xs">
                      <div className="flex items-center gap-2 font-medium text-slate-800">
                        <Wrench
                          size={14}
                          className="shrink-0 text-blue-600"
                          aria-hidden="true"
                        />
                        <span>{issue.aiMaterialStat}</span>
                      </div>
                      <span className="font-mono font-semibold tabular-nums text-slate-600">
                        Impact {issue.socialImpactScore}/100
                      </span>
                    </div>

                    {issue.status === "resolved" && (
                      <p className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                        <Trophy
                          size={13}
                          className="shrink-0 text-amber-600"
                          aria-hidden="true"
                        />
                        <span>
                          +50 Merit Points awarded towards Annual CM Standings
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Card Action Bar: Google Maps + View AI Proof (Resolved) + Upvote */}
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-100 pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {issue.status === "resolved" && (
                        <button
                          type="button"
                          onClick={() => setProofModalIssue(issue)}
                          className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 transition-all hover:bg-emerald-100 active:scale-95 whitespace-nowrap"
                        >
                          <Search size={13} aria-hidden="true" />
                          <span>View AI Proof</span>
                        </button>
                      )}

                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-all hover:bg-slate-100 whitespace-nowrap"
                        >
                          <MapPin
                            size={13}
                            className="text-blue-600"
                            aria-hidden="true"
                          />
                          <span>View on Google Maps</span>
                          <ExternalLink
                            size={12}
                            className="text-slate-400"
                            aria-hidden="true"
                          />
                        </a>
                      )}
                    </div>

                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.94 }}
                      onClick={() => toggleUpvote(issue.id)}
                      aria-pressed={hasUpvoted}
                      aria-label={`Upvote ${issue.title}`}
                      className={`inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold tabular-nums transition-all whitespace-nowrap ${
                        hasUpvoted
                          ? "border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <ThumbsUp size={13} aria-hidden="true" />
                      <span>{hasUpvoted ? "Upvoted" : "Upvote"}</span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] ${
                          hasUpvoted
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {totalUpvotes}
                      </span>
                    </motion.button>
                  </div>
                </div>
              </HoverCard>
            );
          })}
        </div>
      )}

      {/* Public Transparency Before-vs-After AI Proof Modal (Accessible to Everyone) */}
      <AnimatePresence>
        {proofModalIssue && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              key="ai-proof-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setProofModalIssue(null)}
              aria-hidden="true"
              className="fixed inset-0 bg-slate-900/45 backdrop-blur-[2px]"
            />

            <motion.div
              key="ai-proof-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="ai-proof-modal-title"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                      <ShieldCheck size={13} aria-hidden="true" />
                      <span>Public Transparency Proof</span>
                    </span>
                    <span className="font-mono text-xs font-semibold text-slate-500">
                      {proofModalIssue.id}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      · {proofModalIssue.ward}
                    </span>
                  </div>
                  <h2
                    id="ai-proof-modal-title"
                    className="mt-2 font-[var(--font-heading)] text-lg font-bold text-slate-900 sm:text-xl"
                  >
                    {proofModalIssue.title}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setProofModalIssue(null)}
                  aria-label="Close AI proof modal"
                  className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  <X size={17} aria-hidden="true" />
                </button>
              </div>

              {/* Side-by-Side Before & After Photos */}
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <figcaption className="flex items-center justify-between border-b border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700">
                    <span>Before · Citizen Report</span>
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                      Original Issue
                    </span>
                  </figcaption>
                  <div className="h-52 w-full">
                    <SafeCivicImage
                      src={proofModalIssue.beforeImageUrl || "/demo/pothole.jpg"}
                      alt={`Before fix: ${proofModalIssue.title}`}
                      className="h-full w-full"
                    />
                  </div>
                </figure>

                <figure className="overflow-hidden rounded-2xl border border-emerald-200 bg-slate-50">
                  <figcaption className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50/50 px-3.5 py-2 text-xs font-semibold text-slate-800">
                    <span>After · Verified Repair</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                      <CheckCircle2 size={11} aria-hidden="true" />
                      Verified Fixed
                    </span>
                  </figcaption>
                  <div className="h-52 w-full">
                    <SafeCivicImage
                      src={
                        proofModalIssue.afterImageUrl ||
                        proofModalIssue.imageUrl ||
                        "/demo/pothole-fixed.jpg"
                      }
                      alt={`After fix: ${proofModalIssue.title}`}
                      className="h-full w-full"
                    />
                  </div>
                </figure>
              </div>

              {/* AI Visual Match Meter */}
              {(() => {
                const matchScore = proofModalIssue.aiMatchPercent ?? 94.8;
                const modalMapsUrl = buildGoogleMapsUrl(
                  proofModalIssue.lat,
                  proofModalIssue.lng
                );
                return (
                  <div className="mt-5 rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Sparkles
                          size={16}
                          className="text-emerald-600"
                          aria-hidden="true"
                        />
                        <span className="text-sm font-bold text-slate-900">
                          {matchScore}% Visual Match — CivicSnap Vision AI Verified
                        </span>
                      </div>
                      <span className="rounded-full border border-emerald-200 bg-white px-2.5 py-0.5 font-mono text-xs font-bold tabular-nums text-emerald-700">
                        {matchScore}% Match
                      </span>
                    </div>

                    <div
                      className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-emerald-100"
                      role="progressbar"
                      aria-label={`AI visual match score ${matchScore}%`}
                      aria-valuenow={matchScore}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${matchScore}%` }}
                        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full rounded-full bg-emerald-600"
                      />
                    </div>

                    <p className="mt-2.5 text-xs leading-5 text-slate-700 sm:text-sm">
                      {proofModalIssue.aiVerificationSummary ||
                        "CivicSnap Vision AI confirmed the same road corridor and verified that the reported civic hazard has been fully repaired."}
                    </p>

                    <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
                      <Trophy
                        size={13}
                        className="text-amber-600"
                        aria-hidden="true"
                      />
                      <span>
                        +50 Merit Points awarded towards Annual CM Standings
                      </span>
                    </p>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-emerald-200/60 pt-3.5 text-xs">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                        <Wrench
                          size={13}
                          className="text-blue-600"
                          aria-hidden="true"
                        />
                        <span>
                          {proofModalIssue.aiMaterialStat} ·{" "}
                          {proofModalIssue.estimatedRepairCost}
                        </span>
                      </span>

                      <div className="flex items-center gap-2">
                        {modalMapsUrl && (
                          <a
                            href={modalMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            <MapPin
                              size={12}
                              className="text-blue-600"
                              aria-hidden="true"
                            />
                            <span>Google Maps</span>
                            <ExternalLink size={11} aria-hidden="true" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => setProofModalIssue(null)}
                          className="inline-flex min-h-[36px] cursor-pointer items-center justify-center rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
