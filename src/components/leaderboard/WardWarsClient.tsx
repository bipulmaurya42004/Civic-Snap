"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { collection, getDocs, query, where } from "firebase/firestore";
import {
  ArrowUpDown,
  Award,
  Building2,
  Camera,
  CheckCircle2,
  Clock,
  MapPin,
  Medal,
  Search,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import {
  buildCitizenStarsLeaderboard,
  WARD_WARS_STANDINGS,
  type CitizenStarEntry,
} from "@/lib/bengaluru-feed-data";
import { db } from "@/lib/firebase";
import { HoverCard, PageTransition } from "@/components/ui/MotionPrimitives";

type LeaderboardTab = "wards" | "citizens";
type WardSortKey = "resolutionRate" | "avgFixHours" | "civicPoints";

interface LiveOptedInProfile {
  alias: string;
  civicPoints?: number;
  acceptedReportsCount?: number;
  resolvedReportsCount?: number;
  leaderboardOptIn?: boolean;
}

export function WardWarsClient() {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("wards");
  const [search, setSearch] = useState("");
  const [citizenSearch, setCitizenSearch] = useState("");
  const [sortKey, setSortKey] = useState<WardSortKey>("resolutionRate");
  const [liveProfiles, setLiveProfiles] = useState<LiveOptedInProfile[]>([]);

  useEffect(() => {
    if (!db) return;
    let cancelled = false;
    const q = query(
      collection(db, "public_profiles"),
      where("leaderboardOptIn", "==", true)
    );
    getDocs(q)
      .then((snap) => {
        if (cancelled) return;
        const parsed: LiveOptedInProfile[] = snap.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            alias: String(data.alias ?? ""),
            civicPoints:
              typeof data.civicPoints === "number" ? data.civicPoints : 0,
            acceptedReportsCount:
              typeof data.acceptedReportsCount === "number"
                ? data.acceptedReportsCount
                : 0,
            resolvedReportsCount:
              typeof data.resolvedReportsCount === "number"
                ? data.resolvedReportsCount
                : 0,
            leaderboardOptIn: Boolean(data.leaderboardOptIn),
          };
        });
        setLiveProfiles(parsed);
      })
      .catch(() => {
        // Pre-loaded Bengaluru Citizen Stars Top 10 remains immediately visible
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const citizenStarsTop10: CitizenStarEntry[] = useMemo(
    () => buildCitizenStarsLeaderboard(liveProfiles),
    [liveProfiles]
  );

  const filteredCitizens = useMemo(() => {
    const q = citizenSearch.trim().toLowerCase();
    if (!q) return citizenStarsTop10;
    return citizenStarsTop10.filter(
      (entry) =>
        entry.alias.toLowerCase().includes(q) ||
        entry.ward.toLowerCase().includes(q) ||
        entry.specialty.toLowerCase().includes(q)
    );
  }, [citizenStarsTop10, citizenSearch]);

  const citizenPodium = citizenStarsTop10.slice(0, 3);

  return (
    <PageTransition className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-wide text-blue-600">
            Bengaluru Pilot • Ward Wars &amp; Citizen Stars
          </p>
          <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Bengaluru CivicSnap Leaderboard
          </h1>
          <p className="mt-2.5 text-sm leading-6 text-slate-600 sm:text-base">
            Compare Bengaluru wards on live fix speed and resolution rates, or
            switch to{" "}
            <strong className="font-semibold text-slate-900">
              Citizen Stars
            </strong>{" "}
            to celebrate the top 10 residents earning the most CivicPoints.
          </p>
        </div>

        <Link
          href="/report"
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95 whitespace-nowrap"
        >
          <Camera size={16} aria-hidden="true" />
          <span>Boost Your Rank</span>
        </Link>
      </div>

      {/* Distinct Two-Tab Switcher: Ward Standings vs Citizen Stars */}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-2.5 shadow-sm">
        <div
          role="tablist"
          aria-label="Leaderboard view switcher"
          className="inline-flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100/90 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "wards"}
            onClick={() => setActiveTab("wards")}
            className={`relative inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === "wards"
                ? "text-blue-700"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {activeTab === "wards" && (
              <motion.span
                layoutId="leaderboardTabPill"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-lg bg-white shadow-xs"
              />
            )}
            <Building2 size={15} className="relative z-10" aria-hidden="true" />
            <span className="relative z-10">Ward Standings</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "citizens"}
            onClick={() => setActiveTab("citizens")}
            className={`relative inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === "citizens"
                ? "text-blue-700"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {activeTab === "citizens" && (
              <motion.span
                layoutId="leaderboardTabPill"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-lg bg-white shadow-xs"
              />
            )}
            <Users size={15} className="relative z-10" aria-hidden="true" />
            <span className="relative z-10">Citizen Stars</span>
            <span className="relative z-10 rounded-full bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-700">
              Top 10
            </span>
          </button>
        </div>

        <p className="px-2 text-xs text-slate-500">
          {activeTab === "wards"
            ? "7 active Bengaluru wards ranked by verified resolution speed"
            : "Top 10 opted-in Bengaluru residents ranked by total CivicPoints"}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "wards" ? (
          <motion.div
            key="ward-standings-panel"
            role="tabpanel"
            aria-label="Ward Standings"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {/* Top 3 Ward Podium Cards */}
            <section aria-label="Top three Bengaluru wards" className="mt-7">
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
                        <MapPin
                          size={12}
                          className="text-blue-600"
                          aria-hidden="true"
                        />
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
                            <Clock
                              size={14}
                              className="text-blue-600"
                              aria-hidden="true"
                            />
                            <span>{ward.avgFixHours} hrs</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-medium text-slate-500">
                            Colony CivicPoints
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 font-mono text-base font-bold tabular-nums text-blue-700">
                            <Sparkles size={14} aria-hidden="true" />
                            <span>
                              {ward.civicPoints.toLocaleString("en-IN")}
                            </span>
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
                    Ward Standings — All Bengaluru Pilot Wards
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Live resolution rate, fix speed, and CivicPoints earned by
                    colony residents
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
                      onChange={(e) =>
                        setSortKey(e.target.value as WardSortKey)
                      }
                      className="min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                    >
                      <option value="resolutionRate">
                        Resolution Rate (%)
                      </option>
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
                      <th className="px-5 py-3.5 text-right">
                        Colony CivicPoints
                      </th>
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
                          <p className="font-semibold text-slate-900">
                            {row.ward}
                          </p>
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
          </motion.div>
        ) : (
          <motion.div
            key="citizen-stars-panel"
            role="tabpanel"
            aria-label="Citizen Stars Top 10"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {/* Top 3 Citizen Stars Podium */}
            <section aria-label="Top three Citizen Stars" className="mt-7">
              <div className="grid gap-5 md:grid-cols-3">
                {citizenPodium.map((star, idx) => {
                  const isFirst = idx === 0;
                  const rankBadgeClass =
                    idx === 0
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : idx === 1
                        ? "bg-slate-100 text-slate-700 border-slate-200"
                        : "bg-orange-50 text-orange-700 border-orange-200";
                  return (
                    <HoverCard
                      key={star.alias}
                      className={`p-6 ${
                        isFirst ? "ring-1 ring-blue-600/20" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${rankBadgeClass}`}
                        >
                          {isFirst ? (
                            <Trophy size={13} aria-hidden="true" />
                          ) : (
                            <Award size={13} aria-hidden="true" />
                          )}
                          <span>#{star.rank} Citizen</span>
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                          {star.tierLabel}
                        </span>
                      </div>

                      <h2 className="mt-4 font-[var(--font-heading)] text-xl font-bold text-slate-900">
                        {star.alias}
                      </h2>
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <MapPin
                          size={12}
                          className="text-blue-600"
                          aria-hidden="true"
                        />
                        <span>
                          {star.ward} · {star.specialty}
                        </span>
                      </p>

                      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                        <div>
                          <p className="text-[11px] font-medium text-slate-500">
                            Verified Fixes
                          </p>
                          <p className="mt-0.5 font-mono text-base font-bold tabular-nums text-slate-900">
                            {star.verifiedFixes} fixes
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-medium text-slate-500">
                            CivicPoints
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 font-mono text-base font-bold tabular-nums text-blue-700">
                            <Sparkles size={14} aria-hidden="true" />
                            <span>
                              {star.civicPoints.toLocaleString("en-IN")} pts
                            </span>
                          </p>
                        </div>
                      </div>
                    </HoverCard>
                  );
                })}
              </div>
            </section>

            {/* Top 10 Personal CivicPoints Table */}
            <section
              aria-label="Top 10 Citizen Stars table"
              className="mt-8 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm"
            >
              <div className="flex flex-col justify-between gap-3 border-b border-slate-200/80 p-4 sm:flex-row sm:items-center sm:p-5">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Citizen Stars — Top 10 Personal CivicPoints Leaderboard
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Opted-in Bengaluru residents who earned the most CivicPoints
                    from verified street audits
                  </p>
                </div>

                <div className="relative">
                  <Search
                    size={15}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="search"
                    aria-label="Filter top citizens by alias or ward"
                    value={citizenSearch}
                    onChange={(e) => setCitizenSearch(e.target.value)}
                    placeholder="Search citizen or ward..."
                    className="min-h-[38px] w-52 rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                      <th className="px-5 py-3.5">Rank</th>
                      <th className="px-5 py-3.5">Citizen Alias &amp; Ward</th>
                      <th className="px-5 py-3.5">Civic Tier</th>
                      <th className="px-5 py-3.5 text-right">
                        Accepted Reports
                      </th>
                      <th className="px-5 py-3.5 text-right">Verified Fixes</th>
                      <th className="px-5 py-3.5 text-right">CivicPoints</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCitizens.map((entry) => (
                      <tr
                        key={entry.alias}
                        className="transition-colors hover:bg-slate-50/80"
                      >
                        <td className="px-5 py-4 font-mono text-xs font-bold tabular-nums text-slate-700">
                          #{entry.rank}
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">
                            {entry.alias}
                          </p>
                          <p className="text-xs text-slate-500">
                            {entry.ward} · {entry.specialty}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                            <Award size={11} aria-hidden="true" />
                            <span>{entry.tierLabel}</span>
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-xs font-semibold tabular-nums text-slate-700">
                          {entry.reportsAccepted}
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-xs font-semibold tabular-nums text-slate-700">
                          {entry.verifiedFixes}
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-sm font-bold tabular-nums text-blue-700">
                          {entry.civicPoints.toLocaleString("en-IN")} pts
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
