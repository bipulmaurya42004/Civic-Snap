import {
  ISSUE_CATEGORIES,
  STATUS_LABELS,
  type CivicLevelBadgeInfo,
  type ContributorProfile,
  type DashboardMetrics,
  type DateRangeFilter,
  type IssueCategory,
  type IssueFilterState,
  type IssueStatus,
  type LeaderboardEntry,
  type PublicIssueRecord,
  type ReviewState,
  type RewardItem,
} from "@/types/civic";

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
] as const;
export const ALLOWED_PHOTO_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".gif",
] as const;
export const POINTS_PER_ACCEPTED_REPORT = 10;
export const POINTS_PER_RESOLVED_REPORT = 25;

export function getCategoryLabel(category: IssueCategory): string {
  return (
    ISSUE_CATEGORIES.find((item) => item.value === category)?.label ??
    "Other / Unsure"
  );
}

export function getStatusLabel(status: IssueStatus): string {
  return STATUS_LABELS[status];
}

export function formatCivicDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatCivicDateTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "Timestamp unavailable";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Returns a neutral pending-age badge string (e.g. "Pending for 3 days")
 * for non-resolved reports, or null if resolved.
 */
export function getPendingAgeLabel(
  status: IssueStatus,
  createdAt: string,
  referenceDate: Date = new Date()
): string | null {
  if (status === "resolved") {
    return null;
  }
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) {
    return null;
  }
  const diffMs = Math.max(0, referenceDate.getTime() - created.getTime());
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) {
    return status === "pending" ? "Pending since today" : "Active since today";
  }
  const dayUnit = days === 1 ? "day" : "days";
  if (status === "pending") {
    return `Pending for ${days} ${dayUnit}`;
  }
  return `In progress · ${days} ${dayUnit} open`;
}

export function filterAndSortIssues(
  issues: readonly PublicIssueRecord[],
  filters: IssueFilterState
): PublicIssueRecord[] {
  const query = filters.search.trim().toLowerCase();

  const filtered = issues.filter((issue) => {
    if (filters.category !== "all" && issue.category !== filters.category) {
      return false;
    }
    if (filters.status !== "all" && issue.status !== filters.status) {
      return false;
    }
    if (filters.area !== "all" && issue.locality !== filters.area) {
      return false;
    }
    if (query.length > 0) {
      const searchable = [
        issue.id,
        issue.title,
        issue.locality,
        issue.detectedAddress ?? "",
        issue.publicSummary,
        getCategoryLabel(issue.category),
      ]
        .join(" ")
        .toLowerCase();
      if (!searchable.includes(query)) {
        return false;
      }
    }
    return true;
  });

  return [...filtered].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return filters.sort === "newest" ? timeB - timeA : timeA - timeB;
  });
}

export function paginateIssues(
  issues: readonly PublicIssueRecord[],
  visibleCount: number
): { items: PublicIssueRecord[]; hasMore: boolean; remaining: number } {
  const safeCount = Math.max(0, visibleCount);
  const items = issues.slice(0, safeCount);
  const remaining = Math.max(0, issues.length - items.length);
  return {
    items,
    hasMore: remaining > 0,
    remaining,
  };
}

export function filterIssuesByDateRange(
  issues: readonly PublicIssueRecord[],
  dateRange: DateRangeFilter,
  referenceDate: Date = new Date()
): PublicIssueRecord[] {
  if (dateRange === "all") {
    return [...issues];
  }
  const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
  const cutoffMs = referenceDate.getTime() - days * 24 * 60 * 60 * 1000;
  return issues.filter((issue) => new Date(issue.createdAt).getTime() >= cutoffMs);
}

export function computeDashboardMetrics(
  issues: readonly PublicIssueRecord[]
): DashboardMetrics {
  const total = issues.length;
  let pending = 0;
  let inProgress = 0;
  let resolved = 0;

  const categoryCounts = new Map<IssueCategory, number>();
  for (const cat of ISSUE_CATEGORIES) {
    categoryCounts.set(cat.value, 0);
  }

  const areaCounts = new Map<string, number>();

  for (const issue of issues) {
    if (issue.status === "pending") pending += 1;
    else if (issue.status === "in_progress") inProgress += 1;
    else if (issue.status === "resolved") resolved += 1;

    categoryCounts.set(
      issue.category,
      (categoryCounts.get(issue.category) ?? 0) + 1
    );
    areaCounts.set(issue.locality, (areaCounts.get(issue.locality) ?? 0) + 1);
  }

  const byCategory = ISSUE_CATEGORIES.map((cat) => ({
    category: cat.value,
    label: cat.label,
    count: categoryCounts.get(cat.value) ?? 0,
  }));

  const byArea = Array.from(areaCounts.entries())
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count || a.area.localeCompare(b.area));

  const pct = (value: number) =>
    total === 0 ? 0 : Math.round((value / total) * 100);

  const statusDistribution: DashboardMetrics["statusDistribution"] = [
    {
      status: "pending",
      label: STATUS_LABELS.pending,
      count: pending,
      percentage: pct(pending),
    },
    {
      status: "in_progress",
      label: STATUS_LABELS.in_progress,
      count: inProgress,
      percentage: pct(inProgress),
    },
    {
      status: "resolved",
      label: STATUS_LABELS.resolved,
      count: resolved,
      percentage: pct(resolved),
    },
  ];

  return {
    total,
    pending,
    inProgress,
    resolved,
    byCategory,
    byArea,
    statusDistribution,
  };
}

/**
 * Computes CivicPoints credited for a single report:
 * - Unreviewed, Duplicate, or Rejected: 0 pts
 * - Accepted (Pending / In Progress): 10 pts
 * - Resolved (Accepted + Resolved): 25 pts
 */
export function computeReportCivicPoints(
  status: IssueStatus,
  reviewState: ReviewState,
  duplicateOfId?: string | null
): number {
  if (reviewState !== "accepted" || duplicateOfId) {
    return 0;
  }
  if (status === "resolved") {
    return POINTS_PER_RESOLVED_REPORT;
  }
  return POINTS_PER_ACCEPTED_REPORT;
}

/**
 * Computes the idempotent CivicPoints delta when an admin changes a report's
 * status or review state so repeat saves never double-award points.
 */
export function computeCivicPointsDelta(
  previousPointsAwarded: number,
  nextStatus: IssueStatus,
  nextReviewState: ReviewState,
  duplicateOfId?: string | null
): number {
  const prev = Math.max(0, Math.floor(previousPointsAwarded || 0));
  const target = computeReportCivicPoints(
    nextStatus,
    nextReviewState,
    duplicateOfId
  );
  return target - prev;
}

/**
 * Maps a user's CivicPoints total to the requested CivicSnap Level Badge tiers:
 * - 0–50 pts: Bronze (Street Watcher)
 * - 51–200 pts: Silver (Eco Warrior)
 * - 200+ pts (201+): Gold (City Guardian)
 */
export function getCivicLevelBadge(rawPoints: number): CivicLevelBadgeInfo {
  const points = Math.max(0, Math.floor(rawPoints || 0));

  if (points > 200) {
    return {
      tier: "gold",
      label: "Gold",
      rankTitle: "City Guardian",
      minPoints: 201,
      maxPoints: null,
      nextTierLabel: null,
      nextTierPoints: null,
      pointsToNext: 0,
      progressPercent: 100,
      tagline: "Top civic contributor protecting and improving local neighbourhoods.",
    };
  }

  if (points >= 51) {
    const span = 201 - 51;
    const progressPercent = Math.min(
      100,
      Math.round(((points - 51) / span) * 100)
    );
    return {
      tier: "silver",
      label: "Silver",
      rankTitle: "Eco Warrior",
      minPoints: 51,
      maxPoints: 200,
      nextTierLabel: "Gold (City Guardian)",
      nextTierPoints: 201,
      pointsToNext: 201 - points,
      progressPercent,
      tagline: "Consistent contributor turning reports into verified civic action.",
    };
  }

  const progressPercent = Math.min(100, Math.round((points / 51) * 100));
  return {
    tier: "bronze",
    label: "Bronze",
    rankTitle: "Street Watcher",
    minPoints: 0,
    maxPoints: 50,
    nextTierLabel: "Silver (Eco Warrior)",
    nextTierPoints: 51,
    pointsToNext: 51 - points,
    progressPercent,
    tagline: "Active resident reporting neighbourhood issues for review.",
  };
}

/**
 * Derives citizen CivicPoints rankings strictly from accepted/resolved reports
 * (+10 Accepted, +25 Resolved) and synced Firestore profile points for opted-in users.
 */
export function deriveLeaderboard(
  issues: readonly PublicIssueRecord[],
  profiles: readonly ContributorProfile[]
): LeaderboardEntry[] {
  const profileMap = new Map<string, ContributorProfile>();
  for (const profile of profiles) {
    profileMap.set(profile.userId, profile);
  }

  const seenReportIds = new Set<string>();
  const acceptedCountByUser = new Map<string, number>();
  const resolvedCountByUser = new Map<string, number>();
  const derivedPointsByUser = new Map<string, number>();

  for (const issue of issues) {
    if (seenReportIds.has(issue.id)) {
      continue;
    }
    seenReportIds.add(issue.id);

    const pts = computeReportCivicPoints(
      issue.status,
      issue.reviewState,
      issue.duplicateOfId
    );
    if (pts <= 0) {
      continue;
    }

    const profile = profileMap.get(issue.reporterId);
    if (!profile || !profile.leaderboardOptIn) {
      continue;
    }

    acceptedCountByUser.set(
      issue.reporterId,
      (acceptedCountByUser.get(issue.reporterId) ?? 0) + 1
    );
    if (issue.status === "resolved") {
      resolvedCountByUser.set(
        issue.reporterId,
        (resolvedCountByUser.get(issue.reporterId) ?? 0) + 1
      );
    }
    derivedPointsByUser.set(
      issue.reporterId,
      (derivedPointsByUser.get(issue.reporterId) ?? 0) + pts
    );
  }

  const candidateIds = new Set<string>(derivedPointsByUser.keys());
  for (const profile of profiles) {
    if (profile.leaderboardOptIn && (profile.civicPoints ?? 0) > 0) {
      candidateIds.add(profile.userId);
    }
  }

  const sorted = Array.from(candidateIds)
    .map((userId) => {
      const profile = profileMap.get(userId)!;
      const derivedPoints = derivedPointsByUser.get(userId) ?? 0;
      const storedPoints = Math.max(0, Math.floor(profile.civicPoints ?? 0));
      const points = Math.max(storedPoints, derivedPoints);
      const acceptedReports = Math.max(
        profile.acceptedReportsCount ?? 0,
        acceptedCountByUser.get(userId) ?? 0
      );
      const resolvedReports = Math.max(
        profile.resolvedReportsCount ?? 0,
        resolvedCountByUser.get(userId) ?? 0
      );

      return {
        alias: profile.alias,
        acceptedReports,
        resolvedReports,
        points,
        levelBadge: getCivicLevelBadge(points),
      };
    })
    .filter((entry) => entry.points > 0)
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.resolvedReports - a.resolvedReports ||
        b.acceptedReports - a.acceptedReports ||
        a.alias.localeCompare(b.alias)
    );

  return sorted.map((entry, index) => ({
    rank: index + 1,
    ...entry,
  }));
}

export interface PhotoValidationResult {
  valid: boolean;
  error?: string;
}

export function validatePhotoFileMeta(file: {
  type: string;
  size: number;
  name?: string;
}): PhotoValidationResult {
  const normalizedType = (file.type || "").trim().toLowerCase();
  const normalizedName = (file.name || "").trim().toLowerCase();

  const matchesMime = ALLOWED_PHOTO_MIME_TYPES.includes(
    normalizedType as (typeof ALLOWED_PHOTO_MIME_TYPES)[number]
  );
  const matchesExtension =
    normalizedName.length > 0 &&
    ALLOWED_PHOTO_EXTENSIONS.some((ext) => normalizedName.endsWith(ext));

  if (!matchesMime && !(normalizedType === "" && matchesExtension)) {
    return {
      valid: false,
      error: "Please choose a JPEG, PNG, WebP, or HEIC image file.",
    };
  }
  if (file.size <= 0) {
    return {
      valid: false,
      error: "The selected image appears to be empty.",
    };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return {
      valid: false,
      error: "Image exceeds the 10 MB limit. Please pick a smaller photo.",
    };
  }
  return { valid: true };
}

export interface ParsedSubmitError {
  message: string;
  needsEmailVerification: boolean;
  isQuotaExceeded: boolean;
}

/**
 * Extracts a clear, actionable message from Firestore / Firebase errors thrown
 * during civic report submission (including serialized FirestoreErrorInfo JSON).
 */
export function parseFirestoreSubmitError(
  error: unknown,
  emailVerified: boolean
): ParsedSubmitError {
  let rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  try {
    const parsed = JSON.parse(rawMessage) as { error?: string };
    if (parsed && typeof parsed.error === "string" && parsed.error.length > 0) {
      rawMessage = parsed.error;
    }
  } catch {
    // Raw message is plain text, not JSON
  }

  const lower = rawMessage.toLowerCase();

  if (lower.includes("quota exceeded")) {
    return {
      message:
        "Firestore daily free-tier quota was reached. Quota resets tomorrow.",
      needsEmailVerification: false,
      isQuotaExceeded: true,
    };
  }

  if (
    lower.includes("missing or insufficient permissions") ||
    lower.includes("permission-denied") ||
    lower.includes("permission_denied")
  ) {
    if (!emailVerified) {
      return {
        message:
          "Your email address is not verified yet. Please click the verification link in your inbox (then tap 'Refresh Status') or sign in with Google to submit instantly.",
        needsEmailVerification: true,
        isQuotaExceeded: false,
      };
    }
    return {
      message:
        "Firestore permission check rejected this submission. Please sign out and sign in again with Google, then retry.",
      needsEmailVerification: false,
      isQuotaExceeded: false,
    };
  }

  if (
    lower.includes("unauthenticated") ||
    lower.includes("auth/user-token-expired")
  ) {
    return {
      message:
        "Your sign-in session expired. Please sign in again and retry submitting your report.",
      needsEmailVerification: false,
      isQuotaExceeded: false,
    };
  }

  if (
    lower.includes("client is offline") ||
    lower.includes("unavailable") ||
    lower.includes("network") ||
    lower.includes("timed out")
  ) {
    return {
      message:
        "Could not reach Firestore (network or timeout). Please check your internet connection and tap Submit Report again.",
      needsEmailVerification: false,
      isQuotaExceeded: false,
    };
  }

  if (
    rawMessage.startsWith("Title must") ||
    rawMessage.startsWith("Description must") ||
    rawMessage.startsWith("Please select")
  ) {
    return {
      message: rawMessage,
      needsEmailVerification: false,
      isQuotaExceeded: false,
    };
  }

  return {
    message: rawMessage
      ? `Could not save your report to Firestore: ${rawMessage}`
      : "Could not save your report to Firestore right now. Please check your connection and try again.",
    needsEmailVerification: false,
    isQuotaExceeded: false,
  };
}

/**
 * Ensures post-login redirects stay strictly on safe internal paths.
 */
export function sanitizeRedirectPath(
  nextParam: string | null | undefined,
  fallback = "/profile"
): string {
  if (!nextParam) return fallback;
  const trimmed = nextParam.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }
  if (trimmed.includes("://") || trimmed.includes("\\")) {
    return fallback;
  }
  return trimmed;
}

export interface AuthValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Pure client-side credential validation for CivicSnap Sign In and Sign Up forms.
 */
export function validateAuthInput(input: {
  mode: "login" | "signup";
  alias?: string;
  email: string;
  password: string;
}): AuthValidationResult {
  if (input.mode === "signup") {
    const trimmedAlias = (input.alias ?? "").replace(/\s+/g, " ").trim();
    if (trimmedAlias.length < 2) {
      return {
        valid: false,
        error: "Choose a display alias with at least 2 characters.",
      };
    }
    if (trimmedAlias.length > 40) {
      return {
        valid: false,
        error: "Display alias must be 40 characters or fewer.",
      };
    }
  }

  const trimmedEmail = input.email.trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(trimmedEmail)) {
    return {
      valid: false,
      error: "Please enter a valid email address.",
    };
  }

  if (input.mode === "signup") {
    if (input.password.length < 8) {
      return {
        valid: false,
        error: "Password must be at least 8 characters.",
      };
    }
  } else if (input.password.length === 0) {
    return {
      valid: false,
      error: "Please enter your password.",
    };
  }

  return { valid: true };
}

/**
 * Builds a safe /login or /signup URL that preserves a sanitized internal redirect path.
 */
export function buildAuthHref(
  mode: "login" | "signup",
  nextPath?: string | null
): string {
  const base = mode === "signup" ? "/signup" : "/login";
  const safeNext = sanitizeRedirectPath(nextPath, "");
  if (!safeNext) {
    return base;
  }
  return `${base}?next=${encodeURIComponent(safeNext)}`;
}

/**
 * Authorized CivicSnap admin accounts enforced alongside Firebase Auth & Firestore rules.
 * Reads comma-separated emails from NEXT_PUBLIC_ADMIN_EMAILS when configured,
 * falling back to the project's bootstrap admin accounts.
 */
export const ALLOWED_ADMIN_EMAILS: readonly string[] = [
  "bipulmaurya42004@gmail.com",
  "vedmindset@gmail.com",
] as const;

export function parseAdminEmailList(rawEnv?: string | null): string[] {
  if (!rawEnv || !rawEnv.trim()) {
    return [...ALLOWED_ADMIN_EMAILS];
  }
  const parsed = rawEnv
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 3 && entry.includes("@"));
  return parsed.length > 0 ? parsed : [...ALLOWED_ADMIN_EMAILS];
}

export function isAuthorizedAdminEmail(
  email: string | null | undefined,
  rawEnvOverride?: string | null
): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const allowedList = parseAdminEmailList(
    rawEnvOverride !== undefined
      ? rawEnvOverride
      : process.env.NEXT_PUBLIC_ADMIN_EMAILS
  );
  return allowedList.includes(normalized);
}

/**
 * Computes top-level Admin Dashboard KPIs from submitted reports.
 */
export function computeAdminReportStats(
  reports: readonly { status: IssueStatus }[]
): {
  total: number;
  pending: number;
  inProgress: number;
  resolved: number;
} {
  let pending = 0;
  let inProgress = 0;
  let resolved = 0;

  for (const report of reports) {
    if (report.status === "resolved") {
      resolved += 1;
    } else if (report.status === "in_progress") {
      inProgress += 1;
    } else {
      pending += 1;
    }
  }

  return {
    total: reports.length,
    pending,
    inProgress,
    resolved,
  };
}

/**
 * Local merchant discount catalog for the CivicSnap Rewards Store (/rewards).
 */
export const REWARD_CATALOG: readonly RewardItem[] = [
  {
    id: "cafe-free-coffee",
    title: "Third Wave Coffee — 20% OFF",
    merchantCategory: "Bengaluru Cafés",
    description:
      "Enjoy 20% off specialty brews & snacks at Third Wave Coffee outlets across Indiranagar, Koramangala, and HSR Layout.",
    pointsCost: 100,
    terms: "Min bill ₹300",
    codePrefix: "TWC20",
    validityMinutes: 15,
  },
  {
    id: "gym-15-off",
    title: "Cult.fit — 1-Day Free Pass",
    merchantCategory: "Fitness & Wellness",
    description:
      "Unlock a complimentary 1-day all-access workout or group class pass at participating Bengaluru Cult.fit centres.",
    pointsCost: 150,
    terms: "1 pass per week",
    codePrefix: "CULT1D",
    validityMinutes: 15,
  },
  {
    id: "grocery-10-off",
    title: "Zepto — ₹100 OFF",
    merchantCategory: "Quick Commerce",
    description:
      "Save ₹100 instantly on fresh groceries and daily essentials delivered in 10 minutes across Bengaluru pilot wards.",
    pointsCost: 200,
    terms: "Min cart ₹499",
    codePrefix: "ZEP100",
    validityMinutes: 15,
  },
] as const;

export const REWARD_VOUCHER_DURATION_SECONDS = 15 * 60;

export function canRedeemReward(
  currentPoints: number,
  reward: Pick<RewardItem, "pointsCost">
): { eligible: boolean; shortfall: number } {
  const safePoints = Math.max(0, Math.floor(currentPoints || 0));
  if (safePoints >= reward.pointsCost) {
    return { eligible: true, shortfall: 0 };
  }
  return { eligible: false, shortfall: reward.pointsCost - safePoints };
}

export function generateUniqueCouponCode(prefix: string): string {
  const cleanPrefix =
    prefix
      .replace(/[^A-Z0-9]/gi, "")
      .toUpperCase()
      .slice(0, 8) || "CIVIC";
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";
  for (let i = 0; i < 6; i += 1) {
    const idx = Math.floor(Math.random() * alphabet.length);
    token += alphabet[idx];
  }
  return `CS-${cleanPrefix}-${token}`;
}

export function formatCountdownSeconds(remainingSeconds: number): string {
  const clamped = Math.max(0, Math.floor(remainingSeconds || 0));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

