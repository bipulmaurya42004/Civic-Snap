"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  Camera,
  CheckCircle2,
  Clock,
  MapPin,
  Medal,
  Search,
  Sparkles,
  Trophy,
} from "lucide-react";
import { WARD_WARS_STANDINGS } from "@/lib/bengaluru-feed-data";
import { HoverCard, PageTransition } from "@/components/ui/MotionPrimitives";

type WardSortKey = "resolutionRate" | "avgFixHours" | "civicPoints";

export function WardWarsClient() {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<WardSortKey>("resolutionRate");

  const podium = WARD_WARS_STANDINGS.slice(0, 3);

  const sortedStandings = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = WARD_WARS_STANDINGS.filter(
      (row) =>
        !q ||
        row.ward.toLowerCase().includes(q) ||
        row.zone.toLowerCase().includes(q) ||
        row.topColony.toLowerCase().includes(q)
    );
    return [...filtered].sort((a, b) => {
      if (sortKey === "avgFixHours") {
        return a.avgFixHours - b.avgFixHours;
      }
      if (sortKey === "civicPoints") {
        return b.civicPoints - a.civicPoints;
      }
      return b.resolutionRate - a.resolutionRate;
    });
  }, [search, sortKey]);

  return (
    <PageTransition className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-wide text-blue-600">
            Bengaluru Pilot • Ward Wars Leaderboard
          </p>
          <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Bengaluru Ward Wars rankings
          </h1>
          <p className="mt-2.5 text-sm leading-6 text-slate-600 sm:text-base">
            Track which Bengaluru wards achieve the fastest verified road and
            sanitation fixes — ranked by AI-verified resolution rate, average
            turnaround hours, and resident CivicPoints.
          </p>
        </div>

        <Link
          href="/report"
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95 whitespace-nowrap"
        >
          <Camera size={16} aria-hidden="true" />
          <span>Boost Your Ward</span>
        </Link>
      </div>

      {/* Top 3 Ward Podium Cards */}
      <section aria-label="Top three Bengaluru wards" className="mt-8">
        <div className="grid gap-5 md:grid-cols-3">
          {podium.map((ward, idx) => {
            const isFirst = idx === 0;
            const rankBadgeClass =
              idx === 0
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : idx === 1
                  ? "bg-slate-100 text-slate-700 border-slate-200"
                  : "bg-orange-50 text-orange-700 border-orange-200";

            return (
              <HoverCard
                key={ward.ward}
                className={`p-6 ${
                  isFirst ? "ring-1 ring-blue-600/20" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${rankBadgeClass}`}
                  >
                    {isFirst ? (
                      <Trophy size={13} aria-hidden="true" />
                    ) : (
                      <Medal size={13} aria-hidden="true" />
                    )}
                    <span>#{ward.rank} Ward</span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-emerald-700">
                    <CheckCircle2 size={12} aria-hidden="true" />
                    <span>{ward.resolutionRate}% Fixed</span>
                  </span>
                </div>

                <h2 className="mt-4 font-[var(--font-heading)] text-2xl font-bold text-slate-900">
                  {ward.ward}
                </h2>
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                  <MapPin size={12} className="text-blue-600" aria-hidden="true" />
                  <span>
                    {ward.zone} · {ward.topColony}
                  </span>
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                  <div>
                    <p className="text-[11px] font-medium text-slate-500">
                      Avg Fix Time
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 font-mono text-base font-bold tabular-nums text-slate-900">
                      <Clock size={14} className="text-blue-600" aria-hidden="true" />
                      <span>{ward.avgFixHours} hrs</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-500">
                      Colony CivicPoints
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 font-mono text-base font-bold tabular-nums text-blue-700">
                      <Sparkles size={14} aria-hidden="true" />
                      <span>{ward.civicPoints.toLocaleString("en-IN")}</span>
                    </p>
                  </div>
                </div>
              </HoverCard>
            );
          })}
        </div>
      </section>

      {/* Full Ward Standings Table */}
      <section
        aria-label="Full Bengaluru ward rankings table"
        className="mt-8 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm"
      >
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200/80 p-4 sm:flex-row sm:items-center sm:p-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              All Bengaluru Pilot Wards
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Live resolution rate, fix speed, and CivicPoints earned by colony
              residents
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search
                size={15}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                aria-label="Filter wards by name or colony"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ward or colony..."
                className="min-h-[38px] w-48 rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div className="inline-flex items-center gap-1.5">
              <ArrowUpDown
                size={14}
                className="text-slate-400"
                aria-hidden="true"
              />
              <select
                aria-label="Sort ward rankings"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as WardSortKey)}
                className="min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              >
                <option value="resolutionRate">Resolution Rate (%)</option>
                <option value="avgFixHours">Fastest Avg Fix (hrs)</option>
                <option value="civicPoints">Most CivicPoints</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                <th className="px-5 py-3.5">Rank</th>
                <th className="px-5 py-3.5">Ward &amp; Top Colony</th>
                <th className="px-5 py-3.5">Resolution Rate</th>
                <th className="px-5 py-3.5 text-right">Avg Fix Hours</th>
                <th className="px-5 py-3.5 text-right">Verified Fixes</th>
                <th className="px-5 py-3.5 text-right">Colony CivicPoints</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedStandings.map((row) => (
                <tr
                  key={row.ward}
                  className="transition-colors hover:bg-slate-50/80"
                >
                  <td className="px-5 py-4 font-mono text-xs font-bold tabular-nums text-slate-700">
                    #{row.rank}
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-900">{row.ward}</p>
                    <p className="text-xs text-slate-500">
                      {row.zone} · {row.topColony}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-2 w-24 overflow-hidden rounded-full bg-slate-100"
                        role="progressbar"
                        aria-label={`${row.ward} resolution rate ${row.resolutionRate}%`}
                        aria-valuenow={row.resolutionRate}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className={`h-full rounded-full ${
                            row.resolutionRate >= 85
                              ? "bg-emerald-600"
                              : row.resolutionRate >= 75
                                ? "bg-blue-600"
                                : "bg-amber-500"
                          }`}
                          style={{ width: `${row.resolutionRate}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs font-bold tabular-nums text-slate-900">
                        {row.resolutionRate}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-xs font-semibold tabular-nums text-slate-700">
                    {row.avgFixHours} hrs
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-xs font-semibold tabular-nums text-slate-700">
                    {row.verifiedFixes}
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-sm font-bold tabular-nums text-blue-700">
                    {row.civicPoints.toLocaleString("en-IN")} pts
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageTransition>
  );
}
