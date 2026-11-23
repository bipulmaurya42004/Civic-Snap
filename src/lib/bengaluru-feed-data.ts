import type { IssueCategory, IssueStatus } from "@/types/civic";

export interface BengaluruFeedIssue {
  id: string;
  title: string;
  streetAddress: string;
  ward: string;
  category: IssueCategory;
  status: IssueStatus;
  summary: string;
  imageUrl: string;
  imageAlt: string;
  beforeImageUrl?: string;
  afterImageUrl?: string;
  aiMatchPercent?: number;
  aiVerificationSummary?: string;
  lat: number;
  lng: number;
  highPriorityZone: boolean;
  priorityZoneLabel?: string;
  aiMaterialStat: string;
  estimatedRepairCost: string;
  socialImpactScore: number;
  upvotes: number;
  createdAt: string;
  aiVerified?: boolean;
  isLiveFirestore?: boolean;
}

export type FeedSortOrder = "newest" | "most_upvoted";

export interface BengaluruFeedFilters {
  search: string;
  category: IssueCategory | "all";
  status: IssueStatus | "all";
  ward: string;
  sort: FeedSortOrder;
}

export const FEED_STATUS_DISPLAY: Record<
  IssueStatus,
  { label: string; badgeClass: string }
> = {
  pending: {
    label: "Under Inspection",
    badgeClass:
      "bg-amber-50 text-amber-700 border border-amber-200 font-medium text-xs px-2.5 py-1 rounded-full",
  },
  in_progress: {
    label: "In Progress",
    badgeClass:
      "bg-blue-50 text-blue-700 border border-blue-200 font-medium text-xs px-2.5 py-1 rounded-full",
  },
  resolved: {
    label: "Verified Fixed",
    badgeClass:
      "bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium text-xs px-2.5 py-1 rounded-full",
  },
};

export const BENGALURU_FEED_ISSUES: readonly BengaluruFeedIssue[] = [
  {
    id: "CS-BLR-101",
    title: "100ft Road, Indiranagar — Severe Pothole near Chinmaya Mission Hospital",
    streetAddress: "100ft Road, HAL 2nd Stage, Indiranagar",
    ward: "Indiranagar",
    category: "pothole",
    status: "pending",
    summary:
      "Deep 2ft asphalt depression in the left ambulance approach lane causing sudden braking and two-wheeler skids right outside CMH Hospital.",
    imageUrl: "/demo/pothole.jpg",
    imageAlt: "Deep road pothole near Chinmaya Mission Hospital on 100ft Road Indiranagar",
    lat: 12.9789,
    lng: 77.6447,
    highPriorityZone: true,
    priorityZoneLabel: "High Priority (Hospital Zone)",
    aiMaterialStat: "~140 kg Asphalt required",
    estimatedRepairCost: "₹3,200 est. repair",
    socialImpactScore: 92,
    upvotes: 64,
    createdAt: "2026-11-22T08:40:00.000Z",
    aiVerified: false,
  },
  {
    id: "CS-BLR-102",
    title: "5th Block, Koramangala — Broken Streetlights near National Public School",
    streetAddress: "80 Feet Road, 5th Block, Koramangala",
    ward: "Koramangala",
    category: "streetlight",
    status: "in_progress",
    summary:
      "Three consecutive LED poles along the pedestrian stretch have been dark since Tuesday evening, creating low visibility for students and commuters.",
    imageUrl: "/demo/streetlight.jpg",
    imageAlt: "Unlit streetlight along twilight footpath in 5th Block Koramangala",
    lat: 12.9352,
    lng: 77.6245,
    highPriorityZone: true,
    priorityZoneLabel: "High Priority (School Zone)",
    aiMaterialStat: "3× 70W LED Fixtures · 2.5 labor hrs",
    estimatedRepairCost: "₹4,800 est. repair",
    socialImpactScore: 86,
    upvotes: 49,
    createdAt: "2026-11-21T17:15:00.000Z",
    aiVerified: false,
  },
  {
    id: "CS-BLR-103",
    title: "27th Main, HSR Layout — Overflowing Garbage Point near Sector 1 Market",
    streetAddress: "27th Main Rd, HSR Layout Sector 1",
    ward: "HSR Layout",
    category: "waste",
    status: "pending",
    summary:
      "Uncollected municipal waste bags and wet market cartons spilling across half the footpath outside the Sector 1 bus bay.",
    imageUrl: "/demo/waste.jpg",
    imageAlt: "Overflowing public waste collection bin on 27th Main HSR Layout",
    lat: 12.9121,
    lng: 77.6446,
    highPriorityZone: false,
    aiMaterialStat: "1 Compactor Load · 25L Disinfectant",
    estimatedRepairCost: "₹1,650 est. clearance",
    socialImpactScore: 78,
    upvotes: 38,
    createdAt: "2026-11-20T10:30:00.000Z",
    aiVerified: false,
  },
  {
    id: "CS-BLR-104",
    title: "12th Main Rd, Indiranagar — Resurfaced Road Edge near Primary School",
    streetAddress: "12th Main Rd, Indiranagar",
    ward: "Indiranagar",
    category: "pothole",
    status: "resolved",
    summary:
      "Cracked concrete curb and gravel crater resurfaced with hot-mix asphalt. Gemini Vision verified the contractor's repair photo at 94.8% match.",
    imageUrl: "/demo/pothole-fixed.jpg",
    imageAlt: "Freshly patched and smooth asphalt surface on 12th Main Rd Indiranagar",
    beforeImageUrl: "/demo/pothole.jpg",
    afterImageUrl: "/demo/pothole-fixed.jpg",
    aiMatchPercent: 94.8,
    aiVerificationSummary:
      "Same curb geometry and white lane marking confirmed. Gravel crater is fully compacted and sealed with fresh hot-mix asphalt flush to road grade.",
    lat: 12.9739,
    lng: 77.6461,
    highPriorityZone: true,
    priorityZoneLabel: "High Priority (School Zone)",
    aiMaterialStat: "~110 kg Hot-Mix Asphalt verified",
    estimatedRepairCost: "₹2,950 audited cost",
    socialImpactScore: 88,
    upvotes: 87,
    createdAt: "2026-11-19T11:20:00.000Z",
    aiVerified: true,
  },
  {
    id: "CS-BLR-105",
    title: "ITPL Main Rd, Whitefield — Deep Shoulder Crater near Manipal Hospital",
    streetAddress: "ITPL Main Rd, Whitefield",
    ward: "Whitefield",
    category: "pothole",
    status: "in_progress",
    summary:
      "Waterlogged edge crater slowing peak-hour IT corridor traffic and emergency vehicles approaching the Manipal Hospital junction.",
    imageUrl: "/demo/pothole.jpg",
    imageAlt: "Damaged asphalt road shoulder on ITPL Main Road Whitefield",
    lat: 12.9844,
    lng: 77.7279,
    highPriorityZone: true,
    priorityZoneLabel: "High Priority (Hospital Zone)",
    aiMaterialStat: "~180 kg Asphalt + Aggregate Base",
    estimatedRepairCost: "₹4,400 est. repair",
    socialImpactScore: 91,
    upvotes: 53,
    createdAt: "2026-11-18T14:50:00.000Z",
    aiVerified: false,
  },
  {
    id: "CS-BLR-106",
    title: "11th Main, Jayanagar 4th Block — Cleared Debris & Repaired Footpath",
    streetAddress: "11th Main Rd, Jayanagar 4th Block",
    ward: "Jayanagar",
    category: "waste",
    status: "resolved",
    summary:
      "Construction rubble and dumped tiles cleared from the pedestrian shoulder; footpath restored and AI verified.",
    imageUrl: "/demo/pothole-fixed.jpg",
    imageAlt: "Clean repaired street edge along 11th Main Road Jayanagar",
    beforeImageUrl: "/demo/waste.jpg",
    afterImageUrl: "/demo/pothole-fixed.jpg",
    aiMatchPercent: 92.4,
    aiVerificationSummary:
      "Construction rubble and overflowing curb bags completely cleared from the pedestrian shoulder; footpath swept and restored.",
    lat: 12.9308,
    lng: 77.5838,
    highPriorityZone: false,
    aiMaterialStat: "1 Tipper Pickup · 2 crew hours",
    estimatedRepairCost: "₹1,400 audited cost",
    socialImpactScore: 72,
    upvotes: 31,
    createdAt: "2026-11-16T09:10:00.000Z",
    aiVerified: true,
  },
] as const;

export function filterBengaluruFeed(
  items: readonly BengaluruFeedIssue[],
  filters: BengaluruFeedFilters,
  upvoteBoosts: Record<string, number> = {}
): BengaluruFeedIssue[] {
  const query = filters.search.trim().toLowerCase();

  const filtered = items.filter((item) => {
    if (filters.category !== "all" && item.category !== filters.category) {
      return false;
    }
    if (filters.status !== "all" && item.status !== filters.status) {
      return false;
    }
    if (filters.ward !== "all" && item.ward !== filters.ward) {
      return false;
    }
    if (query.length > 0) {
      const haystack = [
        item.id,
        item.title,
        item.streetAddress,
        item.ward,
        item.summary,
        item.aiMaterialStat,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });

  return [...filtered].sort((a, b) => {
    if (filters.sort === "most_upvoted") {
      const votesA = a.upvotes + (upvoteBoosts[a.id] ?? 0);
      const votesB = b.upvotes + (upvoteBoosts[b.id] ?? 0);
      return votesB - votesA || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export interface WardStanding {
  rank: number;
  ward: string;
  zone: string;
  resolutionRate: number;
  avgFixHours: number;
  verifiedFixes: number;
  openIssues: number;
  civicPoints: number;
  topColony: string;
}

export const WARD_WARS_STANDINGS: readonly WardStanding[] = [
  {
    rank: 1,
    ward: "Indiranagar",
    zone: "Bengaluru East",
    resolutionRate: 94,
    avgFixHours: 18,
    verifiedFixes: 412,
    openIssues: 26,
    civicPoints: 14820,
    topColony: "HAL 2nd Stage & 12th Main",
  },
  {
    rank: 2,
    ward: "HSR Layout",
    zone: "Bengaluru South-East",
    resolutionRate: 89,
    avgFixHours: 22,
    verifiedFixes: 368,
    openIssues: 45,
    civicPoints: 12450,
    topColony: "Sector 1 & 27th Main",
  },
  {
    rank: 3,
    ward: "Koramangala",
    zone: "Bengaluru South",
    resolutionRate: 86,
    avgFixHours: 25,
    verifiedFixes: 341,
    openIssues: 55,
    civicPoints: 11910,
    topColony: "4th & 5th Block",
  },
  {
    rank: 4,
    ward: "Jayanagar",
    zone: "Bengaluru South",
    resolutionRate: 82,
    avgFixHours: 29,
    verifiedFixes: 289,
    openIssues: 63,
    civicPoints: 9640,
    topColony: "4th Block Shopping Complex",
  },
  {
    rank: 5,
    ward: "Malleshwaram",
    zone: "Bengaluru West",
    resolutionRate: 79,
    avgFixHours: 31,
    verifiedFixes: 246,
    openIssues: 65,
    civicPoints: 8320,
    topColony: "8th Cross & Margosa Rd",
  },
  {
    rank: 6,
    ward: "Whitefield",
    zone: "Mahadevapura",
    resolutionRate: 74,
    avgFixHours: 38,
    verifiedFixes: 234,
    openIssues: 82,
    civicPoints: 7890,
    topColony: "ITPL Main & EPIP Zone",
  },
  {
    rank: 7,
    ward: "MG Road",
    zone: "Bengaluru Central",
    resolutionRate: 71,
    avgFixHours: 41,
    verifiedFixes: 190,
    openIssues: 78,
    civicPoints: 6410,
    topColony: "Church Street & Brigade Rd",
  },
] as const;

export interface CitizenStarEntry {
  rank: number;
  alias: string;
  ward: string;
  civicPoints: number;
  verifiedFixes: number;
  reportsAccepted: number;
  tierLabel: "City Guardian" | "Eco Warrior" | "Street Watcher";
  specialty: string;
}

export const CITIZEN_STARS_TOP_10: readonly CitizenStarEntry[] = [
  {
    rank: 1,
    alias: "IndiranagarRider",
    ward: "Indiranagar",
    civicPoints: 1420,
    verifiedFixes: 28,
    reportsAccepted: 34,
    tierLabel: "City Guardian",
    specialty: "Road & Hospital Zone Audits",
  },
  {
    rank: 2,
    alias: "HSRStreetWatch",
    ward: "HSR Layout",
    civicPoints: 1285,
    verifiedFixes: 25,
    reportsAccepted: 31,
    tierLabel: "City Guardian",
    specialty: "Sanitation & Footpath Safety",
  },
  {
    rank: 3,
    alias: "KoramangalaCivic",
    ward: "Koramangala",
    civicPoints: 1140,
    verifiedFixes: 22,
    reportsAccepted: 27,
    tierLabel: "City Guardian",
    specialty: "School Zone Streetlights",
  },
  {
    rank: 4,
    alias: "WhitefieldCommuter",
    ward: "Whitefield",
    civicPoints: 980,
    verifiedFixes: 19,
    reportsAccepted: 24,
    tierLabel: "City Guardian",
    specialty: "ITPL Corridor Potholes",
  },
  {
    rank: 5,
    alias: "JayanagarWalker",
    ward: "Jayanagar",
    civicPoints: 865,
    verifiedFixes: 17,
    reportsAccepted: 21,
    tierLabel: "City Guardian",
    specialty: "Pedestrian Kerb Repairs",
  },
  {
    rank: 6,
    alias: "MalleshwaramGuard",
    ward: "Malleshwaram",
    civicPoints: 790,
    verifiedFixes: 15,
    reportsAccepted: 19,
    tierLabel: "City Guardian",
    specialty: "Heritage Lane Lighting",
  },
  {
    rank: 7,
    alias: "MGRoadScout",
    ward: "MG Road",
    civicPoints: 710,
    verifiedFixes: 14,
    reportsAccepted: 17,
    tierLabel: "City Guardian",
    specialty: "Metro Approach Safety",
  },
  {
    rank: 8,
    alias: "UlsoorFixer",
    ward: "Indiranagar",
    civicPoints: 645,
    verifiedFixes: 12,
    reportsAccepted: 16,
    tierLabel: "City Guardian",
    specialty: "Drainage & Asphalt Audits",
  },
  {
    rank: 9,
    alias: "BellandurPulse",
    ward: "HSR Layout",
    civicPoints: 580,
    verifiedFixes: 11,
    reportsAccepted: 14,
    tierLabel: "City Guardian",
    specialty: "Lake Road Waste Clearance",
  },
  {
    rank: 10,
    alias: "SarjapurHelper",
    ward: "Koramangala",
    civicPoints: 515,
    verifiedFixes: 10,
    reportsAccepted: 13,
    tierLabel: "City Guardian",
    specialty: "Hinglish Voice Reporting",
  },
] as const;

export function buildCitizenStarsLeaderboard(
  liveProfiles: ReadonlyArray<{
    alias: string;
    civicPoints?: number;
    acceptedReportsCount?: number;
    resolvedReportsCount?: number;
    leaderboardOptIn?: boolean;
  }> = []
): CitizenStarEntry[] {
  const byAlias = new Map<string, CitizenStarEntry>();

  for (const base of CITIZEN_STARS_TOP_10) {
    byAlias.set(base.alias.toLowerCase(), base);
  }

  for (const profile of liveProfiles) {
    if (profile.leaderboardOptIn === false) continue;
    const pts = Math.max(0, Math.floor(profile.civicPoints ?? 0));
    if (pts <= 0 || !profile.alias.trim()) continue;
    const key = profile.alias.trim().toLowerCase();
    const tierLabel: CitizenStarEntry["tierLabel"] =
      pts > 200 ? "City Guardian" : pts > 50 ? "Eco Warrior" : "Street Watcher";
    byAlias.set(key, {
      rank: 0,
      alias: profile.alias.trim(),
      ward: "Bengaluru Pilot",
      civicPoints: pts,
      verifiedFixes: Math.max(0, profile.resolvedReportsCount ?? 0),
      reportsAccepted: Math.max(0, profile.acceptedReportsCount ?? 0),
      tierLabel,
      specialty: "Verified Live Contributor",
    });
  }

  return Array.from(byAlias.values())
    .sort(
      (a, b) =>
        b.civicPoints - a.civicPoints ||
        b.verifiedFixes - a.verifiedFixes ||
        a.alias.localeCompare(b.alias)
    )
    .slice(0, 10)
    .map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
    }));
}

export interface JudgeVerificationItem {
  id: string;
  title: string;
  ward: string;
  streetAddress: string;
  contractorName: string;
  lat: number;
  lng: number;
  highPriorityZone: boolean;
  priorityLabel: string;
  beforeImageUrl: string;
  afterImageUrl: string;
  aiMatchPercent: number;
  aiHeadline: string;
  aiSummary: string;
  materialClaimed: string;
  materialAudited: string;
  estimatedCost: string;
  reporterAlias: string;
  rewardPoints: number;
}

export const JUDGE_DEMO_VERIFICATIONS: readonly JudgeVerificationItem[] = [
  {
    id: "CS-AUDIT-901",
    title: "100ft Road Severe Pothole near Chinmaya Mission Hospital",
    ward: "Indiranagar",
    streetAddress: "100ft Road, Indiranagar",
    contractorName: "BBMP East RoadWorks Unit #4",
    lat: 12.9789,
    lng: 77.6447,
    highPriorityZone: true,
    priorityLabel: "Hospital Zone",
    beforeImageUrl: "/demo/pothole.jpg",
    afterImageUrl: "/demo/pothole-fixed.jpg",
    aiMatchPercent: 94.8,
    aiHeadline: "94.8% Match — Surface Repair Verified",
    aiSummary:
      "Same curb geometry and white lane marking confirmed. Gravel crater is fully compacted and sealed with fresh hot-mix asphalt flush to road grade.",
    materialClaimed: "145 kg hot-mix asphalt · 2L tack coat",
    materialAudited: "~140 kg hot-mix asphalt (Within 3.5% tolerance)",
    estimatedCost: "₹3,200",
    reporterAlias: "IndiranagarRider",
    rewardPoints: 50,
  },
  {
    id: "CS-AUDIT-902",
    title: "12th Main Pedestrian Apron Concrete Patch",
    ward: "Indiranagar",
    streetAddress: "12th Main Rd, Indiranagar",
    contractorName: "Ward 80 Civil Maintenance Crew",
    lat: 12.9739,
    lng: 77.6461,
    highPriorityZone: true,
    priorityLabel: "School Zone",
    beforeImageUrl: "/demo/pothole.jpg",
    afterImageUrl: "/demo/pothole-fixed.jpg",
    aiMatchPercent: 91.6,
    aiHeadline: "91.6% Match — Surface Repair Verified",
    aiSummary:
      "Broken pavement edge cleared of loose debris and leveled smoothly alongside the school crossing kerb.",
    materialClaimed: "110 kg rapid-set mortar · 1.5L primer",
    materialAudited: "~105 kg mortar + aggregate (Verified)",
    estimatedCost: "₹2,750",
    reporterAlias: "CivicWalker",
    rewardPoints: 50,
  },
  {
    id: "CS-AUDIT-903",
    title: "80ft Road Footpath Garbage Clearance Audit",
    ward: "Koramangala",
    streetAddress: "80 Feet Rd, Koramangala 4th Block",
    contractorName: "South Zone Solid Waste Contractor",
    lat: 12.9352,
    lng: 77.6245,
    highPriorityZone: true,
    priorityLabel: "Hospital / School Zone",
    beforeImageUrl: "/demo/waste.jpg",
    afterImageUrl: "/demo/waste.jpg",
    aiMatchPercent: 38.4,
    aiHeadline: "38.4% Match — Duplicate Photo Flagged",
    aiSummary:
      "After photo shows identical overflowing bags and cardboard at the curb. Recommend rejecting contractor claim and keeping issue In Progress.",
    materialClaimed: "1 Compactor pickup + sanitization",
    materialAudited: "No visible clearance detected — Flagged for re-inspection",
    estimatedCost: "₹1,650 (Held)",
    reporterAlias: "KoramangalaWatch",
    rewardPoints: 50,
  },
] as const;

/**
 * Generates a deterministic 9x9 QR-like verification matrix from a coupon code
 * so merchant verification modals render crisp scannable visuals with pure CSS blocks.
 */
export function generateQrMatrix(code: string): boolean[][] {
  const size = 9;
  let hash = 2166136261;
  for (let i = 0; i < code.length; i += 1) {
    hash ^= code.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const grid: boolean[][] = [];
  for (let r = 0; r < size; r += 1) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c += 1) {
      // 3x3 finder patterns in top-left, top-right, bottom-left corners
      const inTopLeft = r < 3 && c < 3;
      const inTopRight = r < 3 && c >= size - 3;
      const inBottomLeft = r >= size - 3 && c < 3;
      if (inTopLeft || inTopRight || inBottomLeft) {
        const localR = inBottomLeft ? r - (size - 3) : r;
        const localC = inTopRight ? c - (size - 3) : c;
        const isBorder =
          localR === 0 || localR === 2 || localC === 0 || localC === 2;
        const isCenter = localR === 1 && localC === 1;
        row.push(isBorder || isCenter);
      } else {
        const bitIndex = (r * size + c) % 31;
        const mixed = Math.imul(hash ^ (r * 31 + c * 17), 2654435761) >>> 0;
        row.push(((mixed >>> bitIndex) & 1) === 1);
      }
    }
    grid.push(row);
  }
  return grid;
}
