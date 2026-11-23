import { isFirebaseConfigured } from "@/lib/firebase";

export interface BackendReadiness {
  firebaseConfigured: boolean;
  geminiConfigured: boolean;
  demoModeEnabled: boolean;
}

export function getPublicBackendStatus(): {
  firebaseConfigured: boolean;
  demoModeEnabled: boolean;
} {
  return {
    firebaseConfigured: isFirebaseConfigured,
    demoModeEnabled: true,
  };
}

export function getServerBackendStatus(): BackendReadiness {
  const geminiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
  return {
    firebaseConfigured: isFirebaseConfigured,
    geminiConfigured: Boolean(geminiKey),
    demoModeEnabled: true,
  };
}
