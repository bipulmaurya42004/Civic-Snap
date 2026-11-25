import type { User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import {
  db,
  handleFirestoreError,
  OperationType,
} from "@/lib/firebase";
import { sanitizeDisplayAlias } from "@/lib/firebase-users";
import {
  computeCivicPointsDelta,
  computeReportCivicPoints,
} from "@/lib/civic-logic";
import type {
  ContributorProfile,
  IssueCategory,
  IssueStatus,
  PublicIssueRecord,
  ReviewState,
  VerificationStatus,
} from "@/types/civic";
import {
  clampSocialImpactScore,
  isSafeDisplayImageUrl,
} from "@/lib/ai-civic-helpers";
import { detectHighPriorityZone } from "@/lib/location-helpers";
import {
  DUPLICATE_HASH_MAX_BIT_DISTANCE,
  evaluateDailyLimit,
  evaluateLocationCooldown,
  isDuplicateImageHash,
} from "@/lib/anti-spam";
import { extractMaterialMetrics } from "@/lib/admin-issues-logic";

export interface CreateCivicReportInput {
  title: string;
  category: IssueCategory;
  description: string;
  locality: string;
  hasPhoto: boolean;
  photoFileName?: string | null;
  beforeImageURL?: string | null;
  surroundingLandmarks?: string | null;
  materialEstimate?: string | null;
  socialImpactScore?: number | null;
  economicCostOfDelay?: string | null;
  privateLat?: number | null;
  privateLng?: number | null;
  detectedAddress?: string | null;
  highPriorityZone?: boolean | null;
  actorAlias?: string | null;
  imageHash?: string | null;
  needsReview?: boolean | null;
  flagReasons?: string[] | null;
  aiConfidenceScore?: number | null;
}

export interface StoredPrivateReport {
  id: string;
  reporterId: string;
  title: string;
  category: IssueCategory;
  description: string;
  locality: string;
  status: IssueStatus;
  reviewState: ReviewState;
  publicApproved: boolean;
  hasPhoto: boolean;
  pointsAwarded: number;
  photoStoragePath?: string;
  beforeImageURL?: string;
  afterImageURL?: string;
  verificationStatus?: VerificationStatus;
  verificationReason?: string;
  aiConfidenceScore?: number;
  imageHash?: string;
  needsReview?: boolean;
  flagReasons?: string[];
  locationCooldownApplied?: boolean;
  adminDecisionReason?: string;
  surroundingLandmarks?: string;
  materialEstimate?: string;
  socialImpactScore?: number;
  economicCostOfDelay?: string;
  privateLat?: number;
  privateLng?: number;
  detectedAddress?: string;
  highPriorityZone?: boolean;
  duplicateOfId?: string;
  createdAtIso: string;
  updatedAtIso: string;
}

function timestampToIso(value: unknown): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as Timestamp).toDate === "function"
  ) {
    return (value as Timestamp).toDate().toISOString();
  }
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return new Date().toISOString();
}

function toSafeInt(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.floor(value);
}

function generateSafeId(prefix: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

function sanitizeFileName(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
}

/**
 * Validates and persists a new civic report plus its initial immutable timeline
 * event atomically in Firestore (`reports/{id}` + `reports/{id}/events/{eventId}`).
 */
export async function createCivicReport(
  user: User,
  input: CreateCivicReportInput
): Promise<StoredPrivateReport> {
  if (!db) {
    throw new Error("Firebase Firestore is not configured in this environment.");
  }

  const title = input.title.replace(/\s+/g, " ").trim().slice(0, 120);
  const description = input.description.trim().slice(0, 600);
  const locality = input.locality.replace(/\s+/g, " ").trim().slice(0, 80);

  if (title.length < 5) {
    throw new Error("Title must be at least 5 characters.");
  }
  if (description.length < 10) {
    throw new Error("Description must be at least 10 characters.");
  }
  if (locality.length < 2) {
    throw new Error("Please select or enter a valid locality.");
  }

  // Anti-spam & fraud-prevention pre-checks against user's existing reports
  const cleanImageHash = (input.imageHash ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^0-9a-f]/g, "")
    .slice(0, 64);

  let existingMyReports: StoredPrivateReport[] = [];
  try {
    existingMyReports = await fetchMyReports(user.uid);
  } catch {
    // Allow submission if read probe is unavailable offline
  }

  // 1. Daily limit: Max 5 reports per user per day
  const dailyCheck = evaluateDailyLimit(
    existingMyReports.map((r) => r.createdAtIso)
  );
  if (!dailyCheck.allowed) {
    throw new Error(
      dailyCheck.error ||
        "Daily limit reached (5 reports per day). Please try again tomorrow."
    );
  }

  // 2. Perceptual hash duplicate check across user's reports + public approved reports
  if (cleanImageHash.length >= 8) {
    const duplicateOwn = existingMyReports.find(
      (r) =>
        r.imageHash &&
        isDuplicateImageHash(
          cleanImageHash,
          r.imageHash,
          DUPLICATE_HASH_MAX_BIT_DISTANCE
        )
    );
    if (duplicateOwn) {
      throw new Error("This image was already submitted.");
    }
    try {
      const publicDocs = await fetchPublicReports();
      const duplicatePublic = publicDocs.find(
        (r) =>
          r.imageHash &&
          isDuplicateImageHash(
            cleanImageHash,
            r.imageHash,
            DUPLICATE_HASH_MAX_BIT_DISTANCE
          )
      );
      if (duplicatePublic) {
        throw new Error("This image was already submitted.");
      }
    } catch (dupErr) {
      if (
        dupErr instanceof Error &&
        dupErr.message === "This image was already submitted."
      ) {
        throw dupErr;
      }
    }
  }

  // 3. Same-location 50m / 30-day cooldown check (prevents double-earning points)
  const cooldownCheck = evaluateLocationCooldown(
    existingMyReports,
    input.privateLat,
    input.privateLng
  );

  const sanitizedFlagReasons: string[] = [];
  if (Array.isArray(input.flagReasons)) {
    for (const reason of input.flagReasons) {
      const clean = String(reason || "").trim().slice(0, 180);
      if (clean.length >= 3 && sanitizedFlagReasons.length < 8) {
        sanitizedFlagReasons.push(clean);
      }
    }
  }
  if (cooldownCheck.onCooldown && cooldownCheck.reason) {
    sanitizedFlagReasons.push(cooldownCheck.reason.slice(0, 180));
  }
  const needsReview =
    Boolean(input.needsReview) ||
    cooldownCheck.onCooldown ||
    sanitizedFlagReasons.length > 0;

  const reportId = generateSafeId("CS");
  const eventId = generateSafeId("EVT");
  const actorLabel = sanitizeDisplayAlias(
    input.actorAlias || user.displayName,
    user.email
  );
  const safePhotoPath =
    input.hasPhoto && input.photoFileName
      ? `private-uploads/${user.uid}/${reportId}/${sanitizeFileName(input.photoFileName)}`.slice(
          0,
          300
        )
      : undefined;

  const reportPayload: Record<string, unknown> = {
    id: reportId,
    reporterId: user.uid,
    title,
    category: input.category,
    description,
    locality,
    status: "pending" as IssueStatus,
    reviewState: "unreviewed" as ReviewState,
    publicApproved: false,
    hasPhoto: Boolean(input.hasPhoto),
    pointsAwarded: 0,
    needsReview,
    locationCooldownApplied: cooldownCheck.onCooldown,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (cleanImageHash.length >= 8) {
    reportPayload.imageHash = cleanImageHash;
  }
  if (sanitizedFlagReasons.length > 0) {
    reportPayload.flagReasons = sanitizedFlagReasons;
  }

  if (safePhotoPath) {
    reportPayload.photoStoragePath = safePhotoPath;
  }
  if (input.beforeImageURL && isSafeDisplayImageUrl(input.beforeImageURL)) {
    reportPayload.beforeImageURL = input.beforeImageURL.trim().slice(0, 2048);
  }
  const cleanLandmarks = input.surroundingLandmarks
    ?.replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  if (cleanLandmarks && cleanLandmarks.length >= 2) {
    reportPayload.surroundingLandmarks = cleanLandmarks;
  }
  const cleanMaterials = input.materialEstimate
    ?.replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
  if (cleanMaterials && cleanMaterials.length >= 2) {
    reportPayload.materialEstimate = cleanMaterials;
  }
  if (
    typeof input.socialImpactScore === "number" &&
    Number.isFinite(input.socialImpactScore)
  ) {
    reportPayload.socialImpactScore = clampSocialImpactScore(
      input.socialImpactScore
    );
  }
  const cleanEconomicCost = input.economicCostOfDelay
    ?.replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
  if (cleanEconomicCost && cleanEconomicCost.length >= 2) {
    reportPayload.economicCostOfDelay = cleanEconomicCost;
  }
  if (
    typeof input.privateLat === "number" &&
    Number.isFinite(input.privateLat) &&
    input.privateLat >= -90 &&
    input.privateLat <= 90
  ) {
    reportPayload.privateLat = input.privateLat;
  }
  if (
    typeof input.privateLng === "number" &&
    Number.isFinite(input.privateLng) &&
    input.privateLng >= -180 &&
    input.privateLng <= 180
  ) {
    reportPayload.privateLng = input.privateLng;
  }
  const cleanDetectedAddress = input.detectedAddress
    ?.replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  if (cleanDetectedAddress && cleanDetectedAddress.length >= 2) {
    reportPayload.detectedAddress = cleanDetectedAddress;
  }
  const computedPriority = detectHighPriorityZone({
    title,
    description,
    locality,
    detectedAddress: cleanDetectedAddress,
    surroundingLandmarks: cleanLandmarks,
    lat: input.privateLat,
    lng: input.privateLng,
    explicitFlag: input.highPriorityZone,
  });
  if (computedPriority.isHighPriority) {
    reportPayload.highPriorityZone = true;
  }

  const eventPayload = {
    id: eventId,
    reportId,
    reportOwnerUid: user.uid,
    eventType: "submitted",
    statusTransition: "pending",
    label: "Report submitted",
    note: "Submitted via CivicSnap for project-admin review.",
    actorUid: user.uid,
    actorLabel,
    createdAt: serverTimestamp(),
  };

  const path = `reports/${reportId}`;
  const withTimeout = <T,>(promise: Promise<T>, ms = 20000): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Firestore request timed out after 20 seconds."));
      }, ms);
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        }
      );
    });

  const reportRef = doc(db, "reports", reportId);
  const eventRef = doc(db, "reports", reportId, "events", eventId);
  const issueRef = doc(db, "issues", reportId);

  const parsedMaterials = extractMaterialMetrics({
    materialEstimate: cleanMaterials,
    economicCostOfDelay: cleanEconomicCost,
  });

  const issuePayload: Record<string, unknown> = {
    id: reportId,
    reportedByUid: user.uid,
    title,
    description,
    category: input.category,
    ward: locality,
    location: cleanDetectedAddress || locality,
    status: "Reported",
    adminVerified: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (typeof reportPayload.privateLat === "number") {
    issuePayload.lat = reportPayload.privateLat;
  }
  if (typeof reportPayload.privateLng === "number") {
    issuePayload.lng = reportPayload.privateLng;
  }
  if (typeof reportPayload.beforeImageURL === "string") {
    issuePayload.evidencePhotoUrl = reportPayload.beforeImageURL;
  }
  if (cleanMaterials && cleanMaterials.length >= 2) {
    issuePayload.materialEstimate = cleanMaterials;
  }
  if (parsedMaterials.asphaltEstimateKg !== null) {
    issuePayload.asphaltEstimateKg = parsedMaterials.asphaltEstimateKg;
  }
  if (parsedMaterials.estimatedCostInr !== null) {
    issuePayload.estimatedCostInr = parsedMaterials.estimatedCostInr;
  }
  if (
    typeof input.aiConfidenceScore === "number" &&
    Number.isFinite(input.aiConfidenceScore)
  ) {
    issuePayload.aiConfidenceScore = Math.max(
      0,
      Math.min(100, Math.round(input.aiConfidenceScore))
    );
  } else if (typeof reportPayload.socialImpactScore === "number") {
    issuePayload.aiConfidenceScore = Math.max(
      0,
      Math.min(100, Math.round(reportPayload.socialImpactScore))
    );
  }
  if (cleanImageHash.length >= 8) {
    issuePayload.imageHash = cleanImageHash;
  }

  try {
    try {
      const batch = writeBatch(db);
      batch.set(reportRef, reportPayload);
      batch.set(eventRef, eventPayload);
      batch.set(issueRef, issuePayload);
      await withTimeout(batch.commit());
    } catch (batchErr) {
      const batchMsg =
        batchErr instanceof Error ? batchErr.message.toLowerCase() : "";
      if (batchMsg.includes("quota exceeded")) {
        throw batchErr;
      }
      // Fallback: write parent report document directly, then best-effort event & issues mirror
      await withTimeout(setDoc(reportRef, reportPayload));
      await Promise.allSettled([
        withTimeout(setDoc(eventRef, eventPayload), 10000),
        withTimeout(setDoc(issueRef, issuePayload), 10000),
      ]);
    }

    const nowIso = new Date().toISOString();
    return {
      id: reportId,
      reporterId: user.uid,
      title,
      category: input.category,
      description,
      locality,
      status: "pending",
      reviewState: "unreviewed",
      publicApproved: false,
      hasPhoto: Boolean(input.hasPhoto),
      pointsAwarded: 0,
      photoStoragePath: safePhotoPath,
      beforeImageURL:
        typeof reportPayload.beforeImageURL === "string"
          ? reportPayload.beforeImageURL
          : undefined,
      surroundingLandmarks:
        typeof reportPayload.surroundingLandmarks === "string"
          ? reportPayload.surroundingLandmarks
          : undefined,
      materialEstimate:
        typeof reportPayload.materialEstimate === "string"
          ? reportPayload.materialEstimate
          : undefined,
      socialImpactScore:
        typeof reportPayload.socialImpactScore === "number"
          ? reportPayload.socialImpactScore
          : undefined,
      economicCostOfDelay:
        typeof reportPayload.economicCostOfDelay === "string"
          ? reportPayload.economicCostOfDelay
          : undefined,
      privateLat:
        typeof reportPayload.privateLat === "number"
          ? reportPayload.privateLat
          : undefined,
      privateLng:
        typeof reportPayload.privateLng === "number"
          ? reportPayload.privateLng
          : undefined,
      detectedAddress:
        typeof reportPayload.detectedAddress === "string"
          ? reportPayload.detectedAddress
          : undefined,
      highPriorityZone:
        typeof reportPayload.highPriorityZone === "boolean"
          ? reportPayload.highPriorityZone
          : undefined,
      imageHash:
        typeof reportPayload.imageHash === "string"
          ? reportPayload.imageHash
          : undefined,
      needsReview: Boolean(reportPayload.needsReview),
      flagReasons:
        Array.isArray(reportPayload.flagReasons)
          ? (reportPayload.flagReasons as string[])
          : undefined,
      locationCooldownApplied: Boolean(reportPayload.locationCooldownApplied),
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Fetches private civic reports created by the currently signed-in reporter.
 */
export async function fetchMyReports(
  uid: string
): Promise<StoredPrivateReport[]> {
  if (!db) return [];
  const path = "reports";
  try {
    const q = query(collection(db, "reports"), where("reporterId", "==", uid));
    const snap = await getDocs(q);
    const items: StoredPrivateReport[] = snap.docs.map((docSnap) => {
      const data = docSnap.data();
      const status = (data.status as IssueStatus) ?? "pending";
      const reviewState = (data.reviewState as ReviewState) ?? "unreviewed";
      const storedPoints =
        typeof data.pointsAwarded === "number"
          ? toSafeInt(data.pointsAwarded)
          : computeReportCivicPoints(status, reviewState);
      return {
        id: String(data.id ?? docSnap.id),
        reporterId: String(data.reporterId ?? uid),
        title: String(data.title ?? ""),
        category: (data.category as IssueCategory) ?? "other",
        description: String(data.description ?? ""),
        locality: String(data.locality ?? ""),
        status,
        reviewState,
        publicApproved: Boolean(data.publicApproved),
        hasPhoto: Boolean(data.hasPhoto),
        pointsAwarded: storedPoints,
        photoStoragePath:
          typeof data.photoStoragePath === "string"
            ? data.photoStoragePath
            : undefined,
        beforeImageURL:
          typeof data.beforeImageURL === "string" &&
          isSafeDisplayImageUrl(data.beforeImageURL)
            ? data.beforeImageURL
            : undefined,
        afterImageURL:
          typeof data.afterImageURL === "string" &&
          isSafeDisplayImageUrl(data.afterImageURL)
            ? data.afterImageURL
            : undefined,
        verificationStatus:
          data.verificationStatus === "verified" ||
          data.verificationStatus === "flagged" ||
          data.verificationStatus === "unverified"
            ? data.verificationStatus
            : undefined,
        verificationReason:
          typeof data.verificationReason === "string"
            ? data.verificationReason
            : undefined,
        aiConfidenceScore:
          typeof data.aiConfidenceScore === "number" &&
          Number.isFinite(data.aiConfidenceScore)
            ? Math.round(data.aiConfidenceScore)
            : undefined,
        imageHash:
          typeof data.imageHash === "string" ? data.imageHash : undefined,
        needsReview:
          typeof data.needsReview === "boolean" ? data.needsReview : undefined,
        flagReasons: Array.isArray(data.flagReasons)
          ? data.flagReasons.map((r) => String(r))
          : undefined,
        locationCooldownApplied:
          typeof data.locationCooldownApplied === "boolean"
            ? data.locationCooldownApplied
            : undefined,
        adminDecisionReason:
          typeof data.adminDecisionReason === "string"
            ? data.adminDecisionReason
            : undefined,
        surroundingLandmarks:
          typeof data.surroundingLandmarks === "string"
            ? data.surroundingLandmarks
            : undefined,
        materialEstimate:
          typeof data.materialEstimate === "string"
            ? data.materialEstimate
            : undefined,
        socialImpactScore:
          typeof data.socialImpactScore === "number" &&
          Number.isFinite(data.socialImpactScore)
            ? clampSocialImpactScore(data.socialImpactScore)
            : undefined,
        economicCostOfDelay:
          typeof data.economicCostOfDelay === "string"
            ? data.economicCostOfDelay
            : undefined,
        privateLat:
          typeof data.privateLat === "number" ? data.privateLat : undefined,
        privateLng:
          typeof data.privateLng === "number" ? data.privateLng : undefined,
        detectedAddress:
          typeof data.detectedAddress === "string"
            ? data.detectedAddress
            : undefined,
        highPriorityZone:
          typeof data.highPriorityZone === "boolean"
            ? data.highPriorityZone
            : undefined,
        duplicateOfId:
          typeof data.duplicateOfId === "string"
            ? data.duplicateOfId
            : undefined,
        createdAtIso: timestampToIso(data.createdAt),
        updatedAtIso: timestampToIso(data.updatedAt),
      };
    });

    return items.sort(
      (a, b) =>
        new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime()
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

function mapPublicReportDoc(
  docId: string,
  data: Record<string, unknown>
): PublicIssueRecord {
  const createdAt = timestampToIso(data.createdAt);
  const updatedAt = timestampToIso(data.updatedAt);
  const status = (data.status as IssueStatus) ?? "pending";
  const verificationStatus =
    data.verificationStatus === "verified" ||
    data.verificationStatus === "flagged" ||
    data.verificationStatus === "unverified"
      ? (data.verificationStatus as VerificationStatus)
      : undefined;
  const verificationReason =
    typeof data.verificationReason === "string"
      ? data.verificationReason
      : undefined;
  const beforeImageURL =
    typeof data.beforeImageURL === "string" &&
    isSafeDisplayImageUrl(data.beforeImageURL)
      ? data.beforeImageURL
      : undefined;
  const afterImageURL =
    typeof data.afterImageURL === "string" &&
    isSafeDisplayImageUrl(data.afterImageURL)
      ? data.afterImageURL
      : undefined;

  const timeline: PublicIssueRecord["timeline"] = [
    {
      id: `${docId}-submitted`,
      eventType: "submitted",
      statusTransition: "pending",
      label: "Report submitted & approved",
      note: "Approved by CivicSnap project admin for public tracker visibility.",
      createdAt,
      actorLabel: "CivicSnap Project Admin",
    },
  ];

  if (verificationStatus === "verified" && status === "resolved") {
    timeline.push({
      id: `${docId}-ai-verified`,
      eventType: "status_changed",
      statusTransition: "resolved",
      label: "AI Fix Verified · Marked Resolved",
      note:
        verificationReason ||
        "Gemini Vision verified the repair proof photo (AI Confidence Score ≥ 90%) and admin marked this issue resolved (+50 CivicPoints).",
      createdAt: updatedAt,
      actorLabel: "Gemini Vision + CivicSnap Project Admin",
    });
  } else if (verificationStatus === "flagged") {
    timeline.push({
      id: `${docId}-ai-flagged`,
      eventType: "status_changed",
      statusTransition: "in_progress",
      label: "AI Verification Flagged · Kept In Progress",
      note:
        verificationReason ||
        "Gemini Vision flagged the repair proof photo for follow-up inspection.",
      createdAt: updatedAt,
      actorLabel: "Gemini Vision + CivicSnap Project Admin",
    });
  } else if (status !== "pending" || updatedAt !== createdAt) {
    timeline.push({
      id: `${docId}-latest`,
      eventType: "status_changed",
      statusTransition: status,
      label:
        status === "resolved"
          ? "Marked resolved by project admin"
          : status === "in_progress"
            ? "Marked in progress by project admin"
            : "Approved for public tracker",
      note: "Status update recorded in CivicSnap Firestore.",
      createdAt: updatedAt,
      actorLabel: "CivicSnap Project Admin",
    });
  }

  return {
    id: String(data.id ?? docId),
    title: String(data.title ?? ""),
    category: (data.category as IssueCategory) ?? "other",
    locality: String(data.locality ?? "Unknown area"),
    status,
    reviewState: "accepted",
    createdAt,
    updatedAt,
    publicSummary: String(data.publicSummary ?? ""),
    beforeImageURL,
    afterImageURL,
    verificationStatus,
    verificationReason,
    aiConfidenceScore:
      typeof data.aiConfidenceScore === "number" &&
      Number.isFinite(data.aiConfidenceScore)
        ? Math.round(data.aiConfidenceScore)
        : undefined,
    imageHash: typeof data.imageHash === "string" ? data.imageHash : undefined,
    surroundingLandmarks:
      typeof data.surroundingLandmarks === "string"
        ? data.surroundingLandmarks
        : undefined,
    materialEstimate:
      typeof data.materialEstimate === "string"
        ? data.materialEstimate
        : undefined,
    socialImpactScore:
      typeof data.socialImpactScore === "number" &&
      Number.isFinite(data.socialImpactScore)
        ? clampSocialImpactScore(data.socialImpactScore)
        : undefined,
    economicCostOfDelay:
      typeof data.economicCostOfDelay === "string"
        ? data.economicCostOfDelay
        : undefined,
    lat:
      typeof data.lat === "number" && Number.isFinite(data.lat)
        ? data.lat
        : undefined,
    lng:
      typeof data.lng === "number" && Number.isFinite(data.lng)
        ? data.lng
        : undefined,
    detectedAddress:
      typeof data.detectedAddress === "string"
        ? data.detectedAddress
        : undefined,
    highPriorityZone:
      typeof data.highPriorityZone === "boolean"
        ? data.highPriorityZone
        : undefined,
    reporterId: String(data.reporterId ?? ""),
    isDemo: false,
    timeline,
  };
}

/**
 * Fetches explicitly approved safe public reports from `public_reports`.
 */
export async function fetchPublicReports(): Promise<PublicIssueRecord[]> {
  if (!db) return [];
  const path = "public_reports";
  try {
    const q = query(
      collection(db, "public_reports"),
      where("publicApproved", "==", true)
    );
    const snap = await getDocs(q);
    const records: PublicIssueRecord[] = snap.docs.map((docSnap) =>
      mapPublicReportDoc(docSnap.id, docSnap.data() as Record<string, unknown>)
    );

    return records.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Fetches a single approved public report by ID from `public_reports/{id}`.
 */
export async function fetchPublicReportById(
  reportId: string
): Promise<PublicIssueRecord | null> {
  if (!db) return null;
  const cleanId = reportId.trim();
  if (!/^[a-zA-Z0-9_-]{3,128}$/.test(cleanId)) {
    return null;
  }
  const path = `public_reports/${cleanId}`;
  try {
    const snap = await getDoc(doc(db, "public_reports", cleanId));
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data() as Record<string, unknown>;
    if (data.publicApproved !== true) {
      return null;
    }
    return mapPublicReportDoc(snap.id, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Fetches opt-in public contributor profiles (including CivicPoints) from `public_profiles`.
 */
export async function fetchOptInPublicProfiles(): Promise<
  ContributorProfile[]
> {
  if (!db) return [];
  const path = "public_profiles";
  try {
    const q = query(
      collection(db, "public_profiles"),
      where("leaderboardOptIn", "==", true)
    );
    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        userId: String(data.uid ?? docSnap.id),
        alias: String(data.alias ?? "CivicResident"),
        leaderboardOptIn: Boolean(data.leaderboardOptIn),
        civicPoints: toSafeInt(data.civicPoints),
        acceptedReportsCount: toSafeInt(data.acceptedReportsCount),
        resolvedReportsCount: toSafeInt(data.resolvedReportsCount),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Fetches all private reports for authorised project admins.
 */
export async function fetchAllReportsForAdmin(): Promise<
  StoredPrivateReport[]
> {
  if (!db) return [];
  const path = "reports";
  try {
    const snap = await getDocs(collection(db, "reports"));
    const items: StoredPrivateReport[] = snap.docs.map((docSnap) => {
      const data = docSnap.data();
      const status = (data.status as IssueStatus) ?? "pending";
      const reviewState = (data.reviewState as ReviewState) ?? "unreviewed";
      return {
        id: String(data.id ?? docSnap.id),
        reporterId: String(data.reporterId ?? ""),
        title: String(data.title ?? ""),
        category: (data.category as IssueCategory) ?? "other",
        description: String(data.description ?? ""),
        locality: String(data.locality ?? ""),
        status,
        reviewState,
        publicApproved: Boolean(data.publicApproved),
        hasPhoto: Boolean(data.hasPhoto),
        photoStoragePath:
          typeof data.photoStoragePath === "string"
            ? data.photoStoragePath
            : undefined,
        beforeImageURL:
          typeof data.beforeImageURL === "string" &&
          isSafeDisplayImageUrl(data.beforeImageURL)
            ? data.beforeImageURL
            : undefined,
        afterImageURL:
          typeof data.afterImageURL === "string" &&
          isSafeDisplayImageUrl(data.afterImageURL)
            ? data.afterImageURL
            : undefined,
        verificationStatus:
          data.verificationStatus === "verified" ||
          data.verificationStatus === "flagged" ||
          data.verificationStatus === "unverified"
            ? (data.verificationStatus as VerificationStatus)
            : undefined,
        verificationReason:
          typeof data.verificationReason === "string"
            ? data.verificationReason
            : undefined,
        aiConfidenceScore:
          typeof data.aiConfidenceScore === "number" &&
          Number.isFinite(data.aiConfidenceScore)
            ? Math.round(data.aiConfidenceScore)
            : undefined,
        imageHash:
          typeof data.imageHash === "string" ? data.imageHash : undefined,
        needsReview:
          typeof data.needsReview === "boolean" ? data.needsReview : undefined,
        flagReasons: Array.isArray(data.flagReasons)
          ? data.flagReasons.map((r) => String(r))
          : undefined,
        locationCooldownApplied:
          typeof data.locationCooldownApplied === "boolean"
            ? data.locationCooldownApplied
            : undefined,
        adminDecisionReason:
          typeof data.adminDecisionReason === "string"
            ? data.adminDecisionReason
            : undefined,
        surroundingLandmarks:
          typeof data.surroundingLandmarks === "string"
            ? data.surroundingLandmarks
            : undefined,
        materialEstimate:
          typeof data.materialEstimate === "string"
            ? data.materialEstimate
            : undefined,
        socialImpactScore:
          typeof data.socialImpactScore === "number" &&
          Number.isFinite(data.socialImpactScore)
            ? clampSocialImpactScore(data.socialImpactScore)
            : undefined,
        economicCostOfDelay:
          typeof data.economicCostOfDelay === "string"
            ? data.economicCostOfDelay
            : undefined,
        privateLat:
          typeof data.privateLat === "number" && Number.isFinite(data.privateLat)
            ? data.privateLat
            : undefined,
        privateLng:
          typeof data.privateLng === "number" && Number.isFinite(data.privateLng)
            ? data.privateLng
            : undefined,
        detectedAddress:
          typeof data.detectedAddress === "string"
            ? data.detectedAddress
            : undefined,
        highPriorityZone:
          typeof data.highPriorityZone === "boolean"
            ? data.highPriorityZone
            : undefined,
        pointsAwarded:
          typeof data.pointsAwarded === "number"
            ? toSafeInt(data.pointsAwarded)
            : computeReportCivicPoints(status, reviewState, undefined, {
                verificationStatus:
                  typeof data.verificationStatus === "string"
                    ? data.verificationStatus
                    : undefined,
                aiConfidenceScore:
                  typeof data.aiConfidenceScore === "number"
                    ? data.aiConfidenceScore
                    : undefined,
                locationCooldownApplied:
                  typeof data.locationCooldownApplied === "boolean"
                    ? data.locationCooldownApplied
                    : undefined,
              }),
        createdAtIso: timestampToIso(data.createdAt),
        updatedAtIso: timestampToIso(data.updatedAt),
      };
    });
    return items.sort(
      (a, b) =>
        new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime()
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Admin moderation action: updates report status/reviewState, credits CivicPoints
 * (+50 strictly on Verified + Resolved + AI Confidence Score >= 90% + Admin Approval)
 * atomically to `users/{uid}` and `public_profiles/{uid}`, records an immutable
 * audit event, and updates `public_reports/{id}`.
 */
export async function moderateReportAsAdmin(
  adminUser: User,
  report: StoredPrivateReport,
  input: {
    status: IssueStatus;
    reviewState: ReviewState;
    publicApproved: boolean;
    note: string;
    eventLabel?: string;
    beforeImageURL?: string | null;
    afterImageURL?: string | null;
    verificationStatus?: VerificationStatus;
    verificationReason?: string | null;
    aiConfidenceScore?: number | null;
    needsReview?: boolean;
    adminDecisionReason?: string | null;
  }
): Promise<{ pointsAwarded: number; pointsDelta: number }> {
  if (!db) {
    throw new Error("Firebase Firestore is not configured in this environment.");
  }

  const trimmedNote = input.note.trim().slice(0, 400);
  if (trimmedNote.length < 2) {
    throw new Error("Please include a short review note (at least 2 characters).");
  }

  const effectiveVerificationStatus =
    input.verificationStatus ?? report.verificationStatus;
  const effectiveAiConfidence =
    typeof input.aiConfidenceScore === "number" &&
    Number.isFinite(input.aiConfidenceScore)
      ? Math.max(0, Math.min(100, Math.round(input.aiConfidenceScore)))
      : report.aiConfidenceScore;

  const prevPoints = toSafeInt(report.pointsAwarded);
  const pointOptions = {
    verificationStatus: effectiveVerificationStatus ?? (input.status === "resolved" ? "verified" : "unverified"),
    aiConfidenceScore: effectiveAiConfidence,
    locationCooldownApplied: report.locationCooldownApplied,
  };
  const nextPoints = computeReportCivicPoints(
    input.status,
    input.reviewState,
    report.duplicateOfId,
    pointOptions
  );
  const pointsDelta = computeCivicPointsDelta(
    prevPoints,
    input.status,
    input.reviewState,
    report.duplicateOfId,
    pointOptions
  );

  const wasAccepted = report.reviewState === "accepted";
  const isAccepted = input.reviewState === "accepted";
  const acceptedDelta = (isAccepted ? 1 : 0) - (wasAccepted ? 1 : 0);

  const wasResolved = wasAccepted && report.status === "resolved";
  const isResolved = isAccepted && input.status === "resolved";
  const resolvedDelta = (isResolved ? 1 : 0) - (wasResolved ? 1 : 0);

  const effectiveBeforeUrl =
    input.beforeImageURL && isSafeDisplayImageUrl(input.beforeImageURL)
      ? input.beforeImageURL.trim().slice(0, 2048)
      : report.beforeImageURL;
  const effectiveAfterUrl =
    input.afterImageURL && isSafeDisplayImageUrl(input.afterImageURL)
      ? input.afterImageURL.trim().slice(0, 2048)
      : report.afterImageURL;
  const effectiveVerificationReason =
    input.verificationReason && input.verificationReason.trim().length >= 3
      ? input.verificationReason.trim().slice(0, 400)
      : report.verificationReason;

  const eventId = generateSafeId("EVT");
  const now = serverTimestamp();
  const path = `reports/${report.id}`;

  try {
    // Load reporter profile docs if CivicPoints or report counts changed
    const userDocRef = doc(db, "users", report.reporterId);
    const publicProfileRef = doc(db, "public_profiles", report.reporterId);
    let userSnap = null;
    let publicSnap = null;

    if (pointsDelta !== 0 || acceptedDelta !== 0 || resolvedDelta !== 0) {
      [userSnap, publicSnap] = await Promise.all([
        getDoc(userDocRef),
        getDoc(publicProfileRef),
      ]);
    }

    const batch = writeBatch(db);

    const reportUpdate: Record<string, unknown> = {
      status: input.status,
      reviewState: input.reviewState,
      publicApproved: input.publicApproved,
      pointsAwarded: nextPoints,
      needsReview:
        typeof input.needsReview === "boolean" ? input.needsReview : false,
      updatedAt: now,
    };

    if (effectiveBeforeUrl) {
      reportUpdate.beforeImageURL = effectiveBeforeUrl;
    }
    if (effectiveAfterUrl) {
      reportUpdate.afterImageURL = effectiveAfterUrl;
    }
    if (effectiveVerificationStatus) {
      reportUpdate.verificationStatus = effectiveVerificationStatus;
    }
    if (effectiveVerificationReason) {
      reportUpdate.verificationReason = effectiveVerificationReason;
    }
    if (typeof effectiveAiConfidence === "number") {
      reportUpdate.aiConfidenceScore = effectiveAiConfidence;
    }
    if (input.adminDecisionReason && input.adminDecisionReason.trim().length >= 2) {
      reportUpdate.adminDecisionReason = input.adminDecisionReason
        .trim()
        .slice(0, 300);
    }

    batch.update(doc(db, "reports", report.id), reportUpdate);

    const safeEventLabel = (
      input.eventLabel || `Updated to ${input.status.replace("_", " ")}`
    )
      .trim()
      .slice(0, 80);

    batch.set(doc(db, "reports", report.id, "events", eventId), {
      id: eventId,
      reportId: report.id,
      reportOwnerUid: report.reporterId,
      eventType: "status_changed",
      statusTransition: input.status,
      label: safeEventLabel.length >= 2 ? safeEventLabel : "Status updated",
      note: trimmedNote,
      actorUid: adminUser.uid,
      actorLabel: "CivicSnap Project Admin",
      createdAt: now,
    });

    if (userSnap && userSnap.exists()) {
      const uData = userSnap.data();
      const nextUserPoints = Math.min(
        1000000,
        Math.max(0, toSafeInt(uData.civicPoints) + pointsDelta)
      );
      const nextAcceptedCount = Math.min(
        100000,
        Math.max(0, toSafeInt(uData.acceptedReportsCount) + acceptedDelta)
      );
      const nextResolvedCount = Math.min(
        100000,
        Math.max(0, toSafeInt(uData.resolvedReportsCount) + resolvedDelta)
      );

      batch.update(userDocRef, {
        civicPoints: nextUserPoints,
        points: nextUserPoints,
        acceptedReportsCount: nextAcceptedCount,
        reportsCount: nextAcceptedCount,
        resolvedReportsCount: nextResolvedCount,
        resolvedCount: nextResolvedCount,
        updatedAt: now,
      });

      if (publicSnap && publicSnap.exists()) {
        batch.update(publicProfileRef, {
          civicPoints: nextUserPoints,
          points: nextUserPoints,
          acceptedReportsCount: nextAcceptedCount,
          reportsCount: nextAcceptedCount,
          resolvedReportsCount: nextResolvedCount,
          resolvedCount: nextResolvedCount,
          updatedAt: now,
        });
      }
    }

    if (input.reviewState === "accepted" && input.publicApproved) {
      const publicSummary = report.description.slice(0, 600);
      const publicPayload: Record<string, unknown> = {
        id: report.id,
        reporterId: report.reporterId,
        title: report.title.slice(0, 120),
        category: report.category,
        locality: report.locality.slice(0, 80),
        status: input.status,
        reviewState: "accepted",
        publicSummary:
          publicSummary.length >= 10
            ? publicSummary
            : `${report.title} reported in ${report.locality}.`,
        publicApproved: true,
        eventCount: effectiveVerificationStatus ? 3 : 2,
        createdAt: now,
        updatedAt: now,
      };
      if (effectiveBeforeUrl) {
        publicPayload.beforeImageURL = effectiveBeforeUrl;
      }
      if (effectiveAfterUrl) {
        publicPayload.afterImageURL = effectiveAfterUrl;
      }
      if (effectiveVerificationStatus) {
        publicPayload.verificationStatus = effectiveVerificationStatus;
      }
      if (effectiveVerificationReason) {
        publicPayload.verificationReason = effectiveVerificationReason;
      }
      if (typeof effectiveAiConfidence === "number") {
        publicPayload.aiConfidenceScore = effectiveAiConfidence;
      }
      if (report.imageHash && report.imageHash.length >= 8) {
        publicPayload.imageHash = report.imageHash.slice(0, 64);
      }
      if (
        report.surroundingLandmarks &&
        report.surroundingLandmarks.trim().length >= 2
      ) {
        publicPayload.surroundingLandmarks = report.surroundingLandmarks
          .trim()
          .slice(0, 200);
      }
      if (
        report.materialEstimate &&
        report.materialEstimate.trim().length >= 2
      ) {
        publicPayload.materialEstimate = report.materialEstimate
          .trim()
          .slice(0, 240);
      }
      if (
        typeof report.socialImpactScore === "number" &&
        Number.isFinite(report.socialImpactScore)
      ) {
        publicPayload.socialImpactScore = clampSocialImpactScore(
          report.socialImpactScore
        );
      }
      if (
        report.economicCostOfDelay &&
        report.economicCostOfDelay.trim().length >= 2
      ) {
        publicPayload.economicCostOfDelay = report.economicCostOfDelay
          .trim()
          .slice(0, 240);
      }
      if (
        typeof report.privateLat === "number" &&
        Number.isFinite(report.privateLat) &&
        report.privateLat >= -90 &&
        report.privateLat <= 90
      ) {
        publicPayload.lat = Number(report.privateLat.toFixed(5));
      }
      if (
        typeof report.privateLng === "number" &&
        Number.isFinite(report.privateLng) &&
        report.privateLng >= -180 &&
        report.privateLng <= 180
      ) {
        publicPayload.lng = Number(report.privateLng.toFixed(5));
      }
      if (
        report.detectedAddress &&
        report.detectedAddress.trim().length >= 2
      ) {
        publicPayload.detectedAddress = report.detectedAddress
          .trim()
          .slice(0, 160);
      }
      const priorityCheck = detectHighPriorityZone({
        title: report.title,
        description: report.description,
        locality: report.locality,
        detectedAddress: report.detectedAddress,
        surroundingLandmarks: report.surroundingLandmarks,
        lat: report.privateLat,
        lng: report.privateLng,
        explicitFlag: report.highPriorityZone,
      });
      if (priorityCheck.isHighPriority) {
        publicPayload.highPriorityZone = true;
      }
      batch.set(doc(db, "public_reports", report.id), publicPayload);
    } else if (report.publicApproved && !input.publicApproved) {
      batch.delete(doc(db, "public_reports", report.id));
    }

    await batch.commit();
    return { pointsAwarded: nextPoints, pointsDelta };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
