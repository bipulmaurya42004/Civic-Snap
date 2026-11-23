import type { User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import {
  db,
  handleFirestoreError,
  OperationType,
} from "@/lib/firebase";
import {
  generateUniqueCouponCode,
  isAuthorizedAdminEmail,
} from "@/lib/civic-logic";
import type { RewardItem, RewardRedemptionRecord } from "@/types/civic";

export const ALIAS_MIN_LENGTH = 2;
export const ALIAS_MAX_LENGTH = 40;
export const BOOTSTRAP_ADMIN_EMAIL = "bipulmaurya42004@gmail.com";

export interface StoredUserProfile {
  uid: string;
  alias: string;
  email: string;
  leaderboardOptIn: boolean;
  civicPoints: number;
  acceptedReportsCount: number;
  resolvedReportsCount: number;
  createdAtIso: string | null;
  updatedAtIso: string | null;
}

export function sanitizeDisplayAlias(
  rawAlias: string | null | undefined,
  fallbackSeed?: string | null
): string {
  const cleaned = (rawAlias ?? "").replace(/\s+/g, " ").trim();
  if (cleaned.length >= ALIAS_MIN_LENGTH) {
    return cleaned.slice(0, ALIAS_MAX_LENGTH);
  }
  const fromSeed = (fallbackSeed ?? "")
    .split("@")[0]
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .trim();
  if (fromSeed.length >= ALIAS_MIN_LENGTH) {
    return fromSeed.slice(0, ALIAS_MAX_LENGTH);
  }
  return "CivicResident";
}

function timestampToIso(value: unknown): string | null {
  if (!value) return null;
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as Timestamp).toDate === "function"
  ) {
    return (value as Timestamp).toDate().toISOString();
  }
  if (typeof value === "string") return value;
  return null;
}

function toSafeNonNegativeInt(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.floor(value);
}

export async function fetchUserProfile(
  uid: string
): Promise<StoredUserProfile | null> {
  if (!db) return null;
  const userPath = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      uid: String(data.uid ?? uid),
      alias: String(data.alias ?? "CivicResident"),
      email: String(data.email ?? ""),
      leaderboardOptIn: Boolean(data.leaderboardOptIn),
      civicPoints: toSafeNonNegativeInt(data.civicPoints),
      acceptedReportsCount: toSafeNonNegativeInt(data.acceptedReportsCount),
      resolvedReportsCount: toSafeNonNegativeInt(data.resolvedReportsCount),
      createdAtIso: timestampToIso(data.createdAt),
      updatedAtIso: timestampToIso(data.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }
}

export async function syncUserProfileOnSignIn(
  user: User,
  options?: {
    preferredAlias?: string;
    leaderboardOptIn?: boolean;
  }
): Promise<StoredUserProfile | null> {
  if (!db) return null;

  const existing = await fetchUserProfile(user.uid);
  if (existing) {
    return existing;
  }

  const alias = sanitizeDisplayAlias(
    options?.preferredAlias || user.displayName,
    user.email
  );
  const leaderboardOptIn = Boolean(options?.leaderboardOptIn ?? false);
  const email = (user.email ?? "").slice(0, 254);

  const userPath = `users/${user.uid}`;
  try {
    const batch = writeBatch(db);
    const now = serverTimestamp();

    batch.set(doc(db, "users", user.uid), {
      uid: user.uid,
      alias,
      ...(email ? { email } : {}),
      leaderboardOptIn,
      civicPoints: 0,
      acceptedReportsCount: 0,
      resolvedReportsCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    batch.set(doc(db, "public_profiles", user.uid), {
      uid: user.uid,
      alias,
      leaderboardOptIn,
      civicPoints: 0,
      acceptedReportsCount: 0,
      resolvedReportsCount: 0,
      updatedAt: now,
    });

    await batch.commit();

    return {
      uid: user.uid,
      alias,
      email,
      leaderboardOptIn,
      civicPoints: 0,
      acceptedReportsCount: 0,
      resolvedReportsCount: 0,
      createdAtIso: new Date().toISOString(),
      updatedAtIso: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, userPath);
  }
}

export async function updateUserProfilePreferences(
  uid: string,
  input: {
    alias: string;
    leaderboardOptIn: boolean;
  }
): Promise<StoredUserProfile> {
  if (!db) {
    throw new Error("Firebase Firestore is not configured in this environment.");
  }

  const trimmedAlias = input.alias.replace(/\s+/g, " ").trim();
  if (
    trimmedAlias.length < ALIAS_MIN_LENGTH ||
    trimmedAlias.length > ALIAS_MAX_LENGTH
  ) {
    throw new Error(
      `Display alias must be between ${ALIAS_MIN_LENGTH} and ${ALIAS_MAX_LENGTH} characters.`
    );
  }

  const userPath = `users/${uid}`;
  try {
    const batch = writeBatch(db);
    const now = serverTimestamp();

    batch.update(doc(db, "users", uid), {
      alias: trimmedAlias,
      leaderboardOptIn: Boolean(input.leaderboardOptIn),
      updatedAt: now,
    });

    batch.update(doc(db, "public_profiles", uid), {
      alias: trimmedAlias,
      leaderboardOptIn: Boolean(input.leaderboardOptIn),
      updatedAt: now,
    });

    await batch.commit();

    const updated = await fetchUserProfile(uid);
    return (
      updated ?? {
        uid,
        alias: trimmedAlias,
        email: "",
        leaderboardOptIn: Boolean(input.leaderboardOptIn),
        civicPoints: 0,
        acceptedReportsCount: 0,
        resolvedReportsCount: 0,
        createdAtIso: null,
        updatedAtIso: new Date().toISOString(),
      }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export async function checkIsProjectAdmin(user: User): Promise<boolean> {
  if (user.emailVerified && isAuthorizedAdminEmail(user.email)) {
    return true;
  }
  if (!db) return false;
  const adminPath = `admins/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, "admins", user.uid));
    return snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, adminPath);
  }
}

/**
 * Atomically deducts CivicPoints from `users/{uid}` (and syncs `public_profiles/{uid}`
 * if present) and writes an immutable merchant voucher under `users/{uid}/redemptions/{id}`.
 */
export async function redeemCivicReward(
  user: User,
  reward: RewardItem
): Promise<{
  redemption: RewardRedemptionRecord;
  remainingPoints: number;
}> {
  if (!db) {
    throw new Error("Firebase Firestore is not configured in this environment.");
  }

  const userDocRef = doc(db, "users", user.uid);
  const publicDocRef = doc(db, "public_profiles", user.uid);
  const path = `users/${user.uid}/redemptions`;

  try {
    const [userSnap, publicSnap] = await Promise.all([
      getDoc(userDocRef),
      getDoc(publicDocRef),
    ]);

    if (!userSnap.exists()) {
      throw new Error(
        "Your Firestore profile is not initialized yet. Please refresh or sign in with a verified email."
      );
    }

    const currentPoints = toSafeNonNegativeInt(userSnap.data().civicPoints);
    if (currentPoints < reward.pointsCost) {
      throw new Error(
        `You need ${reward.pointsCost - currentPoints} more CivicPoints to redeem "${reward.title}".`
      );
    }

    const nextPoints = currentPoints - reward.pointsCost;
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
    const redemptionId = `RDM-${ts}-${rand}`;
    const couponCode = generateUniqueCouponCode(reward.codePrefix);
    const expiresAtMs =
      Date.now() + reward.validityMinutes * 60 * 1000;
    const now = serverTimestamp();

    const batch = writeBatch(db);
    batch.update(userDocRef, {
      civicPoints: nextPoints,
      updatedAt: now,
    });

    if (publicSnap.exists()) {
      const pubPoints = toSafeNonNegativeInt(publicSnap.data().civicPoints);
      if (pubPoints >= reward.pointsCost) {
        batch.update(publicDocRef, {
          civicPoints: pubPoints - reward.pointsCost,
          updatedAt: now,
        });
      }
    }

    batch.set(doc(db, "users", user.uid, "redemptions", redemptionId), {
      id: redemptionId,
      userId: user.uid,
      rewardId: reward.id,
      rewardTitle: reward.title,
      pointsSpent: reward.pointsCost,
      terms: reward.terms,
      couponCode,
      expiresAtMs,
      createdAt: now,
    });

    await batch.commit();

    return {
      redemption: {
        id: redemptionId,
        userId: user.uid,
        rewardId: reward.id,
        rewardTitle: reward.title,
        pointsSpent: reward.pointsCost,
        terms: reward.terms,
        couponCode,
        createdAtIso: new Date().toISOString(),
        expiresAtMs,
      },
      remainingPoints: nextPoints,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("more CivicPoints") ||
        error.message.includes("Firestore profile"))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchMyRewardRedemptions(
  uid: string
): Promise<RewardRedemptionRecord[]> {
  if (!db) return [];
  const path = `users/${uid}/redemptions`;
  try {
    const q = query(
      collection(db, "users", uid, "redemptions"),
      where("userId", "==", uid)
    );
    const snap = await getDocs(q);
    const records: RewardRedemptionRecord[] = snap.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: String(data.id ?? docSnap.id),
        userId: String(data.userId ?? uid),
        rewardId: (data.rewardId as RewardItem["id"]) ?? "gym-15-off",
        rewardTitle: String(data.rewardTitle ?? "Merchant Reward"),
        pointsSpent: toSafeNonNegativeInt(data.pointsSpent),
        terms: String(data.terms ?? ""),
        couponCode: String(data.couponCode ?? ""),
        createdAtIso: timestampToIso(data.createdAt) ?? new Date().toISOString(),
        expiresAtMs:
          typeof data.expiresAtMs === "number" ? data.expiresAtMs : 0,
      };
    });

    return records.sort(
      (a, b) =>
        new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime()
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
