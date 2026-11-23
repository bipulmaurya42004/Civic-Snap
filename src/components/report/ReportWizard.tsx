"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import Link from "next/link";
import {
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Siren,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import {
  ISSUE_CATEGORIES,
  type EngineeringInsights,
  type IssueCategory,
  type PhotoAuditResponse,
} from "@/types/civic";
import {
  getCategoryLabel,
  parseFirestoreSubmitError,
  validatePhotoFileMeta,
} from "@/lib/civic-logic";
import {
  BENGALURU_PILOT_WARDS,
  detectHighPriorityZone,
  MANUAL_WARD_OPTION,
  REPORT_WARD_DROPDOWN_OPTIONS,
} from "@/lib/location-helpers";
import { useFirebaseAuth } from "@/components/providers/FirebaseAuthProvider";
import {
  createCivicReport,
  type StoredPrivateReport,
} from "@/lib/firebase-reports";
import {
  fileToCompactBase64,
  uploadCivicPhotoToStorage,
} from "@/lib/client-image-utils";
import { syncUserProfileOnSignIn } from "@/lib/firebase-users";
import { HinglishVoiceInput } from "@/components/report/HinglishVoiceInput";
import { EngineeringInsightsCard } from "@/components/issues/EngineeringInsightsCard";

const STEPS = [
  { id: 1, title: "Add photo" },
  { id: 2, title: "Details & AI" },
  { id: 3, title: "Location" },
  { id: 4, title: "Review" },
] as const;

export function ReportWizard() {
  const {
    user,
    displayAlias,
    signInWithGoogle,
    refreshEmailVerification,
    resendVerificationEmail,
  } = useFirebaseAuth();
  const [step, setStep] = useState<number>(1);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [needsVerificationError, setNeedsVerificationError] = useState(false);

  const [category, setCategory] = useState<IssueCategory>("pothole");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [selectedWardOption, setSelectedWardOption] = useState<string>(
    BENGALURU_PILOT_WARDS[0]
  );
  const [manualLocality, setManualLocality] = useState("");
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [detectedAddress, setDetectedAddress] = useState<string | null>(null);
  const [capturedLocalityName, setCapturedLocalityName] = useState<string | null>(
    null
  );
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedReport, setSavedReport] = useState<StoredPrivateReport | null>(
    null
  );

  const [engineeringInsights, setEngineeringInsights] =
    useState<EngineeringInsights | null>(null);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [photoAuditError, setPhotoAuditError] = useState<string | null>(null);
  const [photoAuditNotice, setPhotoAuditNotice] = useState<string | null>(null);
  const [photoAuditDemoMode, setPhotoAuditDemoMode] = useState(false);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validatePhotoFileMeta({
      type: file.type,
      size: file.size,
      name: file.name,
    });
    if (!validation.valid) {
      setPhotoError(validation.error ?? "Invalid image file.");
      event.target.value = "";
      return;
    }

    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }

    setPhotoError(null);
    setPhotoAuditError(null);
    setPhotoAuditNotice(null);
    setEngineeringInsights(null);
    setPhotoAuditDemoMode(false);
    setPhotoFile(file);
    try {
      setPhotoPreviewUrl(URL.createObjectURL(file));
    } catch {
      setPhotoPreviewUrl(null);
    }
  };

  const handleRemovePhoto = () => {
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setPhotoError(null);
    setPhotoAuditError(null);
    setPhotoAuditNotice(null);
    setEngineeringInsights(null);
    setPhotoAuditDemoMode(false);
  };

  const handleAnalyzePhoto = async () => {
    if (!photoFile) return;
    setAnalyzingPhoto(true);
    setPhotoAuditError(null);
    setPhotoAuditNotice(null);

    try {
      const compact = await fileToCompactBase64(photoFile, 1024);
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "analyze_photo",
          image: compact,
          fileName: photoFile.name,
          locality: effectiveLocality,
        }),
      });

      const data = (await res.json()) as PhotoAuditResponse & { error?: string };
      if (!res.ok) {
        setPhotoAuditError(
          data.error || "Could not analyze photo with Gemini AI right now."
        );
        return;
      }

      setCategory(data.category);
      setTitle(data.title);
      setDescription(data.description);
      setDetailsError(null);
      setEngineeringInsights({
        surroundingLandmarks: data.surroundingLandmarks,
        materialEstimate: data.materialEstimate,
        socialImpactScore: data.socialImpactScore,
        economicCostOfDelay: data.economicCostOfDelay,
      });
      setPhotoAuditDemoMode(Boolean(data.demoMode));
      setPhotoAuditNotice(
        data.notice ||
          "Gemini Vision drafted your report details and Engineering Insights. Review or edit them in Step 2 before submitting."
      );
    } catch {
      setPhotoAuditError(
        "Network error while contacting Gemini Vision. You can still continue and enter details manually."
      );
    } finally {
      setAnalyzingPhoto(false);
    }
  };

  const handleRequestGeolocation = () => {
    setGpsError(null);
    setLocationError(null);
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGpsError(
        "GPS is not available on this device/browser. Please select a Bengaluru pilot ward or choose 'Other (Type Manually)' below."
      );
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = Number(position.coords.latitude.toFixed(5));
        const lng = Number(position.coords.longitude.toFixed(5));
        setGpsCoords({ lat, lng });

        try {
          const res = await fetch(
            `/api/geocode?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(
              String(lng)
            )}`
          );
          if (res.ok) {
            const data = (await res.json()) as {
              readableAddress?: string;
              localityName?: string;
              matchedWard?: string | null;
            };
            const address =
              data.readableAddress?.trim() || `GPS (${lat}, ${lng})`;
            const localityLabel =
              data.matchedWard || data.localityName || address;

            setDetectedAddress(address);
            setCapturedLocalityName(localityLabel);

            if (data.matchedWard) {
              setSelectedWardOption(data.matchedWard);
            } else {
              setSelectedWardOption(MANUAL_WARD_OPTION);
              setManualLocality(localityLabel.slice(0, 80));
            }
          } else {
            const fallbackLabel = `GPS (${lat}, ${lng})`;
            setDetectedAddress(fallbackLabel);
            setCapturedLocalityName(fallbackLabel);
          }
        } catch {
          const fallbackLabel = `GPS (${lat}, ${lng})`;
          setDetectedAddress(fallbackLabel);
          setCapturedLocalityName(fallbackLabel);
        } finally {
          setGpsLoading(false);
        }
      },
      (geoErr) => {
        setGpsLoading(false);
        setGpsError(
          geoErr?.code === 1
            ? "Location permission was denied. Please select a Bengaluru ward or type your locality manually below."
            : "Could not read GPS signal right now. You can pick a Bengaluru ward or choose 'Other (Type Manually)' below."
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const effectiveLocality =
    selectedWardOption === MANUAL_WARD_OPTION
      ? manualLocality.trim()
      : selectedWardOption;

  const priorityZoneCheck = detectHighPriorityZone({
    title,
    description,
    locality: effectiveLocality,
    detectedAddress,
    surroundingLandmarks: engineeringInsights?.surroundingLandmarks,
    lat: gpsCoords?.lat,
    lng: gpsCoords?.lng,
  });

  const handleNext = () => {
    if (step === 1) {
      if (!photoFile) {
        setPhotoError(
          "Attach a photo above, or tap 'Continue without photo' below to proceed."
        );
        return;
      }
      setPhotoError(null);
      setStep(2);
      return;
    }

    if (step === 2) {
      if (title.trim().length < 5) {
        setDetailsError("Please enter a concise title (at least 5 characters).");
        return;
      }
      if (description.trim().length < 10) {
        setDetailsError(
          "Please add a brief description (at least 10 characters) so reviewers understand the issue."
        );
        return;
      }
      setDetailsError(null);
      setStep(3);
      return;
    }

    if (step === 3) {
      if (effectiveLocality.length < 2) {
        setLocationError("Please select a pilot locality or enter your area name.");
        return;
      }
      setLocationError(null);
      setStep(4);
    }
  };

  const handleSkipPhoto = () => {
    setPhotoError(null);
    setStep(2);
  };

  const handleResetWizard = () => {
    handleRemovePhoto();
    setCategory("pothole");
    setTitle("");
    setDescription("");
    setSelectedWardOption(BENGALURU_PILOT_WARDS[0]);
    setManualLocality("");
    setGpsCoords(null);
    setDetectedAddress(null);
    setCapturedLocalityName(null);
    setGpsError(null);
    setSubmitError(null);
    setNeedsVerificationError(false);
    setSavedReport(null);
    setStep(1);
  };

  const handleSubmitReport = async () => {
    if (!user) {
      setSubmitError("Please sign in before submitting your civic report.");
      return;
    }

    if (title.trim().length < 5) {
      setSubmitError("Title must be at least 5 characters. Go back to Step 2 to update it.");
      return;
    }
    if (description.trim().length < 10) {
      setSubmitError("Description must be at least 10 characters. Go back to Step 2 to update it.");
      return;
    }
    if (effectiveLocality.length < 2) {
      setSubmitError("Please choose or type a locality in Step 3 before submitting.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setNeedsVerificationError(false);

    try {
      // Refresh Firebase ID token if email wasn't marked verified yet
      if (!user.emailVerified) {
        try {
          await user.reload();
          await user.getIdToken(true);
        } catch {
          // Proceed to check verified flag below
        }
      }

      if (!user.emailVerified) {
        setNeedsVerificationError(true);
        setSubmitError(
          "Your email address is not verified yet. Verify via the link in your inbox (then click 'Refresh & Retry') or sign in with Google to submit immediately."
        );
        return;
      }

      // Best-effort ensure user's Firestore profile doc exists so Admin CivicPoints awards succeed
      try {
        await syncUserProfileOnSignIn(user, {
          preferredAlias: displayAlias ?? undefined,
        });
      } catch {
        // Do not block report creation if profile sync fails
      }

      // Best-effort upload original ("Before") photo to Firebase Storage for AI Before-vs-After verification
      let beforeImageURL: string | null = null;
      if (photoFile) {
        const uploaded = await uploadCivicPhotoToStorage(
          photoFile,
          `reports/${user.uid}`
        );
        if (uploaded.url) {
          beforeImageURL = uploaded.url;
        }
      }

      const created = await createCivicReport(user, {
        title,
        category,
        description,
        locality: effectiveLocality,
        hasPhoto: Boolean(photoFile),
        photoFileName: photoFile?.name ?? null,
        beforeImageURL,
        surroundingLandmarks: engineeringInsights?.surroundingLandmarks ?? null,
        materialEstimate: engineeringInsights?.materialEstimate ?? null,
        socialImpactScore: engineeringInsights?.socialImpactScore ?? null,
        economicCostOfDelay: engineeringInsights?.economicCostOfDelay ?? null,
        privateLat: gpsCoords?.lat ?? null,
        privateLng: gpsCoords?.lng ?? null,
        detectedAddress: detectedAddress ?? null,
        highPriorityZone: priorityZoneCheck.isHighPriority,
        actorAlias: displayAlias,
      });
      setSavedReport(created);
    } catch (err) {
      const parsed = parseFirestoreSubmitError(err, Boolean(user.emailVerified));
      setNeedsVerificationError(parsed.needsEmailVerification);
      setSubmitError(parsed.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (savedReport) {
    return (
      <div className="rounded-[20px] border border-emerald-200 bg-white p-6 sm:p-8">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={22} aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Saved to Firestore
            </p>
            <h2 className="mt-1 font-[var(--font-heading)] text-2xl font-bold text-slate-900">
              Report {savedReport.id} submitted
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Your report has been saved securely under your CivicSnap account
              with status <strong className="text-slate-900">Pending</strong>.
              Authorised CivicSnap project admins review incoming reports before
              approving public summaries.
            </p>
          </div>
        </div>

        <dl className="mt-6 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-slate-50/60 text-sm">
          <div className="grid gap-1 px-4 py-3 sm:grid-cols-3">
            <dt className="font-medium text-slate-500">Report ID</dt>
            <dd className="font-mono font-semibold text-slate-900 sm:col-span-2">
              {savedReport.id}
            </dd>
          </div>
          <div className="grid gap-1 px-4 py-3 sm:grid-cols-3">
            <dt className="font-medium text-slate-500">Title</dt>
            <dd className="font-semibold text-slate-900 sm:col-span-2">
              {savedReport.title}
            </dd>
          </div>
          <div className="grid gap-1 px-4 py-3 sm:grid-cols-3">
            <dt className="font-medium text-slate-500">Category &amp; Locality</dt>
            <dd className="text-slate-900 sm:col-span-2">
              {getCategoryLabel(savedReport.category)} · {savedReport.locality}
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/profile"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8]"
          >
            View My Submitted Reports
          </Link>
          <button
            type="button"
            onClick={handleResetWizard}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50"
          >
            Submit Another Report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <nav aria-label="Report form progress">
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STEPS.map((item) => {
            const isActive = step === item.id;
            const isCompleted = step > item.id;
            return (
              <li key={item.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    if (item.id < step) setStep(item.id);
                  }}
                  disabled={item.id > step}
                  aria-current={isActive ? "step" : undefined}
                  className={`flex min-h-[42px] w-full min-w-0 items-center overflow-hidden rounded-xl border px-3 py-2 text-left transition-colors ${
                    isActive
                      ? "border-[#2563EB] bg-blue-50/70 text-[#1D4ED8]"
                      : isCompleted
                        ? "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                        : "border-slate-200/80 bg-slate-50 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold tabular-nums">
                    {isCompleted ? (
                      <Check size={13} className="shrink-0 text-[#10B981]" aria-hidden="true" />
                    ) : (
                      <span className="shrink-0">0{item.id}.</span>
                    )}
                    <span className="truncate">{item.title}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Active step panel */}
      <div className="rounded-[18px] border border-slate-200 bg-white p-5 sm:p-7">
        {/* STEP 1 — Add Photo */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Step 1: Add a photo
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Attach a clear JPEG, PNG, WebP, or HEIC photo up to 10 MB — or
                skip photo if you want to file a quick text report.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <strong className="font-semibold text-slate-900">
                Safety &amp; privacy reminder:
              </strong>{" "}
              Photograph from a safe place. Avoid identifiable people, vehicle
              plates, and private information. Metadata removal strips file EXIF
              tags, not visual details inside the photo.
            </div>

            {photoFile ? (
              <div className="space-y-3">
                {photoPreviewUrl && (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                    <img
                      src={photoPreviewUrl}
                      alt="Selected civic issue preview"
                      className="max-h-80 w-full object-cover"
                    />
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-600 tabular-nums">
                    {photoFile.name} · {(photoFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      <Upload size={14} aria-hidden="true" />
                      <span>Replace photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoChange}
                        className="sr-only"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>

                {/* Gemini Vision Engineering Photo Audit */}
                <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        <Sparkles size={15} className="text-[#2563EB]" aria-hidden="true" />
                        <span>AI Engineering Photo Audit</span>
                      </p>
                      <p className="text-xs leading-5 text-slate-600">
                        Auto-fill report details and estimate surrounding landmarks, repair materials, Social Impact Score (1–100), and 30-day cost of delay.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleAnalyzePhoto()}
                      disabled={analyzingPhoto}
                      className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap"
                    >
                      {analyzingPhoto ? (
                        <>
                          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                          <span>Auditing photo...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={14} aria-hidden="true" />
                          <span>
                            {engineeringInsights
                              ? "Re-run AI Audit"
                              : "Analyze Photo with Gemini AI"}
                          </span>
                        </>
                      )}
                    </button>
                  </div>

                  {photoAuditError && (
                    <p
                      role="alert"
                      className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
                    >
                      {photoAuditError}
                    </p>
                  )}

                  {photoAuditNotice && !photoAuditError && (
                    <p
                      role="status"
                      className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800"
                    >
                      {photoAuditNotice}
                    </p>
                  )}
                </div>

                {engineeringInsights && (
                  <EngineeringInsightsCard
                    surroundingLandmarks={engineeringInsights.surroundingLandmarks}
                    materialEstimate={engineeringInsights.materialEstimate}
                    socialImpactScore={engineeringInsights.socialImpactScore}
                    economicCostOfDelay={engineeringInsights.economicCostOfDelay}
                    demoMode={photoAuditDemoMode}
                  />
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center transition-colors hover:border-[#2563EB] hover:bg-blue-50/30">
                    <Upload size={22} className="text-[#2563EB]" aria-hidden="true" />
                    <span className="text-sm font-semibold text-slate-900">
                      Choose photo
                    </span>
                    <span className="text-xs text-slate-500">
                      JPEG, PNG, WebP, or HEIC · Max 10 MB
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="sr-only"
                    />
                  </label>

                  <label className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center transition-colors hover:border-[#2563EB] hover:bg-blue-50/30">
                    <Camera size={22} className="text-slate-700" aria-hidden="true" />
                    <span className="text-sm font-semibold text-slate-900">
                      Take photo
                    </span>
                    <span className="text-xs text-slate-500">
                      Opens device camera where supported
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoChange}
                      className="sr-only"
                    />
                  </label>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSkipPhoto}
                    className="inline-flex min-h-[38px] items-center rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Continue without photo
                  </button>
                </div>
              </div>
            )}

            {photoError && (
              <p role="alert" className="text-sm font-medium text-red-600">
                {photoError}
              </p>
            )}
          </div>
        )}

        {/* STEP 2 — AI Suggestion & Editable Details */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Step 2: Category &amp; description
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Analyze your uploaded photo for AI Engineering Insights, speak in
                Hindi or Hinglish using the microphone button, or type all fields
                manually.
              </p>
            </div>

            {photoFile && !engineeringInsights && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/50 px-4 py-3">
                <p className="text-xs leading-5 text-slate-700">
                  <strong className="font-semibold text-slate-900">
                    Photo ready for Engineering Audit:
                  </strong>{" "}
                  Run Gemini Vision to auto-fill details and generate priority &amp;
                  material insights.
                </p>
                <button
                  type="button"
                  onClick={() => void handleAnalyzePhoto()}
                  disabled={analyzingPhoto}
                  className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl bg-[#2563EB] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-60 whitespace-nowrap"
                >
                  {analyzingPhoto ? (
                    <>
                      <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                      <span>Auditing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} aria-hidden="true" />
                      <span>Run AI Photo Audit</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {engineeringInsights && (
              <EngineeringInsightsCard
                surroundingLandmarks={engineeringInsights.surroundingLandmarks}
                materialEstimate={engineeringInsights.materialEstimate}
                socialImpactScore={engineeringInsights.socialImpactScore}
                economicCostOfDelay={engineeringInsights.economicCostOfDelay}
                demoMode={photoAuditDemoMode}
              />
            )}

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="report-category"
                  className="mb-1.5 block text-sm font-medium text-slate-900"
                >
                  Issue category
                </label>
                <select
                  id="report-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as IssueCategory)}
                  className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900"
                >
                  {ISSUE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="report-title"
                  className="mb-1.5 block text-sm font-medium text-slate-900"
                >
                  Short title
                </label>
                <input
                  id="report-title"
                  type="text"
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Broken asphalt near bus stop curb"
                  className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="report-description"
                    className="block text-sm font-medium text-slate-900"
                  >
                    Short description
                  </label>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB]">
                    <Sparkles size={12} aria-hidden="true" />
                    Voice-to-Report enabled
                  </span>
                </div>

                <HinglishVoiceInput
                  onAutoFill={({ title: aiTitle, category: aiCat, description: aiDesc }) => {
                    setTitle(aiTitle);
                    setCategory(aiCat);
                    setDescription(aiDesc);
                    setDetailsError(null);
                  }}
                />

                <textarea
                  id="report-description"
                  rows={4}
                  maxLength={600}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what you noticed and any helpful landmark without sharing private personal details — or tap 'Speak in Hinglish' above."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            {detailsError && (
              <p role="alert" className="text-sm font-medium text-red-600">
                {detailsError}
              </p>
            )}
          </div>
        )}

        {/* STEP 3 — Smart GPS & Bengaluru Pilot Ward */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Step 3: Detect GPS &amp; select Bengaluru ward
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Use live GPS to capture exact coordinates and reverse-geocode
                your street address, or pick a Bengaluru pilot ward below.
              </p>
            </div>

            {/* Smart GPS Capture Card */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50/45 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    Real-Time GPS &amp; Reverse Geocoding
                  </p>
                  <p className="text-xs leading-5 text-slate-600">
                    Fetches your live latitude/longitude and converts it into a
                    readable street address and Bengaluru ward.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRequestGeolocation}
                  disabled={gpsLoading}
                  className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-65 whitespace-nowrap sm:w-auto"
                >
                  {gpsLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      <span>Detecting Location...</span>
                    </>
                  ) : (
                    <>
                      <MapPin size={16} aria-hidden="true" />
                      <span>Detect My Location</span>
                    </>
                  )}
                </button>
              </div>

              {capturedLocalityName && (
                <div
                  role="status"
                  className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs text-emerald-900"
                >
                  <p className="flex items-center gap-1.5 font-semibold">
                    <CheckCircle2
                      size={15}
                      className="shrink-0 text-emerald-600"
                      aria-hidden="true"
                    />
                    <span>Location Captured: {capturedLocalityName}</span>
                  </p>
                  {detectedAddress && detectedAddress !== capturedLocalityName && (
                    <p className="mt-1 pl-5 text-emerald-800">
                      Address: {detectedAddress}
                    </p>
                  )}
                  {gpsCoords && (
                    <p className="mt-1 pl-5 font-mono text-[11px] tabular-nums text-emerald-700">
                      Coordinates: {gpsCoords.lat}, {gpsCoords.lng}
                    </p>
                  )}
                </div>
              )}

              {gpsError && (
                <p
                  role="alert"
                  className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-900"
                >
                  {gpsError}
                </p>
              )}
            </div>

            {/* Bengaluru Pilot Ward Dropdown + Manual Fallback */}
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="report-locality"
                  className="mb-1.5 block text-sm font-medium text-slate-900"
                >
                  Bengaluru Pilot Ward
                </label>
                <select
                  id="report-locality"
                  value={selectedWardOption}
                  onChange={(e) => {
                    setSelectedWardOption(e.target.value);
                    setLocationError(null);
                  }}
                  className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900"
                >
                  {REPORT_WARD_DROPDOWN_OPTIONS.map((ward) => (
                    <option key={ward} value={ward}>
                      {ward}
                    </option>
                  ))}
                </select>
              </div>

              {selectedWardOption === MANUAL_WARD_OPTION && (
                <div>
                  <label
                    htmlFor="report-manual-locality"
                    className="mb-1.5 block text-sm font-medium text-slate-900"
                  >
                    Enter ward or locality manually
                  </label>
                  <input
                    id="report-manual-locality"
                    type="text"
                    maxLength={80}
                    value={manualLocality}
                    onChange={(e) => {
                      setManualLocality(e.target.value);
                      setLocationError(null);
                    }}
                    placeholder="e.g., 12th Main Rd, Indiranagar or BTM Layout"
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              )}

              {priorityZoneCheck.isHighPriority && (
                <div
                  role="status"
                  className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-xs text-red-900"
                >
                  <Siren
                    size={16}
                    className="mt-0.5 shrink-0 text-red-600"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-semibold text-red-800">
                      High Priority Zone Detected
                    </p>
                    <p className="mt-0.5 text-red-700">
                      {priorityZoneCheck.reason || "Near Hospital or School"} — this
                      report will be automatically flagged as a High Priority Zone
                      in the public feed and Admin queue.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {locationError && (
              <p role="alert" className="text-sm font-medium text-red-600">
                {locationError}
              </p>
            )}
          </div>
        )}

        {/* STEP 4 — Review & Submit */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Step 4: Review your report
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Confirm your details before saving.
              </p>
            </div>

            {photoPreviewUrl && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                <img
                  src={photoPreviewUrl}
                  alt="Report photo review"
                  className="max-h-64 w-full object-cover"
                />
              </div>
            )}

            <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-slate-50/50 text-sm">
              <div className="grid gap-1 px-4 py-3 sm:grid-cols-3">
                <dt className="font-medium text-slate-500">Title</dt>
                <dd className="font-semibold text-slate-900 sm:col-span-2">
                  {title}
                </dd>
              </div>
              <div className="grid gap-1 px-4 py-3 sm:grid-cols-3">
                <dt className="font-medium text-slate-500">Category</dt>
                <dd className="text-slate-900 sm:col-span-2">
                  {getCategoryLabel(category)}
                </dd>
              </div>
              <div className="grid gap-1 px-4 py-3 sm:grid-cols-3">
                <dt className="font-medium text-slate-500">Bengaluru Ward</dt>
                <dd className="text-slate-900 sm:col-span-2">
                  <span className="font-semibold">{effectiveLocality}</span>
                  {detectedAddress && (
                    <span className="block text-xs text-slate-600">
                      Detected address: {detectedAddress}
                    </span>
                  )}
                  {gpsCoords && (
                    <span className="block font-mono text-[11px] tabular-nums text-slate-500">
                      GPS: {gpsCoords.lat}, {gpsCoords.lng}
                    </span>
                  )}
                  {priorityZoneCheck.isHighPriority && (
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                      <Siren size={12} aria-hidden="true" />
                      <span>High Priority Zone</span>
                    </span>
                  )}
                </dd>
              </div>
              <div className="grid gap-1 px-4 py-3 sm:grid-cols-3">
                <dt className="font-medium text-slate-500">Description</dt>
                <dd className="text-slate-700 sm:col-span-2">{description}</dd>
              </div>
              <div className="grid gap-1 px-4 py-3 sm:grid-cols-3">
                <dt className="font-medium text-slate-500">Privacy handling</dt>
                <dd className="text-slate-700 sm:col-span-2">
                  Raw photos and optional GPS coordinates remain private to you
                  and authorised CivicSnap project admins. Public listings show
                  only approved summary fields.
                </dd>
              </div>
            </dl>

            {engineeringInsights && (
              <EngineeringInsightsCard
                surroundingLandmarks={engineeringInsights.surroundingLandmarks}
                materialEstimate={engineeringInsights.materialEstimate}
                socialImpactScore={engineeringInsights.socialImpactScore}
                economicCostOfDelay={engineeringInsights.economicCostOfDelay}
                demoMode={photoAuditDemoMode}
              />
            )}

            <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 text-sm text-slate-800">
              <div className="flex items-start gap-2.5">
                <Info
                  size={17}
                  className="mt-0.5 shrink-0 text-[#2563EB]"
                  aria-hidden="true"
                />
                <p className="leading-6">
                  <strong className="font-semibold text-slate-900">
                    Firebase Firestore submission:
                  </strong>{" "}
                  Clicking Submit saves your report privately to Firestore under
                  your account along with an initial Pending timeline event.
                  CivicSnap is an independent platform—submitting does not
                  automatically forward reports to government authorities.
                </p>
              </div>
            </div>

            {submitError && (
              <div
                role="alert"
                className="space-y-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                <p>{submitError}</p>
                {needsVerificationError && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        const verified = await refreshEmailVerification();
                        if (verified) {
                          void handleSubmitReport();
                        }
                      }}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 text-xs font-semibold text-white hover:bg-[#1D4ED8]"
                    >
                      <RefreshCw size={13} aria-hidden="true" />
                      <span>Refresh &amp; Retry</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void resendVerificationEmail()}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-800 hover:bg-red-100/50"
                    >
                      <span>Resend Verification Email</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void signInWithGoogle()}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      <ShieldCheck size={13} aria-hidden="true" className="text-[#2563EB]" />
                      <span>Sign in with Google</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step Navigation Controls */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => prev - 1)}
              disabled={submitting}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap disabled:opacity-60"
            >
              <ChevronLeft size={16} aria-hidden="true" />
              <span>Back</span>
            </button>
          ) : (
            <Link
              href="/demo"
              className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
            >
              Want to explore first? Try Demo
            </Link>
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8] whitespace-nowrap"
            >
              <span>Continue</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSubmitReport()}
              disabled={submitting}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8] whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              )}
              <span>{submitting ? "Saving to Firestore..." : "Submit Report"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
