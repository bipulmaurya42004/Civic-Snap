export type IssueCategory = "pothole" | "waste" | "streetlight" | "other";

export type IssueStatus = "pending" | "in_progress" | "resolved";

export type ReviewState = "unreviewed" | "accepted" | "duplicate" | "rejected";

export type VerificationStatus = "unverified" | "verified" | "flagged";

export type SortOrder = "newest" | "oldest";

export type DateRangeFilter = "all" | "7d" | "30d" | "90d";

export interface CategoryMeta {
  value: IssueCategory;
  label: string;
  shortLabel: string;
  description: string;
}

export const ISSUE_CATEGORIES: readonly CategoryMeta[] = [
  {
    value: "pothole",
    label: "Pothole / Road Damage",
    shortLabel: "Road Damage",
    description: "Surface cracks, open potholes, damaged curbs, or broken paving.",
  },
  {
    value: "waste",
    label: "Garbage / Waste",
    shortLabel: "Waste",
    description: "Overflowing bins, uncollected waste piles, or dumped debris.",
  },
  {
    value: "streetlight",
    label: "Streetlight",
    shortLabel: "Streetlight",
    description: "Unlit lamps after dark, flickering fixtures, or damaged poles.",
  },
  {
    value: "other",
    label: "Other / Unsure",
    shortLabel: "Other",
    description: "Other local civic maintenance issues or items needing review.",
  },
] as const;

export const STATUS_LABELS: Record<IssueStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  resolved: "Resolved",
};

export const REVIEW_STATE_LABELS: Record<ReviewState, string> = {
  unreviewed: "Awaiting Review",
  accepted: "Accepted",
  duplicate: "Duplicate",
  rejected: "Rejected",
};

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  unverified: "Not Verified Yet",
  verified: "AI Verified Fix",
  flagged: "AI Flagged — Needs Re-check",
};

export const PILOT_LOCALITIES: readonly string[] = [
  "Indiranagar",
  "Koramangala",
  "HSR Layout",
  "Whitefield",
  "Jayanagar",
  "MG Road",
  "Malleshwaram",
] as const;

export const DEMO_LOCALITIES: readonly string[] = PILOT_LOCALITIES;

export interface TimelineEvent {
  id: string;
  eventType: "submitted" | "reviewed" | "status_changed" | "note_added";
  statusTransition?: IssueStatus;
  label: string;
  note: string;
  actorLabel: string;
  createdAt: string;
}

export interface EngineeringInsights {
  surroundingLandmarks: string;
  materialEstimate: string;
  socialImpactScore: number;
  economicCostOfDelay: string;
}

export interface PublicIssueRecord {
  id: string;
  title: string;
  category: IssueCategory;
  locality: string;
  status: IssueStatus;
  reviewState: ReviewState;
  duplicateOfId?: string;
  publicSummary: string;
  createdAt: string;
  updatedAt: string;
  /** Only populated on clearly labelled demo items or owner/admin private views */
  demoImageUrl?: string;
  demoImageAlt?: string;
  /** Approved before/after images and Gemini Vision verdict for public accountability */
  beforeImageURL?: string;
  afterImageURL?: string;
  verificationStatus?: VerificationStatus;
  verificationReason?: string;
  aiConfidenceScore?: number;
  needsReview?: boolean;
  flagReasons?: string[];
  imageHash?: string;
  locationCooldownApplied?: boolean;
  adminDecisionReason?: string;
  /** Gemini Engineering Auditing insights */
  surroundingLandmarks?: string;
  materialEstimate?: string;
  socialImpactScore?: number;
  economicCostOfDelay?: string;
  /** Real-time GPS & Ward geolocation metadata */
  lat?: number;
  lng?: number;
  detectedAddress?: string;
  highPriorityZone?: boolean;
  aiSuggestionNote?: string;
  isDemo: boolean;
  reporterId: string;
  timeline: TimelineEvent[];
}

export interface VoiceToReportResponse {
  title: string;
  category: IssueCategory;
  categoryDisplay: string;
  description: string;
  demoMode: boolean;
  notice?: string;
}

export interface PhotoAuditResponse extends EngineeringInsights {
  isGenuineCivicIssue: boolean;
  detectedSubject: string;
  rejectionReason?: string;
  confidence?: number;
  title: string;
  category: IssueCategory;
  categoryDisplay: string;
  description: string;
  demoMode: boolean;
  notice?: string;
}

export interface ReportAuthenticityResponse {
  isGenuine: boolean;
  reason: string;
  suggestedScore?: number;
  suggestedCategory?: IssueCategory;
  demoMode: boolean;
}

export interface FixVerificationResponse {
  verdict: "Verified" | "Flagged";
  verificationStatus: "verified" | "flagged";
  aiConfidenceScore?: number;
  reason: string;
  demoMode: boolean;
  notice?: string;
}

export type CivicLevelTier = "bronze" | "silver" | "gold";

export interface CivicLevelBadgeInfo {
  tier: CivicLevelTier;
  label: string;
  rankTitle: string;
  minPoints: number;
  maxPoints: number | null;
  nextTierLabel: string | null;
  nextTierPoints: number | null;
  pointsToNext: number;
  progressPercent: number;
  tagline: string;
}

export type StateCivicBadgeId =
  | "ward-scout"
  | "state-urban-sentinel"
  | "state-infrastructure-guardian"
  | "national-civic-vanguard"
  | "cm-civic-laureate";

export interface StateCivicBadge {
  id: StateCivicBadgeId;
  level: 1 | 2 | 3 | 4 | 5;
  title: string;
  tierScope:
    | "Ward Level"
    | "City Level"
    | "Bengaluru Vanguard"
    | "Annual Vanguard Shortlist";
  requirementLabel: string;
  minVerifiedFixes: number | null;
  top5Only?: boolean;
  description: string;
  unlocked: boolean;
  fixesRemaining: number;
}

export interface CertificateMilestone {
  level: number;
  requiredFixes: number;
  title: string;
  subtitle: string;
  unlocked: boolean;
  completedFixes: number;
  progressPercent: number;
  certificateId: string;
}

export interface CivicCertificateData {
  recipientName: string;
  ward: string;
  verifiedFixes: number;
  milestoneLevel: number;
  milestoneTitle: string;
  certificateId: string;
  issuedDate: string;
  meritPoints: number;
  sha256Hash?: string;
}

export interface CitizenHonorsSnapshot {
  citizenName: string;
  ward: string;
  meritPoints: number;
  verifiedFixes: number;
  citywideRank: number;
  top5ThresholdPoints: number;
  pointsToTop5: number;
  top5ProgressPercent: number;
  isTop5Finalist: boolean;
  currentBadge: StateCivicBadge;
  badges: StateCivicBadge[];
  certificates: CertificateMilestone[];
  unlockedCertificateCount: number;
}

export interface ContributorProfile {
  userId: string;
  alias: string;
  leaderboardOptIn: boolean;
  civicPoints?: number;
  acceptedReportsCount?: number;
  resolvedReportsCount?: number;
}

export interface LeaderboardEntry {
  rank: number;
  alias: string;
  acceptedReports: number;
  resolvedReports: number;
  points: number;
  levelBadge: CivicLevelBadgeInfo;
}

export interface IssueFilterState {
  search: string;
  category: IssueCategory | "all";
  status: IssueStatus | "all";
  area: string;
  sort: SortOrder;
}

export interface DashboardMetrics {
  total: number;
  pending: number;
  inProgress: number;
  resolved: number;
  byCategory: Array<{ category: IssueCategory; label: string; count: number }>;
  byArea: Array<{ area: string; count: number }>;
  statusDistribution: Array<{
    status: IssueStatus;
    label: string;
    count: number;
    percentage: number;
  }>;
}
