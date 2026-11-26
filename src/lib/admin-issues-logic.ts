import { isAuthorizedAdminEmail } from "@/lib/civic-logic";

export type AdminIssueStatus =
  | "Reported"
  | "Under_AI_Verification"
  | "Resolved"
  | "Rejected";

export const ADMIN_DEFAULT_REJECTION_NOTE =
  "Marked as invalid or unverified by Admin";

export const ADMIN_DEFAULT_REJECTION_REASON = ADMIN_DEFAULT_REJECTION_NOTE;

export const ADMIN_POINTS_PER_RESOLVED_ISSUE = 50;

export interface ReporterIdentity {
  uid: string;
  name: string;
  email: string | null;
}

export interface LiveAdminIssue {
  id: string;
  reportedByUid: string;
  title: string;
  description: string;
  category: string;
  ward: string;
  location: string;
  lat: number | null;
  lng: number | null;
  evidencePhotoUrl: string | null;
  asphaltEstimateKg: number | null;
  estimatedCostInr: number | null;
  materialEstimate: string | null;
  aiConfidenceScore: number | null;
  status: AdminIssueStatus;
  adminVerified: boolean;
  adminActionBy: string | null;
  rejectionNote: string | null;
  rejectionReason: string | null;
  verifiedAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface AdminIssuesKpis {
  total: number;
  pending: number;
  resolved: number;
  rejected: number;
}

export type AuthPortalRole = "citizen" | "staff";

export const NON_ADMIN_STAFF_SIGNIN_NOTICE =
  "Signed in as Citizen. To access Ward Auditor controls, sign in with a whitelisted Civic Verifier email.";

/**
 * Strictly enforces authenticated email authorization against
 * `process.env.NEXT_PUBLIC_ADMIN_EMAILS`. No URL parameter or guest bypasses exist.
 */
export function canAccessAdminDashboard(params: {
  userEmail?: string | null;
  envAdminEmailsOverride?: string | null;
}): boolean {
  if (!params.userEmail || !params.userEmail.trim()) {
    return false;
  }
  return isAuthorizedAdminEmail(
    params.userEmail,
    params.envAdminEmailsOverride
  );
}

/**
 * Resolves the navbar/profile RBAC role badge for a signed-in user.
 */
export function getUserRoleBadge(
  userEmail?: string | null,
  envAdminEmailsOverride?: string | null
): {
  isAdmin: boolean;
  label: "Ward Admin" | "Citizen";
} {
  const isAdmin = canAccessAdminDashboard({
    userEmail,
    envAdminEmailsOverride,
  });
  return isAdmin
    ? { isAdmin: true, label: "Ward Admin" }
    : { isAdmin: false, label: "Citizen" };
}

/**
 * Determines post-Google-Sign-In redirect and RBAC notice based on whether the
 * user signed in via the Citizen Portal tab or Civic Verifier & Admin tab.
 */
export function resolvePostSignInOutcome(params: {
  portalRole: AuthPortalRole;
  userEmail?: string | null;
  defaultRedirect?: string | null;
  envAdminEmailsOverride?: string | null;
}): {
  redirectTo: string | null;
  notice: string | null;
  isAdmin: boolean;
} {
  const isAdmin = canAccessAdminDashboard({
    userEmail: params.userEmail,
    envAdminEmailsOverride: params.envAdminEmailsOverride,
  });

  if (params.portalRole === "staff") {
    if (isAdmin) {
      return {
        redirectTo: "/admin",
        notice: null,
        isAdmin: true,
      };
    }
    return {
      redirectTo: "/dashboard",
      notice: NON_ADMIN_STAFF_SIGNIN_NOTICE,
      isAdmin: false,
    };
  }

  return {
    redirectTo: params.defaultRedirect ?? null,
    notice: null,
    isAdmin,
  };
}

/**
 * Formats optional latitude/longitude into readable GPS coordinates.
 */
export function formatGpsCoordinates(
  lat: number | null | undefined,
  lng: number | null | undefined
): string | null {
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
}

/**
 * Normalizes any raw Firestore issue status string into one of the four
 * canonical Admin Dashboard workflow states.
 */
export function normalizeAdminIssueStatus(
  rawStatus: unknown,
  adminVerified?: unknown
): AdminIssueStatus {
  const s = typeof rawStatus === "string" ? rawStatus.trim().toLowerCase() : "";
  if (s === "resolved" || s === "verified_fixed" || s === "verified") {
    return "Resolved";
  }
  if (s === "rejected" || s === "invalid" || s === "spam") {
    return "Rejected";
  }
  if (
    s === "under_ai_verification" ||
    s === "needs_review" ||
    s === "in_progress"
  ) {
    return "Under_AI_Verification";
  }
  if (adminVerified === true) {
    return "Resolved";
  }
  return "Reported";
}

/**
 * Extracts numeric asphalt kg and INR repair cost either from structured
 * Firestore numbers or from free-text materialEstimate / economicCostOfDelay strings.
 */
export function extractMaterialMetrics(raw: {
  asphaltEstimateKg?: unknown;
  asphalt_estimate_kg?: unknown;
  estimatedCostInr?: unknown;
  estimated_cost_inr?: unknown;
  materialEstimate?: unknown;
  economicCostOfDelay?: unknown;
}): {
  asphaltEstimateKg: number | null;
  estimatedCostInr: number | null;
  materialSummary: string;
} {
  let asphaltEstimateKg: number | null = null;
  const rawKg = raw.asphaltEstimateKg ?? raw.asphalt_estimate_kg;
  if (typeof rawKg === "number" && Number.isFinite(rawKg) && rawKg >= 0) {
    asphaltEstimateKg = Math.round(rawKg);
  }

  let estimatedCostInr: number | null = null;
  const rawCost = raw.estimatedCostInr ?? raw.estimated_cost_inr;
  if (typeof rawCost === "number" && Number.isFinite(rawCost) && rawCost >= 0) {
    estimatedCostInr = Math.round(rawCost);
  }

  const textPool = [
    typeof raw.materialEstimate === "string" ? raw.materialEstimate : "",
    typeof raw.economicCostOfDelay === "string" ? raw.economicCostOfDelay : "",
  ]
    .filter(Boolean)
    .join(" · ");

  if (asphaltEstimateKg === null && textPool.length > 0) {
    const kgMatch = textPool.match(/(\d[\d,]*(?:\.\d+)?)\s*kg/i);
    if (kgMatch) {
      const parsed = Number(kgMatch[1].replace(/,/g, ""));
      if (Number.isFinite(parsed) && parsed >= 0) {
        asphaltEstimateKg = Math.round(parsed);
      }
    }
  }

  if (estimatedCostInr === null && textPool.length > 0) {
    const inrMatch = textPool.match(/(?:₹|INR|Rs\.?)\s*(\d[\d,]*)/i);
    if (inrMatch) {
      const parsed = Number(inrMatch[1].replace(/,/g, ""));
      if (Number.isFinite(parsed) && parsed >= 0) {
        estimatedCostInr = Math.round(parsed);
      }
    }
  }

  const parts: string[] = [];
  if (asphaltEstimateKg !== null) {
    parts.push(`${asphaltEstimateKg.toLocaleString("en-IN")} kg Asphalt`);
  }
  if (estimatedCostInr !== null) {
    parts.push(`₹${estimatedCostInr.toLocaleString("en-IN")}`);
  }

  const materialSummary =
    parts.length > 0
      ? parts.join(" · ")
      : typeof raw.materialEstimate === "string" &&
          raw.materialEstimate.trim().length > 0
        ? raw.materialEstimate.trim()
        : "Pending AI material audit";

  return {
    asphaltEstimateKg,
    estimatedCostInr,
    materialSummary,
  };
}

/**
 * Prevents double-crediting +50 points if an issue is already Resolved & Admin Verified.
 */
export function shouldAwardPointsOnApprove(
  currentStatus: AdminIssueStatus,
  currentAdminVerified: boolean
): boolean {
  return !(currentStatus === "Resolved" && currentAdminVerified);
}

/**
 * Computes live Admin Dashboard KPI counters from Firestore issues.
 */
export function computeAdminIssuesKpis(
  issues: readonly Pick<LiveAdminIssue, "status">[]
): AdminIssuesKpis {
  let pending = 0;
  let resolved = 0;
  let rejected = 0;

  for (const item of issues) {
    if (item.status === "Resolved") {
      resolved += 1;
    } else if (item.status === "Rejected") {
      rejected += 1;
    } else {
      pending += 1;
    }
  }

  return {
    total: issues.length,
    pending,
    resolved,
    rejected,
  };
}
