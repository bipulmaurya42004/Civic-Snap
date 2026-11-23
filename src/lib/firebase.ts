import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import {
  doc,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
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
 * Resolves Firebase configuration from NEXT_PUBLIC_FIREBASE_* environment
 * variables and firebase-applet-config.json, always preserving the provisioned
 * named Firestore database ID when present.
 */
const resolvedConfig: FirebaseConfigShape = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ||
    fileConfig.apiKey ||
    "",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() ||
    fileConfig.authDomain ||
    "",
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    fileConfig.projectId ||
    "",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ||
    fileConfig.storageBucket ||
    "",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() ||
    fileConfig.messagingSenderId ||
    "",
  appId:
    fileConfig.appId?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() ||
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
  try {
    dbInstance = resolvedConfig.firestoreDatabaseId
      ? initializeFirestore(
          appInstance,
          { experimentalAutoDetectLongPolling: true },
          resolvedConfig.firestoreDatabaseId
        )
      : initializeFirestore(appInstance, {
          experimentalAutoDetectLongPolling: true,
        });
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
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let connectionTested = false;

export async function testFirestoreConnection(): Promise<void> {
  if (typeof window === "undefined" || !db || connectionTested) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("the client is offline")
    ) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
