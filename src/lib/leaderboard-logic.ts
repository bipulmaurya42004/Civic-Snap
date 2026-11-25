export interface PilotWardMetadata {
  ward: string;
  zone: string;
  topColony: string;
}

/**
 * Real Bengaluru pilot ward directory (metadata only — ZERO hardcoded counts or fake points).
 */
export const PILOT_WARD_CATALOG: readonly PilotWardMetadata[] = [
  {
    ward: "Indiranagar",
    zone: "Bengaluru East",
    topColony: "HAL 2nd Stage & 12th Main",
  },
  {
    ward: "HSR Layout",
    zone: "Bengaluru South-East",
    topColony: "Sector 1 & 27th Main",
  },
  {
    ward: "Koramangala",
    zone: "Bengaluru South",
    topColony: "4th & 5th Block",
  },
  {
    ward: "Jayanagar",
    zone: "Bengaluru South",
    topColony: "4th Block Shopping Complex",
  },
  {
    ward: "Malleshwaram",
    zone: "Bengaluru West",
    topColony: "8th Cross & Margosa Rd",
  },
  {
    ward: "Whitefield",
    zone: "Mahadevapura",
    topColony: "ITPL Main & EPIP Zone",
  },
  {
    ward: "MG Road",
    zone: "Bengaluru Central",
    topColony: "Church Street & Brigade Rd",
  },
] as const;

export interface RawFirestoreCitizenProfile {
  uid: string;
  displayName?: string | null;
  alias?: string | null;
  photoURL?: string | null;
  points?: number | null;
  civicPoints?: number | null;
  resolvedCount?: number | null;
  resolvedReportsCount?: number | null;
  reportsCount?: number | null;
  acceptedReportsCount?: number | null;
}

export interface LiveCitizenLeaderboardEntry {
  uid: string;
  rank: number;
  isRanked: boolean;
  rankLabel: string;
  displayName: string;
  alias: string;
  initials: string;
  photoURL: string;
  points: number;
  verifiedFixes: number;
  reportsCount: number;
  isCurrentUser: boolean;
  isShortlistEligible: boolean;
  tierLabel:
    | "Civic Vanguard Laureate"
    | "Bengaluru Civic Vanguard"
    | "Infrastructure Audit Guardian"
    | "Bengaluru Urban Sentinel"
    | "Ward Scout";
}

export interface DynamicTop5Standing {
  rankedCitizensCount: number;
  top5CutoffPoints: number;
  userRank: number | null;
  userRankLabel: string;
  isPioneerZone: boolean;
  isTop5Finalist: boolean;
  pointsToTop5: number;
  progressPercent: number;
}

export interface RawFirestoreIssueForWard {
  id: string;
  ward?: string | null;
  locality?: string | null;
  status?: string | null;
}

export interface LiveWardStanding {
  rank: number;
  ward: string;
  zone: string;
  topColony: string;
  totalReports: number;
  verifiedFixes: number;
  wardPoints: number;
  resolutionRate: number;
}

export type LiveWardSortKey =
  | "wardPoints"
  | "verifiedFixes"
  | "totalReports"
  | "resolutionRate";

function toNonNegativeInt(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.floor(value);
}

export function extractInitials(name: string): string {
  const tokens = name
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length >= 2) {
    return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
  }
  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase();
  }
  return "CS";
}

export function getCitizenTierLabel(
  points: number,
  verifiedFixes: number,
  rank: number
): LiveCitizenLeaderboardEntry["tierLabel"] {
  if (rank <= 5 && (points > 0 || verifiedFixes > 0)) {
    return "Civic Vanguard Laureate";
  }
  if (verifiedFixes >= 15 || points >= 750) {
    return "Bengaluru Civic Vanguard";
  }
  if (verifiedFixes >= 10 || points >= 500) {
    return "Infrastructure Audit Guardian";
  }
  if (verifiedFixes >= 5 || points >= 250) {
    return "Bengaluru Urban Sentinel";
  }
  return "Ward Scout";
}

/**
 * Pure citizen leaderboard builder driven strictly by live Firestore records.
 * Zero mock or hardcoded citizens are ever injected.
 * Citizens with 0 points are explicitly labeled "Unranked".
 */
export function buildLiveCitizenLeaderboard(
  firestoreProfiles: readonly RawFirestoreCitizenProfile[],
  currentUserProfile?: RawFirestoreCitizenProfile | null,
  maxEntries = 20
): {
  entries: LiveCitizenLeaderboardEntry[];
  hasAnyVerifiedFixes: boolean;
} {
  const byUid = new Map<string, RawFirestoreCitizenProfile>();

  for (const profile of firestoreProfiles) {
    const uid = String(profile.uid ?? "").trim();
    if (!uid) continue;
    byUid.set(uid, profile);
  }

  const currentUid = currentUserProfile?.uid?.trim() ?? "";
  if (currentUid && currentUserProfile) {
    const existing = byUid.get(currentUid);
    if (!existing) {
      byUid.set(currentUid, currentUserProfile);
    } else {
      // Merge fresher displayName / photoURL / points from the user's own private profile
      byUid.set(currentUid, {
        ...existing,
        displayName:
          currentUserProfile.displayName || existing.displayName || existing.alias,
        alias: currentUserProfile.alias || existing.alias,
        photoURL: currentUserProfile.photoURL || existing.photoURL,
        points: Math.max(
          toNonNegativeInt(existing.points),
          toNonNegativeInt(existing.civicPoints),
          toNonNegativeInt(currentUserProfile.points),
          toNonNegativeInt(currentUserProfile.civicPoints)
        ),
        resolvedCount: Math.max(
          toNonNegativeInt(existing.resolvedCount),
          toNonNegativeInt(existing.resolvedReportsCount),
          toNonNegativeInt(currentUserProfile.resolvedCount),
          toNonNegativeInt(currentUserProfile.resolvedReportsCount)
        ),
        reportsCount: Math.max(
          toNonNegativeInt(existing.reportsCount),
          toNonNegativeInt(existing.acceptedReportsCount),
          toNonNegativeInt(currentUserProfile.reportsCount),
          toNonNegativeInt(currentUserProfile.acceptedReportsCount)
        ),
      });
    }
  }

  const normalized = Array.from(byUid.values()).map((profile) => {
    const alias =
      (profile.alias ?? "").replace(/\s+/g, " ").trim() ||
      (profile.displayName ?? "").replace(/\s+/g, " ").trim() ||
      "Bengaluru Citizen";
    const displayName =
      (profile.displayName ?? "").replace(/\s+/g, " ").trim() || alias;
    const rawPhoto = (profile.photoURL ?? "").trim();
    const photoURL = rawPhoto.startsWith("https://") ? rawPhoto : "";
    const points = Math.max(
      toNonNegativeInt(profile.points),
      toNonNegativeInt(profile.civicPoints)
    );
    const verifiedFixes = Math.max(
      toNonNegativeInt(profile.resolvedCount),
      toNonNegativeInt(profile.resolvedReportsCount)
    );
    const reportsCount = Math.max(
      toNonNegativeInt(profile.reportsCount),
      toNonNegativeInt(profile.acceptedReportsCount),
      verifiedFixes
    );

    return {
      uid: profile.uid,
      displayName,
      alias,
      initials: extractInitials(displayName),
      photoURL,
      points,
      verifiedFixes,
      reportsCount,
      isCurrentUser: Boolean(currentUid && profile.uid === currentUid),
    };
  });

  normalized.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.verifiedFixes !== a.verifiedFixes) {
      return b.verifiedFixes - a.verifiedFixes;
    }
    if (b.reportsCount !== a.reportsCount) {
      return b.reportsCount - a.reportsCount;
    }
    // Keep currently signed-in user visible at top among 0-point ties
    if (a.isCurrentUser !== b.isCurrentUser) {
      return a.isCurrentUser ? -1 : 1;
    }
    return a.displayName.localeCompare(b.displayName);
  });

  const sliced = normalized.slice(0, Math.max(1, maxEntries));
  const entries: LiveCitizenLeaderboardEntry[] = sliced.map((item, idx) => {
    const rank = idx + 1;
    const isRanked = item.points > 0;
    const rankLabel = isRanked ? `#${rank}` : "Unranked";
    const isShortlistEligible = isRanked && rank <= 5;
    return {
      ...item,
      rank,
      isRanked,
      rankLabel,
      isShortlistEligible,
      tierLabel: getCitizenTierLabel(item.points, item.verifiedFixes, rank),
    };
  });

  const hasAnyVerifiedFixes = entries.some(
    (entry) => entry.points > 0 || entry.verifiedFixes > 0
  );

  return { entries, hasAnyVerifiedFixes };
}

/**
 * Computes real-time Top 5 cutoff and exact user rank strictly from live Firestore profiles.
 * Never returns hardcoded Rank #120 or hardcoded 1,100 cutoff points.
 */
export function computeDynamicTop5Standing(
  firestoreProfiles: readonly RawFirestoreCitizenProfile[],
  currentUserProfile?: RawFirestoreCitizenProfile | null
): DynamicTop5Standing {
  const { entries } = buildLiveCitizenLeaderboard(
    firestoreProfiles,
    currentUserProfile,
    500
  );

  const rankedCitizens = entries.filter((e) => e.points > 0);
  const rankedCitizensCount = rankedCitizens.length;
  const top5CutoffPoints =
    rankedCitizensCount >= 5 ? (rankedCitizens[4]?.points ?? 0) : 0;

  const currentUid = currentUserProfile?.uid?.trim() ?? "";
  const currentEntry = currentUid
    ? entries.find((e) => e.uid === currentUid)
    : undefined;
  const userPoints = currentEntry?.points ?? 0;

  const userRank =
    currentEntry && currentEntry.points > 0
      ? rankedCitizens.findIndex((e) => e.uid === currentEntry.uid) + 1
      : null;

  const userRankLabel = userRank !== null ? `Rank #${userRank}` : "Unranked";
  const isPioneerZone = userPoints <= 0 || rankedCitizensCount < 5;
  const isTop5Finalist = userRank !== null && userRank <= 5;

  const pointsToTop5 =
    isTop5Finalist || top5CutoffPoints === 0
      ? 0
      : Math.max(0, top5CutoffPoints - userPoints);

  const progressPercent = isTop5Finalist
    ? 100
    : top5CutoffPoints === 0
      ? 0
      : Math.min(99, Math.round((userPoints / top5CutoffPoints) * 100));

  return {
    rankedCitizensCount,
    top5CutoffPoints,
    userRank,
    userRankLabel,
    isPioneerZone,
    isTop5Finalist,
    pointsToTop5,
    progressPercent,
  };
}

export function isResolvedIssueStatus(status: string | null | undefined): boolean {
  const normalized = (status ?? "").trim().toLowerCase();
  return (
    normalized === "resolved" ||
    normalized === "verified_fixed" ||
    normalized === "verified fixed"
  );
}

export function normalizeWardName(rawWard: string | null | undefined): string | null {
  const cleaned = (rawWard ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  const lower = cleaned.toLowerCase();
  for (const pilot of PILOT_WARD_CATALOG) {
    if (
      lower === pilot.ward.toLowerCase() ||
      lower.includes(pilot.ward.toLowerCase())
    ) {
      return pilot.ward;
    }
  }
  return cleaned.slice(0, 60);
}

/**
 * Pure dynamic Ward Standings aggregator computed strictly from live Firestore issues.
 * Formula:
 * - Total Reports = count of real issues in that ward
 * - Verified Fixes = count of issues where status is Resolved / Verified_Fixed
 * - Ward Points = Verified Fixes * 50
 */
export function aggregateLiveWardStandings(
  issues: readonly RawFirestoreIssueForWard[],
  sortKey: LiveWardSortKey = "wardPoints"
): LiveWardStanding[] {
  const wardBuckets = new Map<
    string,
    {
      ward: string;
      zone: string;
      topColony: string;
      totalReports: number;
      verifiedFixes: number;
    }
  >();

  // Initialize pilot wards at strictly 0 (zero fictional numbers)
  for (const pilot of PILOT_WARD_CATALOG) {
    wardBuckets.set(pilot.ward, {
      ward: pilot.ward,
      zone: pilot.zone,
      topColony: pilot.topColony,
      totalReports: 0,
      verifiedFixes: 0,
    });
  }

  // Deduplicate issues by document id
  const seenIds = new Set<string>();
  for (const issue of issues) {
    const id = String(issue.id ?? "").trim();
    if (id && seenIds.has(id)) continue;
    if (id) seenIds.add(id);

    const ward = normalizeWardName(issue.ward || issue.locality);
    if (!ward) continue;

    const existing = wardBuckets.get(ward) ?? {
      ward,
      zone: "Bengaluru",
      topColony: "Live Citizen Audits",
      totalReports: 0,
      verifiedFixes: 0,
    };

    existing.totalReports += 1;
    if (isResolvedIssueStatus(issue.status)) {
      existing.verifiedFixes += 1;
    }
    wardBuckets.set(ward, existing);
  }

  const rows = Array.from(wardBuckets.values()).map((bucket) => {
    const wardPoints = bucket.verifiedFixes * 50;
    const resolutionRate =
      bucket.totalReports > 0
        ? Math.round((bucket.verifiedFixes / bucket.totalReports) * 100)
        : 0;
    return {
      ...bucket,
      wardPoints,
      resolutionRate,
    };
  });

  rows.sort((a, b) => {
    if (sortKey === "verifiedFixes" && b.verifiedFixes !== a.verifiedFixes) {
      return b.verifiedFixes - a.verifiedFixes;
    }
    if (sortKey === "totalReports" && b.totalReports !== a.totalReports) {
      return b.totalReports - a.totalReports;
    }
    if (sortKey === "resolutionRate" && b.resolutionRate !== a.resolutionRate) {
      return b.resolutionRate - a.resolutionRate;
    }
    if (b.wardPoints !== a.wardPoints) return b.wardPoints - a.wardPoints;
    if (b.verifiedFixes !== a.verifiedFixes) {
      return b.verifiedFixes - a.verifiedFixes;
    }
    if (b.totalReports !== a.totalReports) {
      return b.totalReports - a.totalReports;
    }
    return a.ward.localeCompare(b.ward);
  });

  return rows.map((row, idx) => ({
    rank: idx + 1,
    ...row,
  }));
}
