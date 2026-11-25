import {
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { isSafeDisplayImageUrl } from "@/lib/ai-civic-helpers";
import {
  ADMIN_DEFAULT_REJECTION_NOTE,
  ADMIN_POINTS_PER_RESOLVED_ISSUE,
  extractMaterialMetrics,
  normalizeAdminIssueStatus,
  shouldAwardPointsOnApprove,
  type LiveAdminIssue,
  type ReporterIdentity,
} from "@/lib/admin-issues-logic";

function timestampToIso(value: unknown): string | null {
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
  return null;
}

function mapFirestoreIssueDoc(
  docId: string,
  data: Record<string, unknown>
): LiveAdminIssue {
  const adminVerified = data.adminVerified === true;
  const status = normalizeAdminIssueStatus(data.status, adminVerified);

  const rawPhoto =
    typeof data.evidencePhotoUrl === "string"
      ? data.evidencePhotoUrl
      : typeof data.beforeImageURL === "string"
        ? data.beforeImageURL
        : typeof data.photoUrl === "string"
          ? data.photoUrl
          : null;

  const evidencePhotoUrl =
    rawPhoto && isSafeDisplayImageUrl(rawPhoto) ? rawPhoto : null;

  const metrics = extractMaterialMetrics({
    asphaltEstimateKg: data.asphaltEstimateKg,
    asphalt_estimate_kg: data.asphalt_estimate_kg,
    estimatedCostInr: data.estimatedCostInr,
    estimated_cost_inr: data.estimated_cost_inr,
    materialEstimate: data.materialEstimate,
    economicCostOfDelay: data.economicCostOfDelay,
  });

  const rawConfidence = data.aiConfidenceScore ?? data.aiScore;
  const aiConfidenceScore =
    typeof rawConfidence === "number" && Number.isFinite(rawConfidence)
      ? Math.max(0, Math.min(100, Math.round(rawConfidence)))
      : null;

  const ward =
    typeof data.ward === "string" && data.ward.trim().length > 0
      ? data.ward.trim()
      : typeof data.locality === "string" && data.locality.trim().length > 0
        ? data.locality.trim()
        : "Bengaluru";

  const location =
    typeof data.location === "string" && data.location.trim().length > 0
      ? data.location.trim()
      : typeof data.detectedAddress === "string" &&
          data.detectedAddress.trim().length > 0
        ? data.detectedAddress.trim()
        : ward;

  const lat =
    typeof data.lat === "number" &&
    Number.isFinite(data.lat) &&
    data.lat >= -90 &&
    data.lat <= 90
      ? data.lat
      : typeof data.privateLat === "number" &&
          Number.isFinite(data.privateLat) &&
          data.privateLat >= -90 &&
          data.privateLat <= 90
        ? data.privateLat
        : null;

  const lng =
    typeof data.lng === "number" &&
    Number.isFinite(data.lng) &&
    data.lng >= -180 &&
    data.lng <= 180
      ? data.lng
      : typeof data.privateLng === "number" &&
          Number.isFinite(data.privateLng) &&
          data.privateLng >= -180 &&
          data.privateLng <= 180
        ? data.privateLng
        : null;

  const rejectionNote =
    typeof data.rejectionNote === "string" &&
    data.rejectionNote.trim().length > 0
      ? data.rejectionNote.trim()
      : typeof data.rejectionReason === "string" &&
          data.rejectionReason.trim().length > 0
        ? data.rejectionReason.trim()
        : null;

  const adminActionBy =
    typeof data.adminActionBy === "string" &&
    data.adminActionBy.trim().length > 0
      ? data.adminActionBy.trim()
      : null;

  return {
    id: String(data.id ?? docId),
    reportedByUid: String(data.reportedByUid ?? data.reporterId ?? ""),
    title:
      typeof data.title === "string" && data.title.trim().length > 0
        ? data.title.trim()
        : "Civic Infrastructure Audit",
    description:
      typeof data.description === "string" ? data.description.trim() : "",
    category:
      typeof data.category === "string" && data.category.trim().length > 0
        ? data.category.trim()
        : "Pothole",
    ward,
    location,
    lat,
    lng,
    evidencePhotoUrl,
    asphaltEstimateKg: metrics.asphaltEstimateKg,
    estimatedCostInr: metrics.estimatedCostInr,
    materialEstimate:
      typeof data.materialEstimate === "string" &&
      data.materialEstimate.trim().length > 0
        ? data.materialEstimate.trim()
        : metrics.materialSummary,
    aiConfidenceScore,
    status,
    adminVerified,
    adminActionBy,
    rejectionNote,
    rejectionReason: rejectionNote,
    verifiedAtIso: timestampToIso(data.verifiedAt),
    createdAtIso: timestampToIso(data.createdAt) ?? new Date().toISOString(),
    updatedAtIso: timestampToIso(data.updatedAt) ?? new Date().toISOString(),
  };
}

/**
 * Subscribes in real time to Firestore `issues` ordered by `createdAt desc`.
 * Must only be invoked after verifying strict admin authentication.
 */
export function subscribeToLiveIssues(
  onUpdate: (issues: LiveAdminIssue[]) => void,
  onError: (message: string) => void
): Unsubscribe {
  if (!db) {
    onUpdate([]);
    return () => {};
  }

  const issuesQuery = query(
    collection(db, "issues"),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    issuesQuery,
    (snapshot) => {
      const mapped = snapshot.docs.map((docSnap) =>
        mapFirestoreIssueDoc(docSnap.id, docSnap.data() as Record<string, unknown>)
      );
      onUpdate(mapped);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, "issues");
      } catch (wrapped) {
        onError(
          wrapped instanceof Error
            ? wrapped.message
            : "Could not stream live issues from Firestore."
        );
      }
    }
  );
}

/**
 * Fetches reporting citizens' display names and emails from private `users/{uid}`
 * documents (strictly authorized for signed-in admins via `firestore.rules`, keeping
 * citizen emails isolated from the public `issues` collection).
 */
export async function fetchReporterIdentitiesForAdmin(
  uids: readonly string[]
): Promise<Record<string, ReporterIdentity>> {
  if (!db || uids.length === 0) {
    return {};
  }

  const uniqueValidUids = Array.from(
    new Set(
      uids.filter((uid) => /^[a-zA-Z0-9_-]{1,128}$/.test(uid))
    )
  );

  const entries = await Promise.all(
    uniqueValidUids.map(async (uid): Promise<[string, ReporterIdentity] | null> => {
      try {
        const snap = await getDoc(doc(db!, "users", uid));
        if (!snap.exists()) {
          return [
            uid,
            {
              uid,
              name: "Verified Citizen",
              email: null,
            },
          ];
        }
        const data = snap.data() as Record<string, unknown>;
        const name =
          (typeof data.displayName === "string" && data.displayName.trim()) ||
          (typeof data.alias === "string" && data.alias.trim()) ||
          "Verified Citizen";
        const email =
          typeof data.email === "string" && data.email.trim().length > 0
            ? data.email.trim()
            : null;
        return [uid, { uid, name, email }];
      } catch {
        return null;
      }
    })
  );

  const map: Record<string, ReporterIdentity> = {};
  for (const entry of entries) {
    if (entry) {
      map[entry[0]] = entry[1];
    }
  }
  return map;
}

/**
 * Real-time Admin Approve & Mark Resolved action:
 * 1. Updates `issues/{id}` -> status = 'Resolved', adminVerified = true,
 *    verifiedAt = serverTimestamp(), adminActionBy = adminEmail
 * 2. Atomically increments reporting citizen's `users/{reportedByUid}`:
 *    points: increment(50), resolvedCount: increment(1) (plus mirrored fields)
 * 3. Synchronizes matching `public_profiles/{reportedByUid}` and `reports/{id}` if present.
 */
export async function approveAndResolveIssue(
  issue: LiveAdminIssue,
  adminEmail: string
): Promise<{ pointsCredited: number }> {
  if (!db) {
    throw new Error("Firebase Firestore is not configured in this environment.");
  }

  const cleanAdminEmail = adminEmail.trim().slice(0, 254);
  if (!cleanAdminEmail) {
    throw new Error("Authorized admin email is required to record this action.");
  }

  const shouldCredit = shouldAwardPointsOnApprove(
    issue.status,
    issue.adminVerified
  );
  const now = serverTimestamp();
  const issueRef = doc(db, "issues", issue.id);
  const hasValidUid = /^[a-zA-Z0-9_-]{1,128}$/.test(issue.reportedByUid);

  try {
    const [userSnap, publicProfileSnap, privateReportSnap] = await Promise.all([
      shouldCredit && hasValidUid
        ? getDoc(doc(db, "users", issue.reportedByUid)).catch(() => null)
        : Promise.resolve(null),
      shouldCredit && hasValidUid
        ? getDoc(doc(db, "public_profiles", issue.reportedByUid)).catch(
            () => null
          )
        : Promise.resolve(null),
      getDoc(doc(db, "reports", issue.id)).catch(() => null),
    ]);

    const batch = writeBatch(db);

    batch.update(issueRef, {
      status: "Resolved",
      adminVerified: true,
      verifiedAt: now,
      adminActionBy: cleanAdminEmail,
      updatedAt: now,
    });

    let pointsCredited = 0;
    if (shouldCredit && userSnap && userSnap.exists()) {
      pointsCredited = ADMIN_POINTS_PER_RESOLVED_ISSUE;
      batch.update(doc(db, "users", issue.reportedByUid), {
        points: increment(ADMIN_POINTS_PER_RESOLVED_ISSUE),
        civicPoints: increment(ADMIN_POINTS_PER_RESOLVED_ISSUE),
        resolvedCount: increment(1),
        resolvedReportsCount: increment(1),
        updatedAt: now,
      });

      if (publicProfileSnap && publicProfileSnap.exists()) {
        batch.update(doc(db, "public_profiles", issue.reportedByUid), {
          points: increment(ADMIN_POINTS_PER_RESOLVED_ISSUE),
          civicPoints: increment(ADMIN_POINTS_PER_RESOLVED_ISSUE),
          resolvedCount: increment(1),
          resolvedReportsCount: increment(1),
          updatedAt: now,
        });
      }
    }

    if (privateReportSnap && privateReportSnap.exists()) {
      batch.update(doc(db, "reports", issue.id), {
        status: "resolved",
        reviewState: "accepted",
        publicApproved: true,
        pointsAwarded: ADMIN_POINTS_PER_RESOLVED_ISSUE,
        verificationStatus: "verified",
        needsReview: false,
        adminDecisionReason: `Approved & Marked Resolved by ${cleanAdminEmail}.`.slice(
          0,
          300
        ),
        updatedAt: now,
      });
    }

    await batch.commit();
    return { pointsCredited };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `issues/${issue.id}`);
  }
}

/**
 * Real-time Admin Reject as Invalid / Spam action:
 * 1. Updates `issues/{id}` -> status = 'Rejected', adminVerified = false,
 *    rejectionNote = "Marked as invalid or unverified by Admin", adminActionBy = adminEmail
 * 2. Synchronizes matching `reports/{id}` if present.
 */
export async function rejectIssueAsInvalid(
  issue: LiveAdminIssue,
  adminEmail: string,
  note: string = ADMIN_DEFAULT_REJECTION_NOTE
): Promise<void> {
  if (!db) {
    throw new Error("Firebase Firestore is not configured in this environment.");
  }

  const cleanAdminEmail = adminEmail.trim().slice(0, 254);
  if (!cleanAdminEmail) {
    throw new Error("Authorized admin email is required to record this action.");
  }

  const cleanNote =
    note.trim().slice(0, 300) || ADMIN_DEFAULT_REJECTION_NOTE;
  const now = serverTimestamp();
  const issueRef = doc(db, "issues", issue.id);

  try {
    const privateReportSnap = await getDoc(doc(db, "reports", issue.id)).catch(
      () => null
    );

    const batch = writeBatch(db);
    batch.update(issueRef, {
      status: "Rejected",
      adminVerified: false,
      rejectionNote: cleanNote,
      rejectionReason: cleanNote,
      adminActionBy: cleanAdminEmail,
      updatedAt: now,
    });

    if (privateReportSnap && privateReportSnap.exists()) {
      batch.update(doc(db, "reports", issue.id), {
        status: "pending",
        reviewState: "rejected",
        publicApproved: false,
        needsReview: false,
        adminDecisionReason: cleanNote,
        updatedAt: now,
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `issues/${issue.id}`);
  }
}
