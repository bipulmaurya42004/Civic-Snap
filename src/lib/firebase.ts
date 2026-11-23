import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import {
  doc,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  setLogLevel,
  type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import firebaseAppletConfig from "../../firebase-applet-config.json";

export interface FirebaseConfigShape {
  projectId?: string;
  appId?: string;
  apiKey?: string;
  authDomain?: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
}

const fileConfig = firebaseAppletConfig as FirebaseConfigShape;

const envDatabaseId = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID?.trim() || "";
const fileDatabaseId = fileConfig.firestoreDatabaseId?.trim() || "";

/**
 * Resolves Firebase configuration preferring the provisioned
 * firebase-applet-config.json (when valid) and falling back to
 * NEXT_PUBLIC_FIREBASE_* environment variables, always preserving the
 * named Firestore database ID.
 */
const hasFileProject =
  Boolean(fileConfig.projectId?.trim()) &&
  fileConfig.projectId?.trim() !== "remixed-project-id";

const resolvedConfig: FirebaseConfigShape = {
  apiKey:
    (hasFileProject ? fileConfig.apiKey?.trim() : "") ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ||
    fileConfig.apiKey ||
    "",
  authDomain:
    (hasFileProject ? fileConfig.authDomain?.trim() : "") ||
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() ||
    fileConfig.authDomain ||
    "",
  projectId:
    (hasFileProject ? fileConfig.projectId?.trim() : "") ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    fileConfig.projectId ||
    "",
  storageBucket:
    (hasFileProject ? fileConfig.storageBucket?.trim() : "") ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ||
    fileConfig.storageBucket ||
    "",
  messagingSenderId:
    (hasFileProject ? fileConfig.messagingSenderId?.trim() : "") ||
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() ||
    fileConfig.messagingSenderId ||
    "",
  appId:
    (hasFileProject ? fileConfig.appId?.trim() : "") ||
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() ||
    fileConfig.appId ||
    "",
  firestoreDatabaseId:
    fileDatabaseId ||
    (envDatabaseId && envDatabaseId !== "(default)" ? envDatabaseId : ""),
  measurementId: fileConfig.measurementId || "",
};

export function hasValidFirebaseConfig(
  config: FirebaseConfigShape = resolvedConfig
): boolean {
  const projectId = config.projectId?.trim() ?? "";
  const apiKey = config.apiKey?.trim() ?? "";
  const authDomain = config.authDomain?.trim() ?? "";
  if (!projectId || !apiKey || !authDomain) return false;
  if (projectId === "remixed-project-id") return false;
  return true;
}

export const isFirebaseConfigured = hasValidFirebaseConfig(resolvedConfig);

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;
let storageInstance: FirebaseStorage | null = null;

if (isFirebaseConfigured) {
  appInstance = getApps().length > 0 ? getApp() : initializeApp(resolvedConfig);
  if (typeof window !== "undefined") {
    // Silence internal SDK OnlineStateTracker 10s offline console.error chatter
    // on flaky mobile/iframe networks; real permission and operation errors are
    // still explicitly logged and thrown via handleFirestoreError().
    setLogLevel("silent");
  }
  const firestoreSettings = {
    experimentalAutoDetectLongPolling: true,
    experimentalLongPollingOptions: { timeoutSeconds: 8 },
    ignoreUndefinedProperties: true,
  };
  try {
    dbInstance = resolvedConfig.firestoreDatabaseId
      ? initializeFirestore(
          appInstance,
          firestoreSettings,
          resolvedConfig.firestoreDatabaseId
        )
      : initializeFirestore(appInstance, firestoreSettings);
  } catch {
    dbInstance = resolvedConfig.firestoreDatabaseId
      ? getFirestore(appInstance, resolvedConfig.firestoreDatabaseId)
      : getFirestore(appInstance);
  }
  authInstance = getAuth(appInstance);
  try {
    storageInstance = getStorage(appInstance);
  } catch {
    storageInstance = null;
  }
}

export const firebaseApp = appInstance;
export const db = dbInstance;
export const auth = authInstance;
export const storage = storageInstance;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const currentUser = auth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid ?? null,
      email: currentUser?.email ?? null,
      emailVerified: currentUser?.emailVerified ?? null,
      isAnonymous: currentUser?.isAnonymous ?? null,
      tenantId: currentUser?.tenantId ?? null,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) ?? [],
    },
    operationType,
    path,
  };
  const serialized = JSON.stringify(errInfo);
  const lowerMessage = errInfo.error.toLowerCase();
  const isTransientOffline =
    lowerMessage.includes("client is offline") ||
    lowerMessage.includes("could not reach cloud firestore backend") ||
    lowerMessage.includes("unavailable") ||
    lowerMessage.includes("network");

  if (isTransientOffline) {
    console.warn("Firestore offline fallback: ", serialized);
  } else {
    console.error("Firestore Error: ", serialized);
  }
  throw new Error(serialized);
}

let connectionTested = false;

export async function testFirestoreConnection(): Promise<void> {
  if (typeof window === "undefined" || !db || connectionTested) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("the client is offline")
    ) {
      // Log as warning rather than console.error so transient preview network
      // restrictions never trigger a blocking runtime error overlay while
      // pre-loaded Bengaluru pilot views continue working seamlessly.
      console.warn(
        "CivicSnap Cloud Sync is temporarily offline. Local pilot data remains available until connectivity resumes."
      );
    }
  }
}
