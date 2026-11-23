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
  Crown,
  Landmark,
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
import {
  ANNUAL_CM_SEASON_CLOSE_LABEL,
  ANNUAL_CM_SEASON_YEAR,
} from "@/lib/civic-honors";
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
      {/* Top Prestige Banner — Compete for the Annual CM Civic Champions Award */}
      <section
        aria-label="Annual CM Civic Champions Award Banner"
        className="mb-8 rounded-2xl border border-amber-300/90 bg-gradient-to-r from-amber-50/80 via-white to-blue-50/70 p-5 shadow-sm sm:p-6"
      >
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100/80 px-3 py-1 text-xs font-bold text-amber-900">
              <Landmark size={13} aria-hidden="true" />
              <span>
                Annual Urban Governance Summit • Season Closes{" "}
                {ANNUAL_CM_SEASON_CLOSE_LABEL}, {ANNUAL_CM_SEASON_YEAR}
              </span>
            </span>
            <h1 className="mt-2.5 font-[var(--font-heading)] text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Compete for the Annual CM Civic Champions Award
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
              Track Bengaluru Ward Standings across Indiranagar, HSR Layout, and
              Koramangala — or inspect the{" "}
              <strong className="font-semibold text-slate-900">
                Citizen Stars (Annual CM Race)
              </strong>{" "}
              where the Top 5 stewards earn felicitation by the Hon&apos;ble
              Chief Minister, a State Civic Medal, and a 1-year Honorary Civic
              Warden designation.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <Link
              href="/rewards"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-50 whitespace-nowrap"
            >
              <Award size={16} aria-hidden="true" className="text-amber-600" />
              <span>My Civic Honors</span>
            </Link>
            <Link
              href="/report"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95 whitespace-nowrap"
            >
              <Camera size={16} aria-hidden="true" />
              <span>Earn +50 Merit Pts</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Distinct Two-Tab Switcher: Ward Standings vs Citizen Stars (Annual CM Race) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-2.5 shadow-sm">
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
                ? "text-amber-800"
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
            <Crown
              size={15}
              className="relative z-10 text-amber-600"
              aria-hidden="true"
            />
            <span className="relative z-10">
              Citizen Stars (Annual CM Race)
            </span>
            <span className="relative z-10 rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-800">
              Top 5 Podium
            </span>
          </button>
        </div>

        <p className="px-2 text-xs text-slate-500">
          {activeTab === "wards"
            ? "Indiranagar vs HSR Layout vs Koramangala · Live resolution rate & speed"
            : "Top 5 citizens qualify for the Chief Minister's Annual Civic Champions Podium"}
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
                      ? "bg-amber-50 text-amber-800 border-amber-300"
                      : idx === 1
                        ? "bg-slate-100 text-slate-700 border-slate-200"
                        : "bg-orange-50 text-orange-700 border-orange-200";

                  return (
                    <HoverCard
                      key={ward.ward}
                      className={`p-6 ${
                        isFirst ? "border-amber-300 ring-1 ring-amber-400/25" : ""
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
                            Ward Merit Points
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
                    Live resolution rate, repair turnaround speed, and verified
                    Merit Points by ward
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
                      <option value="civicPoints">Most Merit Points</option>
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
                        Ward Merit Points
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
            aria-label="Citizen Stars Annual CM Race"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {/* Top 3 CM Contenders Podium */}
            <section
              aria-label="Top three CM Civic Champions Contenders"
              className="mt-7"
            >
              <div className="grid gap-5 md:grid-cols-3">
                {citizenPodium.map((star, idx) => {
                  const isFirst = idx === 0;
                  return (
                    <HoverCard
                      key={star.alias}
                      className={`border-amber-300/90 bg-gradient-to-b from-amber-50/45 via-white to-white p-6 ${
                        isFirst
                          ? "shadow-md shadow-amber-500/10 ring-1 ring-amber-400/40"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100/90 px-3 py-1 text-xs font-bold text-amber-900">
                          <Crown size={13} aria-hidden="true" />
                          <span>#{star.rank} CM Contender</span>
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                          {star.tierLabel}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-100 font-[var(--font-heading)] text-sm font-bold text-amber-950"
                        >
                          {star.initials}
                        </span>
                        <div className="min-w-0">
                          <h2 className="truncate font-[var(--font-heading)] text-lg font-bold text-slate-900">
                            {star.alias}
                          </h2>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                            <MapPin
                              size={12}
                              className="text-blue-600"
                              aria-hidden="true"
                            />
                            <span className="truncate">
                              {star.ward} · {star.specialty}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-amber-200/60 pt-4">
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
                            Merit Points
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 font-mono text-base font-bold tabular-nums text-amber-800">
                            <Trophy size={14} aria-hidden="true" />
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

            {/* Top 10 Personal Citizen Stars Table (Top 5 Highlighted with Gold/Amber Glow & CM Contender Badge) */}
            <section
              aria-label="Citizen Stars Annual CM Race table"
              className="mt-8 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm"
            >
              <div className="flex flex-col justify-between gap-3 border-b border-slate-200/80 p-4 sm:flex-row sm:items-center sm:p-5">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                    <Users size={16} className="text-blue-600" aria-hidden="true" />
                    <span>
                      Citizen Stars (Annual CM Race) — Top 10 Bengaluru Stewards
                    </span>
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Highlighted Top 5 contenders currently qualify for
                    felicitation by the Hon&apos;ble Chief Minister at year-end.
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
                <table className="w-full min-w-[740px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                      <th className="px-5 py-3.5">Rank</th>
                      <th className="px-5 py-3.5">Citizen &amp; Ward</th>
                      <th className="px-5 py-3.5">Honors Status</th>
                      <th className="px-5 py-3.5 text-right">Verified Fixes</th>
                      <th className="px-5 py-3.5 text-right">Total Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCitizens.map((entry) => {
                      const isTop5 = entry.isCmContender || entry.rank <= 5;
                      return (
                        <tr
                          key={entry.alias}
                          data-testid={
                            isTop5
                              ? `cm-contender-row-${entry.rank}`
                              : `citizen-row-${entry.rank}`
                          }
                          className={
                            isTop5
                              ? "bg-gradient-to-r from-amber-50/80 via-amber-50/35 to-white shadow-[inset_0_0_0_1px_rgba(245,158,11,0.45)] transition-colors hover:from-amber-50"
                              : "transition-colors hover:bg-slate-50/80"
                          }
                        >
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg font-mono text-xs font-bold tabular-nums ${
                                isTop5
                                  ? "border border-amber-300 bg-amber-100 text-amber-950 shadow-xs"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              #{entry.rank}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <span
                                aria-hidden="true"
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                  isTop5
                                    ? "border-2 border-amber-400 bg-amber-100 text-amber-950"
                                    : "border border-slate-200 bg-slate-100 text-slate-700"
                                }`}
                              >
                                {entry.initials}
                              </span>
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {entry.alias}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {entry.ward} · {entry.specialty}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {isTop5 ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900 shadow-xs">
                                  <Crown size={12} aria-hidden="true" />
                                  <span>CM Contender</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                                  <Award size={11} aria-hidden="true" />
                                  <span>{entry.tierLabel}</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right font-mono text-xs font-bold tabular-nums text-slate-800">
                            {entry.verifiedFixes} verified
                          </td>
                          <td className="px-5 py-4 text-right font-mono text-sm font-bold tabular-nums text-blue-700">
                            <span className={isTop5 ? "text-amber-900" : ""}>
                              {entry.civicPoints.toLocaleString("en-IN")} pts
                            </span>
                          </td>
                        </tr>
                      );
                    })}
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
