"use client";

import {
  Component,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  auth,
  googleProvider,
  isFirebaseConfigured,
  testFirestoreConnection,
} from "@/lib/firebase";
import {
  checkIsProjectAdmin,
  fetchUserProfile,
  sanitizeDisplayAlias,
  syncUserProfileOnSignIn,
  updateUserProfilePreferences,
  type StoredUserProfile,
} from "@/lib/firebase-users";
import { ErrorState } from "@/components/ui/StateViews";

interface SignInOptions {
  preferredAlias?: string;
  leaderboardOptIn?: boolean;
}

interface EmailSignUpInput {
  alias: string;
  email: string;
  password: string;
  leaderboardOptIn?: boolean;
}

interface EmailSignInInput {
  email: string;
  password: string;
}

interface FirebaseAuthContextValue {
  user: User | null;
  profile: StoredUserProfile | null;
  displayAlias: string | null;
  isAdmin: boolean;
  authReady: boolean;
  firebaseConfigured: boolean;
  demoModeActive: boolean;
  busy: boolean;
  errorMessage: string | null;
  statusMessage: string | null;
  clearError: () => void;
  signInWithGoogle: (options?: SignInOptions) => Promise<boolean>;
  signInWithEmail: (input: EmailSignInInput) => Promise<boolean>;
  signUpWithEmail: (input: EmailSignUpInput) => Promise<boolean>;
  signOutUser: () => Promise<void>;
  saveProfilePreferences: (input: {
    alias: string;
    leaderboardOptIn: boolean;
  }) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  refreshEmailVerification: () => Promise<boolean>;
  resendVerificationEmail: () => Promise<boolean>;
}

const FirebaseAuthContext = createContext<FirebaseAuthContextValue | null>(
  null
);

class FirebaseErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message:
        error?.message ||
        "A database or authentication error occurred while loading this view.",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("CivicSnap ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <ErrorState
            title="Unable to complete Firebase request"
            message="Please retry or continue exploring CivicSnap in read-only Demo Mode."
            onRetry={() => this.setState({ hasError: false, message: "" })}
            fallbackHref="/demo"
            fallbackLabel="Open Read-Only Demo"
          />
        </div>
      );
    }
    return this.props.children;
  }
}

function mapFirebaseAuthError(err: unknown, fallback: string): string {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: string }).code)
      : "";

  switch (code) {
    case "auth/popup-closed-by-user":
      return "Google sign-in popup was closed before finishing.";
    case "auth/popup-blocked":
      return "Your browser blocked the Google sign-in popup. Allow popups for this site and try again.";
    case "auth/unauthorized-domain":
      return "This preview domain is not yet allowlisted in Firebase Authentication → Settings → Authorized domains.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in instead.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Please choose a stronger password (at least 8 characters).";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password. Please check your details and try again.";
    case "auth/too-many-requests":
      return "Too many attempts right now. Please wait a minute and try again.";
    case "auth/operation-not-allowed":
      return "Email/Password sign-in is not yet enabled in Firebase Console → Authentication → Sign-in method. You can also sign in with Google.";
    default:
      return fallback;
  }
}

function buildLocalFallbackProfile(
  nextUser: User,
  options?: SignInOptions
): StoredUserProfile {
  const cleanAlias = sanitizeDisplayAlias(
    options?.preferredAlias || nextUser.displayName,
    nextUser.email
  );
  return {
    uid: nextUser.uid,
    alias: cleanAlias,
    displayName: nextUser.displayName?.trim() || cleanAlias,
    email: nextUser.email ?? "",
    photoURL: nextUser.photoURL ?? "",
    role: "citizen",
    leaderboardOptIn: Boolean(options?.leaderboardOptIn ?? false),
    points: 0,
    reportsCount: 0,
    resolvedCount: 0,
    civicPoints: 0,
    acceptedReportsCount: 0,
    resolvedReportsCount: 0,
    createdAtIso: nextUser.metadata?.creationTime ?? null,
    updatedAtIso: new Date().toISOString(),
  };
}

export function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StoredUserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setAuthReady(true);
      return;
    }

    void testFirestoreConnection();

    let resolvedAuth = false;
    const authSafetyTimer = setTimeout(() => {
      if (!resolvedAuth) {
        setAuthReady(true);
      }
    }, 4000);

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      resolvedAuth = true;
      clearTimeout(authSafetyTimer);
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setIsAdmin(false);
        setAuthReady(true);
        return;
      }

      try {
        const existingProfile = await fetchUserProfile(nextUser.uid);
        if (existingProfile) {
          setProfile(existingProfile);
        } else if (nextUser.emailVerified) {
          const created = await syncUserProfileOnSignIn(nextUser);
          setProfile(created ?? buildLocalFallbackProfile(nextUser));
        } else {
          // Unverified email/password accounts keep a clean local profile until verified
          setProfile(buildLocalFallbackProfile(nextUser));
        }
        const adminStatus = await checkIsProjectAdmin(nextUser);
        setIsAdmin(adminStatus);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Could not load your Firestore profile.";
        setProfile(buildLocalFallbackProfile(nextUser));
        if (msg.includes("Quota exceeded")) {
          setErrorMessage(
            "Firestore daily free-tier quota exceeded. Quota resets tomorrow."
          );
        }
      } finally {
        setAuthReady(true);
      }
    });

    return () => {
      clearTimeout(authSafetyTimer);
      unsubscribe();
    };
  }, []);

  const clearError = useCallback(() => {
    setErrorMessage(null);
    setStatusMessage(null);
  }, []);

  const signInWithGoogle = useCallback(
    async (options?: SignInOptions): Promise<boolean> => {
      if (!isFirebaseConfigured || !auth) {
        setErrorMessage(
          "Firebase is not configured in this environment. You can continue using Read-Only Demo Mode."
        );
        return false;
      }

      setBusy(true);
      setErrorMessage(null);
      setStatusMessage(null);
      try {
        const credential = await signInWithPopup(auth, googleProvider);
        const signedInUser = credential.user;
        try {
          const synced = await syncUserProfileOnSignIn(signedInUser, options);
          setProfile(synced ?? buildLocalFallbackProfile(signedInUser, options));
        } catch {
          setProfile(buildLocalFallbackProfile(signedInUser, options));
        }
        try {
          const adminStatus = await checkIsProjectAdmin(signedInUser);
          setIsAdmin(adminStatus);
        } catch {
          setIsAdmin(false);
        }
        return true;
      } catch (err: unknown) {
        setErrorMessage(
          mapFirebaseAuthError(
            err,
            "Could not sign in with Google right now. Please try again or continue in Demo Mode."
          )
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const signInWithEmail = useCallback(
    async (input: EmailSignInInput): Promise<boolean> => {
      if (!isFirebaseConfigured || !auth) {
        setErrorMessage(
          "Firebase Authentication is not configured in this environment."
        );
        return false;
      }

      setBusy(true);
      setErrorMessage(null);
      setStatusMessage(null);
      try {
        const credential = await signInWithEmailAndPassword(
          auth,
          input.email.trim(),
          input.password
        );
        const signedInUser = credential.user;
        try {
          const existing = await fetchUserProfile(signedInUser.uid);
          if (existing) {
            setProfile(existing);
          } else if (signedInUser.emailVerified) {
            const synced = await syncUserProfileOnSignIn(signedInUser);
            setProfile(synced ?? buildLocalFallbackProfile(signedInUser));
          } else {
            setProfile(buildLocalFallbackProfile(signedInUser));
          }
        } catch {
          setProfile(buildLocalFallbackProfile(signedInUser));
        }
        return true;
      } catch (err: unknown) {
        setErrorMessage(
          mapFirebaseAuthError(
            err,
            "Could not sign in with email and password right now. Please try again."
          )
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const signUpWithEmail = useCallback(
    async (input: EmailSignUpInput): Promise<boolean> => {
      if (!isFirebaseConfigured || !auth) {
        setErrorMessage(
          "Firebase Authentication is not configured in this environment."
        );
        return false;
      }

      setBusy(true);
      setErrorMessage(null);
      setStatusMessage(null);
      try {
        const cleanAlias = sanitizeDisplayAlias(input.alias, input.email);
        const credential = await createUserWithEmailAndPassword(
          auth,
          input.email.trim(),
          input.password
        );
        const createdUser = credential.user;

        await updateProfile(createdUser, { displayName: cleanAlias });
        setProfile(
          buildLocalFallbackProfile(createdUser, {
            preferredAlias: cleanAlias,
            leaderboardOptIn: input.leaderboardOptIn,
          })
        );

        // Send verification email best-effort so Firestore rules accept subsequent profile syncs
        try {
          await sendEmailVerification(createdUser);
          setStatusMessage(
            "Account created! We sent a verification link to your email so your Firestore profile syncs securely."
          );
        } catch {
          // Ignore verification delivery rate limits
        }

        return true;
      } catch (err: unknown) {
        setErrorMessage(
          mapFirebaseAuthError(
            err,
            "Could not create your account right now. Please try again."
          )
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const signOutUser = useCallback(async () => {
    if (!auth) return;
    setBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await signOut(auth);
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
    } catch {
      setErrorMessage("Could not sign out cleanly. Please refresh and retry.");
    } finally {
      setBusy(false);
    }
  }, []);

  const saveProfilePreferences = useCallback(
    async (input: {
      alias: string;
      leaderboardOptIn: boolean;
    }): Promise<boolean> => {
      if (!user) {
        setErrorMessage("Please sign in before saving profile preferences.");
        return false;
      }
      setBusy(true);
      setErrorMessage(null);
      setStatusMessage(null);
      try {
        if (user.emailVerified) {
          const updated = await updateUserProfilePreferences(user.uid, input);
          setProfile(updated);
          setStatusMessage("Profile preferences saved to Firestore.");
          return true;
        }
        const cleanAlias = sanitizeDisplayAlias(input.alias, user.email);
        await updateProfile(user, { displayName: cleanAlias });
        setProfile((prev) => ({
          uid: user.uid,
          alias: cleanAlias,
          displayName: user.displayName?.trim() || prev?.displayName || cleanAlias,
          email: user.email ?? prev?.email ?? "",
          photoURL: user.photoURL ?? prev?.photoURL ?? "",
          role: prev?.role ?? "citizen",
          leaderboardOptIn: Boolean(input.leaderboardOptIn),
          points: prev?.points ?? prev?.civicPoints ?? 0,
          reportsCount: prev?.reportsCount ?? prev?.acceptedReportsCount ?? 0,
          resolvedCount: prev?.resolvedCount ?? prev?.resolvedReportsCount ?? 0,
          civicPoints: prev?.civicPoints ?? 0,
          acceptedReportsCount: prev?.acceptedReportsCount ?? 0,
          resolvedReportsCount: prev?.resolvedReportsCount ?? 0,
          createdAtIso: prev?.createdAtIso ?? null,
          updatedAtIso: new Date().toISOString(),
        }));
        setStatusMessage(
          "Display alias updated. Verify your email address to sync preferences to Firestore."
        );
        return true;
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Could not save your profile preferences."
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [user]
  );

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try {
      const latest = await fetchUserProfile(user.uid);
      if (latest) {
        setProfile(latest);
      }
      const adminStatus = await checkIsProjectAdmin(user);
      setIsAdmin(adminStatus);
    } catch {
      // Keep existing cached profile state if Firestore refresh temporarily fails
    }
  }, [user]);

  const refreshEmailVerification = useCallback(async (): Promise<boolean> => {
    if (!auth?.currentUser) return false;
    setBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      const reloaded = auth.currentUser;
      setUser(reloaded);
      if (reloaded.emailVerified) {
        try {
          const synced = await syncUserProfileOnSignIn(reloaded);
          if (synced) setProfile(synced);
        } catch {
          // Best-effort profile sync
        }
        try {
          const adminStatus = await checkIsProjectAdmin(reloaded);
          setIsAdmin(adminStatus);
        } catch {
          // Keep existing admin state
        }
        setStatusMessage(
          "Email verified! Your account is ready to submit reports to Firestore."
        );
        return true;
      }
      setErrorMessage(
        "Your email still shows as unverified. Open the verification link in your inbox, then tap Refresh Status again — or sign in with Google."
      );
      return false;
    } catch {
      setErrorMessage(
        "Could not refresh your verification status right now. Please try again."
      );
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const resendVerificationEmail = useCallback(async (): Promise<boolean> => {
    if (!auth?.currentUser) return false;
    setBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await sendEmailVerification(auth.currentUser);
      setStatusMessage(
        "Verification email sent! Check your inbox (and spam folder), click the link, then tap 'I Verified — Refresh Status'."
      );
      return true;
    } catch (err) {
      setErrorMessage(
        mapFirebaseAuthError(
          err,
          "Could not send another verification email right now. Please wait a minute or sign in with Google."
        )
      );
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const displayAlias = user
    ? profile?.alias ||
      sanitizeDisplayAlias(user.displayName, user.email)
    : null;

  const value: FirebaseAuthContextValue = {
    user,
    profile,
    displayAlias,
    isAdmin,
    authReady,
    firebaseConfigured: isFirebaseConfigured,
    demoModeActive: true,
    busy,
    errorMessage,
    statusMessage,
    clearError,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOutUser,
    saveProfilePreferences,
    refreshProfile,
    refreshEmailVerification,
    resendVerificationEmail,
  };

  return (
    <FirebaseAuthContext.Provider value={value}>
      <FirebaseErrorBoundary>{children}</FirebaseErrorBoundary>
    </FirebaseAuthContext.Provider>
  );
}

export function useFirebaseAuth(): FirebaseAuthContextValue {
  const ctx = useContext(FirebaseAuthContext);
  if (!ctx) {
    throw new Error(
      "useFirebaseAuth must be used inside a FirebaseAuthProvider."
    );
  }
  return ctx;
}
