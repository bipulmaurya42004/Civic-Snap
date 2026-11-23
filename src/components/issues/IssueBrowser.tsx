"use client";

import { useMemo, useState } from "react";
import { RotateCcw, Search } from "lucide-react";
import {
  ISSUE_CATEGORIES,
  STATUS_LABELS,
  type IssueCategory,
  type IssueFilterState,
  type IssueStatus,
  type PublicIssueRecord,
  type SortOrder,
} from "@/types/civic";
import { filterAndSortIssues, paginateIssues } from "@/lib/civic-logic";
import { IssueCard } from "@/components/issues/IssueCard";
import { EmptyState } from "@/components/ui/StateViews";

interface IssueBrowserProps {
  issues: readonly PublicIssueRecord[];
  areas: readonly string[];
  isDemo?: boolean;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
}

const DEFAULT_FILTERS: IssueFilterState = {
  search: "",
  category: "all",
  status: "all",
  area: "all",
  sort: "newest",
};

export function IssueBrowser({
  issues,
  areas,
  isDemo = false,
  pageSize = 4,
  emptyTitle = "No public reports match your filters",
  emptyDescription = "Try clearing a filter or broaden your search query.",
}: IssueBrowserProps) {
  const [filters, setFilters] = useState<IssueFilterState>(DEFAULT_FILTERS);
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const wardOptions = useMemo(() => {
    const merged = new Set<string>(areas);
    for (const issue of issues) {
      if (issue.locality && issue.locality.trim().length > 0) {
        merged.add(issue.locality.trim());
      }
    }
    return Array.from(merged);
  }, [areas, issues]);

  const filteredIssues = useMemo(
    () => filterAndSortIssues(issues, filters),
    [issues, filters]
  );

  const { items, hasMore, remaining } = useMemo(
    () => paginateIssues(filteredIssues, visibleCount),
    [filteredIssues, visibleCount]
  );

  const hasActiveFilters =
    filters.search !== "" ||
    filters.category !== "all" ||
    filters.status !== "all" ||
    filters.area !== "all" ||
    filters.sort !== "newest";

  const updateFilter = <K extends keyof IssueFilterState>(
    key: K,
    value: IssueFilterState[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setVisibleCount(pageSize);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setVisibleCount(pageSize);
  };

  return (
    <div className="space-y-6">
      {/* Filter toolbar */}
      <section
        aria-label="Filter and sort issues"
        className="rounded-[18px] border border-slate-200 bg-white p-4 sm:p-5"
      >
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-12">
          <div className="sm:col-span-2 lg:col-span-4">
            <label
              htmlFor="issue-search-input"
              className="mb-1.5 block text-xs font-medium text-slate-700"
            >
              Search reports
            </label>
            <div className="relative">
              <Search
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="issue-search-input"
                type="search"
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
                placeholder="ID, title, street, or ward"
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:bg-white"
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="issue-category-select"
              className="mb-1.5 block text-xs font-medium text-slate-700"
            >
              Category
            </label>
            <select
              id="issue-category-select"
              value={filters.category}
              onChange={(e) =>
                updateFilter("category", e.target.value as IssueCategory | "all")
              }
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white pl-3 pr-8 text-sm text-slate-900"
            >
              <option value="all">All categories</option>
              {ISSUE_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="issue-status-select"
              className="mb-1.5 block text-xs font-medium text-slate-700"
            >
              Status
            </label>
            <select
              id="issue-status-select"
              value={filters.status}
              onChange={(e) =>
                updateFilter("status", e.target.value as IssueStatus | "all")
              }
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white pl-3 pr-8 text-sm text-slate-900"
            >
              <option value="all">All statuses</option>
              {(Object.keys(STATUS_LABELS) as IssueStatus[]).map((statusKey) => (
                <option key={statusKey} value={statusKey}>
                  {STATUS_LABELS[statusKey]}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="issue-area-select"
              className="mb-1.5 block text-xs font-medium text-slate-700"
            >
              Ward
            </label>
            <select
              id="issue-area-select"
              value={filters.area}
              onChange={(e) => updateFilter("area", e.target.value)}
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

          <div className="lg:col-span-2">
            <label
              htmlFor="issue-sort-select"
              className="mb-1.5 block text-xs font-medium text-slate-700"
            >
              Sort by
            </label>
            <select
              id="issue-sort-select"
              value={filters.sort}
              onChange={(e) => updateFilter("sort", e.target.value as SortOrder)}
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
          <p className="tabular-nums">
            Showing <strong className="text-slate-900">{items.length}</strong> of{" "}
            <strong className="text-slate-900">{filteredIssues.length}</strong>{" "}
            {isDemo ? "sample reports" : "public reports"}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 font-medium text-[#2563EB] hover:text-[#1D4ED8] whitespace-nowrap"
            >
              <RotateCcw size={13} aria-hidden="true" />
              <span>Reset filters</span>
            </button>
          )}
        </div>
      </section>

      {/* Issue cards or empty state */}
      {items.length === 0 ? (
        issues.length === 0 ? (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            primaryAction={{ label: "Explore Read-Only Demo", href: "/demo" }}
            secondaryAction={{ label: "View Reporting Flow", href: "/report" }}
          />
        ) : (
          <div className="rounded-[18px] border border-slate-200 bg-white px-6 py-10 text-center">
            <h3 className="text-base font-semibold text-slate-900">
              No reports match those filters
            </h3>
            <p className="mt-1.5 text-sm text-slate-600">
              Adjust your search text, category, status, or ward selection.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 inline-flex min-h-[40px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
            >
              Clear all filters
            </button>
          </div>
        )
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + pageSize)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap"
              >
                Load more ({remaining} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
