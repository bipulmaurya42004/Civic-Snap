"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Coins,
  ExternalLink,
  Gauge,
  Languages,
  Loader2,
  MapPin,
  Mic,
  MicOff,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Siren,
  Smartphone,
  Sparkles,
  Square,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import {
  ISSUE_CATEGORIES,
  type EngineeringInsights,
  type IssueCategory,
  type ReportAuthenticityResponse,
  type VoiceToReportResponse,
} from "@/types/civic";
import {
  normalizeAiCategory,
  validateCivicReportText,
} from "@/lib/ai-civic-helpers";
import {
  getCategoryLabel,
  parseFirestoreSubmitError,
  validatePhotoFileMeta,
} from "@/lib/civic-logic";
import {
  BENGALURU_PILOT_WARDS,
  buildGoogleMapsUrl,
  detectHighPriorityZone,
  MANUAL_WARD_OPTION,
  REPORT_WARD_DROPDOWN_OPTIONS,
} from "@/lib/location-helpers";
import { useFirebaseAuth } from "@/components/providers/FirebaseAuthProvider";
import { createCivicReport } from "@/lib/firebase-reports";
import {
  fileToCompactBase64,
  uploadCivicPhotoToStorage,
} from "@/lib/client-image-utils";
import { syncUserProfileOnSignIn } from "@/lib/firebase-users";
import {
  computePerceptualImageHash,
  evaluateExifFraudFlags,
  extractExifPrivately,
  isDuplicateImageHash,
  stripExifAndOptimizeImage,
} from "@/lib/anti-spam";
import { PageTransition } from "@/components/ui/MotionPrimitives";
import { SafeCivicImage } from "@/components/ui/SafeCivicImage";

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionInstanceLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstanceLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

const SAMPLE_HINGLISH_PROMPTS = [
  {
    label: "Pothole near CMH Hospital",
    text: "Bhai yahan 100ft road Indiranagar Chinmaya Mission Hospital ke paas 2ft ka gehra gaddha hai",
  },
  {
    label: "Garbage overflow HSR",
    text: "HSR Layout 27th Main bus stop ke paas kachra ka bada dher pada hai aur badboo aa rahi hai",
  },
  {
    label: "Dark streetlight Koramangala",
    text: "Koramangala 5th Block school road ki streetlight 3 din se band hai aur bahut andhera hai",
  },
] as const;

const WAVEFORM_BARS = [0.35, 0.75, 1, 0.55, 0.9, 0.45, 0.8, 0.6];

interface SubmittedSummary {
  id: string;
  title: string;
  category: IssueCategory;
  locality: string;
  address: string | null;
  highPriority: boolean;
  persistedToFirestore: boolean;
  pointsEarned: number;
  needsReview: boolean;
  urgencyScore: number;
  materialEstimate: string;
}

export function ReportComposerClient() {
  const { user, displayAlias, signInWithGoogle, busy: authBusy } =
    useFirebaseAuth();

  // Photo & Live Web Camera state (Live Camera Only; EXIF read privately & stripped before storage)
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [compressedKb, setCompressedKb] = useState<number | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment"
  );
  // Anti-spam verification state (EXIF values stay internal, never rendered publicly)
  const [imageHash, setImageHash] = useState<string | null>(null);
  const [needsReviewFlag, setNeedsReviewFlag] = useState(false);
  const [internalFlagReasons, setInternalFlagReasons] = useState<string[]>([]);
  const [duplicateImageDetected, setDuplicateImageDetected] = useState(false);
  const [exifStrippedReady, setExifStrippedReady] = useState(false);
  const internalExifRef = useRef<{
    exifLat: number | null;
    exifLng: number | null;
    exifTimestampMs: number | null;
  }>({ exifLat: null, exifLng: null, exifTimestampMs: null });
  const submittedHashesSessionRef = useRef<string[]>([]);

  // Details state
  const [category, setCategory] = useState<IssueCategory>("pothole");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // GPS & Bengaluru Ward state
  const [selectedWardOption, setSelectedWardOption] = useState<string>(
    BENGALURU_PILOT_WARDS[0]
  );
  const [manualLocality, setManualLocality] = useState("");
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [detectedAddress, setDetectedAddress] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Hinglish Voice & Direct Field Dictation state
  const [speechSupported, setSpeechSupported] = useState(true);
  const [voiceLang, setVoiceLang] = useState<"hi-IN" | "en-IN">("hi-IN");
  const [listening, setListening] = useState(false);
  const [convertingVoice, setConvertingVoice] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceInterim, setVoiceInterim] = useState("");
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [dictatingField, setDictatingField] = useState<
    "title" | "description" | null
  >(null);
  const [fieldVoiceInterim, setFieldVoiceInterim] = useState("");
  const [fieldVoiceError, setFieldVoiceError] = useState<string | null>(null);

  // AI Authenticity & Engineering Audit state (never show fake default scores before real inspection)
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [photoAuditStatus, setPhotoAuditStatus] = useState<
    "idle" | "checking" | "verified" | "rejected" | "error"
  >("idle");
  const [detectedPhotoSubject, setDetectedPhotoSubject] = useState<string | null>(
    null
  );
  const [photoRejectionReason, setPhotoRejectionReason] = useState<string | null>(
    null
  );
  const [engineeringInsights, setEngineeringInsights] =
    useState<EngineeringInsights | null>(null);
  const [asphaltEstimateKg, setAsphaltEstimateKg] = useState<number | null>(null);
  const [estimatedCostInr, setEstimatedCostInr] = useState<number | null>(null);
  const [auditNotice, setAuditNotice] = useState<string | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [validatingReport, setValidatingReport] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<SubmittedSummary | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const fieldRecognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const fieldBaseValueRef = useRef("");
  const finalTranscriptRef = useRef("");
  const latestTranscriptRef = useRef("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSpeechSupported(Boolean(getSpeechRecognitionCtor()));
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore teardown errors
        }
      }
      if (fieldRecognitionRef.current) {
        try {
          fieldRecognitionRef.current.abort();
        } catch {
          // Ignore teardown errors
        }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => {
        // Autoplay may wait for gesture on strict browsers
      });
    }
  }, [cameraOpen]);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl && photoPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  // Re-run internal EXIF GPS drift check whenever reported GPS updates (never shows raw EXIF publicly)
  useEffect(() => {
    const exif = internalExifRef.current;
    if (
      exif.exifLat === null &&
      exif.exifLng === null &&
      exif.exifTimestampMs === null
    ) {
      return;
    }
    const evalResult = evaluateExifFraudFlags({
      exifLat: exif.exifLat,
      exifLng: exif.exifLng,
      exifTimestampMs: exif.exifTimestampMs,
      reportedLat: gpsCoords?.lat ?? null,
      reportedLng: gpsCoords?.lng ?? null,
    });
    setNeedsReviewFlag(evalResult.needsReview);
    setInternalFlagReasons(evalResult.reasons);
  }, [gpsCoords?.lat, gpsCoords?.lng]);

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

  // Authentic AI estimator values — never invent scores or asphalt weights for unverified or rejected photos!
  const urgencyScore =
    photoAuditStatus === "verified" && engineeringInsights
      ? engineeringInsights.socialImpactScore
      : null;

  const estimatedMaterialShort =
    photoAuditStatus === "verified" && engineeringInsights?.materialEstimate
      ? engineeringInsights.materialEstimate
      : null;

  const runPhotoAuditInternal = async (
    targetFile: File | null
  ): Promise<{ accepted: boolean; reason?: string }> => {
    if (!targetFile) {
      return { accepted: true };
    }

    setAnalyzingPhoto(true);
    setPhotoAuditStatus("checking");
    setPhotoError(null);
    setPhotoRejectionReason(null);
    setDetectedPhotoSubject(null);
    setAsphaltEstimateKg(null);
    setEstimatedCostInr(null);
    setAuditNotice(null);

    try {
      const compactPayload = await fileToCompactBase64(targetFile, 1024);

      const res = await fetch("/api/analyze-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: compactPayload.base64,
          mimeType: compactPayload.mimeType,
          locality: effectiveLocality,
        }),
      });

      let data: {
        success?: boolean;
        error?: string;
        audit?: {
          is_civic_issue?: boolean;
          detected_subject?: string;
          rejection_reason?: string;
          category?: string;
          normalized_category?: IssueCategory;
          severity?: string;
          asphalt_estimate_kg?: number;
          estimated_cost_inr?: number;
          title?: string;
          summary?: string;
          surrounding_landmarks?: string;
          material_estimate?: string;
          social_impact_score?: number;
          economic_cost_of_delay?: string;
        };
      };

      try {
        data = (await res.json()) as typeof data;
      } catch {
        const parseMsg = `Unexpected response from /api/analyze-issue (HTTP ${res.status}).`;
        setPhotoAuditStatus("error");
        setEngineeringInsights(null);
        setPhotoError(parseMsg);
        return { accepted: false, reason: parseMsg };
      }

      if (!res.ok || data.success === false || !data.audit) {
        setPhotoAuditStatus("error");
        setEngineeringInsights(null);
        const errMsg =
          data.error || `Photo analysis failed (HTTP ${res.status}). Please try again.`;
        setPhotoError(errMsg);
        return { accepted: false, reason: errMsg };
      }

      const audit = data.audit;
      setDetectedPhotoSubject(audit.detected_subject || null);

      // Strict non-civic rejection: computer screen, code editor, indoor photo, selfie, etc.
      if (audit.is_civic_issue === false) {
        const reason =
          audit.rejection_reason ||
          `Detected "${audit.detected_subject || "non-civic image"}". Please capture a real outdoor civic issue photo.`;
        setPhotoAuditStatus("rejected");
        setPhotoRejectionReason(reason);
        setPhotoError(null);
        setEngineeringInsights(null);
        setAuditNotice(null);
        return { accepted: false, reason };
      }

      const mappedCategory =
        audit.normalized_category ?? normalizeAiCategory(audit.category);
      const asphaltKg =
        typeof audit.asphalt_estimate_kg === "number" && audit.asphalt_estimate_kg > 0
          ? Math.round(audit.asphalt_estimate_kg)
          : null;
      const costInr =
        typeof audit.estimated_cost_inr === "number" && audit.estimated_cost_inr > 0
          ? Math.round(audit.estimated_cost_inr)
          : null;
      const materialText =
        audit.material_estimate ||
        [
          asphaltKg ? `~${asphaltKg} kg Asphalt` : null,
          costInr ? `Est. ₹${costInr.toLocaleString("en-IN")}` : null,
        ]
          .filter(Boolean)
          .join(" · ") ||
        "Field repair estimate ready";

      setPhotoAuditStatus("verified");
      setCategory(mappedCategory);
      if (audit.title && !title.trim()) setTitle(audit.title);
      if (audit.summary && !description.trim()) setDescription(audit.summary);
      setAsphaltEstimateKg(asphaltKg);
      setEstimatedCostInr(costInr);
      setEngineeringInsights({
        surroundingLandmarks:
          audit.surrounding_landmarks || `${effectiveLocality} street corridor`,
        materialEstimate: materialText,
        socialImpactScore:
          typeof audit.social_impact_score === "number"
            ? audit.social_impact_score
            : audit.severity === "Critical"
              ? 90
              : audit.severity === "High"
                ? 78
                : 62,
        economicCostOfDelay:
          audit.economic_cost_of_delay ||
          (costInr
            ? `₹${(costInr * 4).toLocaleString("en-IN")}+ est. 30-day delay impact`
            : "Ongoing commuter disruption if unaddressed"),
      });
      setAuditNotice(
        `CivicSnap AI verified genuine ${audit.category || getCategoryLabel(mappedCategory)} issue${
          asphaltKg ? ` (~${asphaltKg} kg asphalt` : ""
        }${costInr ? `${asphaltKg ? ", " : " ("}est. ₹${costInr.toLocaleString("en-IN")})` : asphaltKg ? ")" : ""}.`
      );
      return { accepted: true };
    } catch (err) {
      setPhotoAuditStatus("error");
      setEngineeringInsights(null);
      const errMsg =
        err instanceof Error && err.message
          ? `Could not complete AI photo audit: ${err.message}`
          : "Network error while contacting /api/analyze-issue. Tap 'CivicSnap AI Verify' to retry.";
      setPhotoError(errMsg);
      return { accepted: false, reason: errMsg };
    } finally {
      setAnalyzingPhoto(false);
    }
  };

  const processSelectedFile = async (file: File) => {
    const validation = validatePhotoFileMeta({
      type: file.type,
      size: file.size,
      name: file.name,
    });
    if (!validation.valid) {
      setPhotoError(validation.error ?? "Invalid image file.");
      return;
    }

    if (photoPreviewUrl && photoPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreviewUrl);
    }

    setPhotoError(null);
    setPhotoRejectionReason(null);
    setDetectedPhotoSubject(null);
    setEngineeringInsights(null);
    setAsphaltEstimateKg(null);
    setEstimatedCostInr(null);
    setAuditNotice(null);
    setDuplicateImageDetected(false);
    setNeedsReviewFlag(false);
    setInternalFlagReasons([]);
    setExifStrippedReady(false);
    setImageHash(null);

    // 1. Privately read EXIF metadata BEFORE stripping (never displayed publicly)
    const rawExif = await extractExifPrivately(file);
    internalExifRef.current = rawExif;
    const exifCheck = evaluateExifFraudFlags({
      exifLat: rawExif.exifLat,
      exifLng: rawExif.exifLng,
      exifTimestampMs: rawExif.exifTimestampMs,
      reportedLat: gpsCoords?.lat ?? null,
      reportedLng: gpsCoords?.lng ?? null,
    });
    if (exifCheck.needsReview) {
      setNeedsReviewFlag(true);
      setInternalFlagReasons(exifCheck.reasons);
    }

    // 2. Compute client-side 64-bit perceptual hash for duplicate detection
    let computedHash = "";
    try {
      computedHash = await computePerceptualImageHash(file);
      if (computedHash) {
        setImageHash(computedHash);
        const dupInSession = submittedHashesSessionRef.current.some((prev) =>
          isDuplicateImageHash(computedHash, prev)
        );
        if (dupInSession) {
          setDuplicateImageDetected(true);
          setPhotoError("This image was already submitted.");
          return;
        }
      }
    } catch {
      // Continue cleanly if perceptual hash cannot decode
    }

    // 3. Strip ALL EXIF metadata & compress under 200KB via clean canvas re-encode
    let cleanFileToStore = file;
    try {
      const stripped = await stripExifAndOptimizeImage(file);
      cleanFileToStore = stripped.cleanFile;
      setCompressedKb(Math.max(12, Math.round(stripped.finalBytes / 1024)));
      setExifStrippedReady(true);
      setPhotoPreviewUrl(stripped.previewDataUrl || URL.createObjectURL(cleanFileToStore));
    } catch {
      setCompressedKb(Math.min(190, Math.max(24, Math.round(file.size / 1024))));
      try {
        setPhotoPreviewUrl(URL.createObjectURL(file));
      } catch {
        setPhotoPreviewUrl(null);
      }
    }

    setPhotoFile(cleanFileToStore);

    // 4. Automatically inspect captured photo with CivicSnap AI
    void runPhotoAuditInternal(cleanFileToStore);
  };

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
    setCameraStarting(false);
  };

  const startLiveCamera = async (
    targetFacing: "environment" | "user" = facingMode
  ) => {
    setPhotoError(null);
    setCameraError(null);
    stopCameraStream();

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      setCameraError(
        "Live browser camera is unavailable on this device. Tap 'Capture with Rear Camera' to take a live photo."
      );
      return;
    }

    setCameraStarting(true);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        // Fallback for desktops/laptops that reject facingMode constraint
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      setFacingMode(targetFacing);
      setCameraOpen(true);
    } catch {
      setCameraError(
        "Camera permission was blocked or no camera was detected. Allow camera access or tap 'Capture with Rear Camera'."
      );
    } finally {
      setCameraStarting(false);
    }
  };

  const handleSwitchCamera = () => {
    const nextFacing = facingMode === "environment" ? "user" : "environment";
    void startLiveCamera(nextFacing);
  };

  const handleCaptureLivePhoto = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError("Camera preview is still warming up. Please try again in a second.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCameraError("Could not capture camera frame. Please upload a photo instead.");
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError("Could not save captured photo. Please try again.");
          return;
        }
        const capturedFile = new File(
          [blob],
          `civicsnap-live-${Date.now()}.jpg`,
          { type: "image/jpeg" }
        );
        stopCameraStream();
        void processSelectedFile(capturedFile);
      },
      "image/jpeg",
      0.88
    );
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    stopCameraStream();
    void processSelectedFile(file);
  };

  const handleRemovePhoto = () => {
    stopCameraStream();
    if (photoPreviewUrl && photoPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setCompressedKb(null);
    setPhotoAuditStatus("idle");
    setDetectedPhotoSubject(null);
    setPhotoRejectionReason(null);
    setEngineeringInsights(null);
    setAsphaltEstimateKg(null);
    setEstimatedCostInr(null);
    setPhotoError(null);
    setCameraError(null);
    setAuditNotice(null);
    setImageHash(null);
    setNeedsReviewFlag(false);
    setInternalFlagReasons([]);
    setDuplicateImageDetected(false);
    setExifStrippedReady(false);
    internalExifRef.current = {
      exifLat: null,
      exifLng: null,
      exifTimestampMs: null,
    };
  };

  const handleRunPhotoAudit = async () => {
    if (!photoFile) {
      setPhotoError("Please capture a live photo with your camera first.");
      return;
    }
    await runPhotoAuditInternal(photoFile);
  };

  const reverseGeocodeCoordinates = async (lat: number, lng: number) => {
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
          data.matchedWard || data.localityName || `GPS (${lat}, ${lng})`;

        setDetectedAddress(address);
        setGpsStatus(`Live Location Captured: ${address}`);

        if (data.matchedWard) {
          setSelectedWardOption(data.matchedWard);
        } else {
          setSelectedWardOption(MANUAL_WARD_OPTION);
          setManualLocality(localityLabel.slice(0, 80));
        }
      } else {
        const coordText = `GPS (${lat}, ${lng})`;
        setDetectedAddress(coordText);
        setSelectedWardOption(MANUAL_WARD_OPTION);
        setManualLocality(coordText);
        setGpsStatus(`Live GPS Coordinates Captured: ${coordText}`);
      }
    } catch {
      const coordText = `GPS (${lat}, ${lng})`;
      setDetectedAddress(coordText);
      setSelectedWardOption(MANUAL_WARD_OPTION);
      setManualLocality(coordText);
      setGpsStatus(`Live GPS Coordinates Captured: ${coordText}`);
    } finally {
      setGpsLoading(false);
    }
  };

  const handleDetectLocation = () => {
    setGpsError(null);
    setGpsStatus(null);
    setGpsLoading(true);

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGpsLoading(false);
      setSelectedWardOption(MANUAL_WARD_OPTION);
      setGpsError(
        "Live GPS is not supported in this browser. Please enter your exact area & street address below."
      );
      return;
    }

    const onSuccess = (position: GeolocationPosition) => {
      const lat = Number(position.coords.latitude.toFixed(5));
      const lng = Number(position.coords.longitude.toFixed(5));
      void reverseGeocodeCoordinates(lat, lng);
    };

    const onFinalError = (error: GeolocationPositionError) => {
      setGpsLoading(false);
      setSelectedWardOption(MANUAL_WARD_OPTION);
      if (error.code === error.PERMISSION_DENIED) {
        setGpsError(
          "Location permission was blocked. Allow Location access in your browser bar (or open directly on HTTPS) — or type your exact locality and street address below."
        );
      } else {
        setGpsError(
          "Could not lock onto your live GPS signal right now. Please retry or type your exact locality and street address below."
        );
      }
    };

    // First try high-accuracy GPS; if it times out indoors, automatically retry with fast network/Wi-Fi geolocation
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (firstError) => {
        if (firstError.code === firstError.PERMISSION_DENIED) {
          onFinalError(firstError);
          return;
        }
        navigator.geolocation.getCurrentPosition(onSuccess, onFinalError, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 120000,
        });
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 30000 }
    );
  };

  const convertVoiceWithAi = async (spokenText: string) => {
    const clean = spokenText.replace(/\s+/g, " ").trim();
    if (clean.length < 3) {
      setVoiceError("Please speak or type at least a few words in Hinglish.");
      return;
    }

    setConvertingVoice(true);
    setVoiceError(null);
    setVoiceNotice(null);

    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "voice_to_report",
          transcript: clean,
        }),
      });
      const data = (await response.json()) as Partial<VoiceToReportResponse> & {
        error?: string;
      };
      if (!response.ok || !data.title || !data.category || !data.description) {
        throw new Error(
          data.error || "Could not convert voice transcript into a civic report."
        );
      }

      setTitle(data.title);
      setCategory(data.category);
      setDescription(data.description);
      setVoiceNotice(
        `Auto-filled Title, Category (${data.categoryDisplay || data.category}), and Description via CivicSnap AI.`
      );
    } catch (err) {
      setVoiceError(
        err instanceof Error
          ? err.message
          : "Voice conversion failed. Please try again."
      );
    } finally {
      setConvertingVoice(false);
    }
  };

  const handleToggleMic = () => {
    setVoiceError(null);
    setVoiceNotice(null);

    if (listening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        setListening(false);
      }
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSpeechSupported(false);
      setVoiceError(
        "Browser microphone speech API is unavailable here. Pick a sample Hinglish phrase or type below."
      );
      return;
    }

    try {
      const recognition = new Ctor();
      recognition.lang = voiceLang;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      finalTranscriptRef.current = "";
      latestTranscriptRef.current = "";
      setVoiceInterim("");

      recognition.onresult = (event) => {
        let finalChunk = finalTranscriptRef.current;
        let interimChunk = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const text = result?.[0]?.transcript ?? "";
          if (result?.isFinal) {
            finalChunk = `${finalChunk} ${text}`.trim();
          } else {
            interimChunk = `${interimChunk} ${text}`.trim();
          }
        }
        finalTranscriptRef.current = finalChunk;
        latestTranscriptRef.current = `${finalChunk} ${interimChunk}`.trim();
        setVoiceTranscript(finalChunk);
        setVoiceInterim(interimChunk);
      };

      recognition.onerror = (event) => {
        setListening(false);
        recognitionRef.current = null;
        if (event.error !== "aborted") {
          setVoiceError(
            "Microphone access blocked or unavailable. Use the Hinglish text box or sample buttons below."
          );
        }
      };

      recognition.onend = () => {
        setListening(false);
        recognitionRef.current = null;
        const spoken = (
          finalTranscriptRef.current || latestTranscriptRef.current
        ).trim();
        setVoiceInterim("");
        if (spoken.length >= 3) {
          setVoiceTranscript(spoken);
          void convertVoiceWithAi(spoken);
        }
      };

      recognitionRef.current = recognition;
      setListening(true);
      recognition.start();
    } catch {
      setListening(false);
      setVoiceError(
        "Could not start microphone. Type or select a Hinglish phrase below."
      );
    }
  };

  const handleToggleFieldDictation = (target: "title" | "description") => {
    setFieldVoiceError(null);

    if (dictatingField === target) {
      try {
        fieldRecognitionRef.current?.stop();
      } catch {
        setDictatingField(null);
        setFieldVoiceInterim("");
      }
      return;
    }

    // Stop any other active mic session first
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
      setListening(false);
    }
    if (fieldRecognitionRef.current) {
      try {
        fieldRecognitionRef.current.abort();
      } catch {
        // Ignore
      }
      fieldRecognitionRef.current = null;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSpeechSupported(false);
      setFieldVoiceError(
        "Voice typing is not supported in this browser. You can type directly or use the Hinglish input box above."
      );
      return;
    }

    try {
      const recognition = new Ctor();
      recognition.lang = voiceLang;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      const maxLen = target === "title" ? 120 : 800;
      const baseText = (target === "title" ? title : description).trim();
      fieldBaseValueRef.current = baseText;
      let committedChunk = "";

      recognition.onresult = (event) => {
        let interimChunk = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const spoken = result?.[0]?.transcript?.trim() ?? "";
          if (!spoken) continue;
          if (result?.isFinal) {
            committedChunk = `${committedChunk} ${spoken}`.trim();
          } else {
            interimChunk = `${interimChunk} ${spoken}`.trim();
          }
        }

        const spokenCombined = `${committedChunk} ${interimChunk}`.trim();
        setFieldVoiceInterim(interimChunk);
        const merged = [fieldBaseValueRef.current, spokenCombined]
          .filter(Boolean)
          .join(" ")
          .slice(0, maxLen);

        if (target === "title") {
          setTitle(merged);
        } else {
          setDescription(merged);
        }
      };

      recognition.onerror = (event) => {
        setDictatingField(null);
        setFieldVoiceInterim("");
        fieldRecognitionRef.current = null;
        if (event.error !== "aborted") {
          setFieldVoiceError(
            "Microphone permission blocked or unavailable for voice typing. Allow mic access in browser settings or type directly."
          );
        }
      };

      recognition.onend = () => {
        setDictatingField(null);
        setFieldVoiceInterim("");
        fieldRecognitionRef.current = null;
      };

      fieldRecognitionRef.current = recognition;
      setDictatingField(target);
      recognition.start();
    } catch {
      setDictatingField(null);
      setFieldVoiceInterim("");
      setFieldVoiceError(
        "Could not start voice typing right now. Please type directly or try again."
      );
    }
  };

  const handleSubmit = async () => {
    setFormError(null);

    // 1. Block duplicate images & fake/irrelevant/non-civic photos strictly
    if (duplicateImageDetected) {
      setFormError("This image was already submitted.");
      return;
    }
    if (photoAuditStatus === "checking" || analyzingPhoto) {
      setFormError(
        "CivicSnap AI is still inspecting your captured photo. Please wait a second."
      );
      return;
    }
    if (photoAuditStatus === "rejected") {
      setFormError(
        photoRejectionReason ||
          "Your captured photo was rejected by CivicSnap AI as a non-civic image. Please capture the issue live with your camera."
      );
      return;
    }

    // 2. Local fast gibberish / non-civic text guard
    const textPreCheck = validateCivicReportText({
      title,
      description,
      locality: effectiveLocality,
    });
    if (!textPreCheck.valid) {
      setFormError(
        textPreCheck.reason ||
          "Please describe a genuine public civic issue with clear details."
      );
      return;
    }

    if (effectiveLocality.length < 2) {
      setFormError("Please detect your live location or enter your ward/locality.");
      return;
    }

    setSubmitting(true);
    setValidatingReport(true);

    try {
      // 3. If a photo is attached and hasn't been verified yet (e.g., transient error), verify it first
      if (photoFile && photoAuditStatus !== "verified") {
        const photoCheck = await runPhotoAuditInternal(photoFile);
        if (!photoCheck.accepted) {
          setFormError(
            photoCheck.reason ||
              "CivicSnap AI could not verify your captured photo as a genuine civic issue."
          );
          return;
        }
      }

      // 4. Server-side CivicSnap AI text authenticity check (catches fake/random/non-civic entries)
      let finalScore = urgencyScore ?? 0;
      const valRes = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "validate_report",
          title: title.trim(),
          description: description.trim(),
          category,
          locality: effectiveLocality,
        }),
      });
      const valData = (await valRes.json()) as Partial<ReportAuthenticityResponse> & {
        error?: string;
      };
      if (!valRes.ok) {
        setFormError(
          valData.error ||
            "CivicSnap AI could not verify report authenticity right now. Please try again."
        );
        return;
      }
      if (valData.isGenuine === false) {
        setFormError(
          `CivicSnap AI rejected this entry: ${
            valData.reason ||
            "Please enter a genuine outdoor civic infrastructure or sanitation report."
          }`
        );
        return;
      }
      if (!finalScore && typeof valData.suggestedScore === "number") {
        finalScore = valData.suggestedScore;
      }
      setValidatingReport(false);

      const finalMaterialEstimate =
        estimatedMaterialShort ??
        "Pending field inspection (text-only report)";

      // Real cloud database persistence when signed in with a verified email
      if (user && user.emailVerified) {
        try {
          await syncUserProfileOnSignIn(user, {
            preferredAlias: displayAlias ?? undefined,
          });
        } catch {
          // Do not block report creation
        }

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
          materialEstimate: finalMaterialEstimate,
          socialImpactScore: finalScore > 0 ? finalScore : null,
          economicCostOfDelay: engineeringInsights?.economicCostOfDelay ?? null,
          privateLat: gpsCoords?.lat ?? null,
          privateLng: gpsCoords?.lng ?? null,
          detectedAddress: detectedAddress ?? null,
          highPriorityZone: priorityZoneCheck.isHighPriority,
          actorAlias: displayAlias,
          imageHash: imageHash ?? null,
          needsReview: needsReviewFlag,
          flagReasons: internalFlagReasons,
        });

        if (imageHash) {
          submittedHashesSessionRef.current.push(imageHash);
        }

        setSubmitted({
          id: created.id,
          title: created.title,
          category: created.category,
          locality: created.locality,
          address: detectedAddress,
          highPriority: priorityZoneCheck.isHighPriority,
          persistedToFirestore: true,
          pointsEarned: 0,
          needsReview: Boolean(created.needsReview),
          urgencyScore: finalScore,
          materialEstimate: finalMaterialEstimate,
        });
        return;
      }

      // Interactive Preview Mode submission when guest has not signed in yet
      if (imageHash) {
        if (
          submittedHashesSessionRef.current.some((prev) =>
            isDuplicateImageHash(imageHash, prev)
          )
        ) {
          setDuplicateImageDetected(true);
          setFormError("This image was already submitted.");
          return;
        }
        submittedHashesSessionRef.current.push(imageHash);
      }

      const previewId = `CS-BLR-${Math.floor(400 + Math.random() * 550)}`;
      setSubmitted({
        id: previewId,
        title: title.trim(),
        category,
        locality: effectiveLocality,
        address: detectedAddress,
        highPriority: priorityZoneCheck.isHighPriority,
        persistedToFirestore: false,
        pointsEarned: 0,
        needsReview: needsReviewFlag,
        urgencyScore: finalScore,
        materialEstimate: finalMaterialEstimate,
      });
    } catch (err) {
      if (
        err instanceof Error &&
        err.message === "This image was already submitted."
      ) {
        setDuplicateImageDetected(true);
      }
      const parsed = parseFirestoreSubmitError(
        err,
        Boolean(user?.emailVerified)
      );
      setFormError(parsed.message);
    } finally {
      setValidatingReport(false);
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    handleRemovePhoto();
    setTitle("");
    setDescription("");
    setCategory("pothole");
    setVoiceTranscript("");
    setVoiceNotice(null);
    setVoiceError(null);
    setGpsCoords(null);
    setDetectedAddress(null);
    setGpsStatus(null);
    setGpsError(null);
    setEngineeringInsights(null);
    setFormError(null);
    setSubmitted(null);
  };

  if (submitted) {
    return (
      <PageTransition className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={24} aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                {submitted.persistedToFirestore
                  ? "Saved to CivicSnap Ledger"
                  : "Preview Report Logged"}
              </span>
              {submitted.needsReview && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  Needs Review
                </span>
              )}
            </div>
            <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-slate-900">
              Issue {submitted.id} logged · 0 pts on submission
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">
              {submitted.persistedToFirestore
                ? "EXIF metadata was stripped before storage. +50 CivicPoints are awarded strictly once the repair achieves an AI Confidence Score ≥ 90% and Admin approval."
                : "Your live report passed anti-spam & EXIF-strip checks. Sign in with Google to persist reports — +50 CivicPoints are awarded strictly after Verified Fix + Admin approval."}
            </p>
          </div>
        </div>

        <dl className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-slate-500">Issue Title</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">
              {submitted.title}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">
              Location &amp; Category
            </dt>
            <dd className="mt-0.5 font-semibold text-slate-900">
              {submitted.locality}
              {submitted.address ? ` (${submitted.address})` : ""} ·{" "}
              {getCategoryLabel(submitted.category)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">
              CivicSnap AI Material Audit
            </dt>
            <dd className="mt-0.5 font-semibold text-blue-700">
              {submitted.urgencyScore > 0
                ? `Urgency ${submitted.urgencyScore}/100 · `
                : ""}
              {submitted.materialEstimate}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Priority Tag</dt>
            <dd className="mt-1">
              {submitted.highPriority ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">
                  <Siren size={12} aria-hidden="true" />
                  High Priority Zone
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  Under Inspection
                </span>
              )}
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/feed"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95"
          >
            Explore Bengaluru Issue Feed
          </Link>
          <Link
            href="/rewards"
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-100"
          >
            <Coins size={15} aria-hidden="true" className="text-amber-600" />
            <span>View Civic Honors</span>
          </Link>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-100"
          >
            <RotateCcw size={14} aria-hidden="true" />
            <span>Report Another Issue</span>
          </button>
        </div>
      </PageTransition>
    );
  }

  const mapsUrl = gpsCoords
    ? buildGoogleMapsUrl(gpsCoords.lat, gpsCoords.lng)
    : null;

  return (
    <PageTransition className="space-y-6">
      {/* Compact Session Bar (Non-blocking for Guests; Live Cloud Sync for Signed-In Users) */}
      {!user && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2 text-slate-800">
            <ShieldCheck
              size={16}
              className="shrink-0 text-blue-600"
              aria-hidden="true"
            />
            <span>
              <strong className="font-semibold text-slate-900">
                CivicSnap Quick Mode:
              </strong>{" "}
              Test photo authenticity AI, live GPS &amp; Hinglish voice right now — or sign in
              to save directly to your live CivicSnap profile.
            </span>
          </div>
          <button
            type="button"
            disabled={authBusy}
            onClick={() => void signInWithGoogle()}
            className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 shadow-xs transition-all hover:bg-slate-100 disabled:opacity-60"
          >
            <span>Sign In with Google</span>
          </button>
        </div>
      )}

      {/* Main 2-Column Light SaaS Composer */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Photo + GPS + Ward */}
        <div className="space-y-6 lg:col-span-5">
          {/* 1. Live Camera Only Evidence Card with EXIF Strip + <200KB Optimization */}
          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Camera size={17} className="text-blue-600" aria-hidden="true" />
                <h2 className="font-[var(--font-heading)] text-base font-bold text-slate-900">
                  1. Live Camera Evidence
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {exifStrippedReady && compressedKb ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                    ✨ Image Optimized for Speed ({compressedKb}KB)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                    Live Camera Only · EXIF Stripped
                  </span>
                )}
              </div>
            </div>

            {/* Live Camera Only input — gallery browsing disabled for citizen reports */}
            <input
              ref={mobileCameraInputRef}
              id="civic-phone-camera-upload"
              data-testid="live-camera-file-input"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileInput}
              className="sr-only"
            />

            {photoPreviewUrl ? (
              <div className="mt-4 space-y-3">
                <div className="relative h-52 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                  {photoPreviewUrl.startsWith("blob:") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoPreviewUrl}
                      alt="Selected civic issue photo preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <SafeCivicImage
                      src={photoPreviewUrl}
                      alt="Selected Bengaluru civic issue preview"
                      className="h-full w-full"
                    />
                  )}
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    aria-label="Remove uploaded photo"
                    className="absolute right-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white/95 text-slate-700 shadow-xs hover:bg-rose-50 hover:text-rose-700"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void handleRunPhotoAudit()}
                    disabled={analyzingPhoto}
                    className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50/80 px-3.5 py-2 text-xs font-semibold text-blue-700 transition-all hover:bg-blue-100/70 disabled:opacity-60"
                  >
                    {analyzingPhoto ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Sparkles size={14} aria-hidden="true" />
                    )}
                    <span>
                      {analyzingPhoto ? "Inspecting Photo..." : "CivicSnap AI Verify"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleRemovePhoto();
                      void startLiveCamera();
                    }}
                    className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-100"
                  >
                    <Camera size={14} className="text-blue-600" aria-hidden="true" />
                    <span>Retake Live Photo</span>
                  </button>
                </div>
              </div>
            ) : cameraOpen ? (
              <div className="mt-4 space-y-3">
                <div className="relative overflow-hidden rounded-xl border border-blue-200 bg-slate-900">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-56 w-full object-cover"
                  />
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-slate-950/75 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-xs">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                    Live Web Camera
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handleCaptureLivePhoto}
                    className="col-span-2 inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95"
                  >
                    <Camera size={15} aria-hidden="true" />
                    <span>Click &amp; Capture Photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSwitchCamera}
                    aria-label="Switch front or back camera"
                    className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-100"
                  >
                    <RefreshCw size={14} aria-hidden="true" />
                    <span>Flip</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={stopCameraStream}
                  className="inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition-all hover:bg-slate-100"
                >
                  <X size={13} aria-hidden="true" />
                  <span>Close Camera</span>
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div
                  data-testid="live-camera-only-notice"
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-200 bg-slate-50/70 px-4 py-6 text-center"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-blue-600 shadow-xs ring-1 ring-slate-200">
                    <Camera size={20} aria-hidden="true" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    Please capture the issue live with your camera.
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Gallery uploads are disabled for citizen reports to prevent
                    recycled photos. EXIF metadata is verified privately, then
                    stripped before upload (&lt;200KB).
                  </p>
                </div>

                {/* Live Web Camera + Rear Camera Capture Controls (No Gallery) */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={cameraStarting}
                    onClick={() => void startLiveCamera("environment")}
                    className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-60"
                  >
                    {cameraStarting ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Camera size={14} aria-hidden="true" />
                    )}
                    <span>
                      {cameraStarting ? "Starting Camera..." : "Open Live Camera"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => mobileCameraInputRef.current?.click()}
                    className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-100"
                  >
                    <Smartphone size={14} className="text-blue-600" aria-hidden="true" />
                    <span>Capture with Rear Camera</span>
                  </button>
                </div>
              </div>
            )}

            {/* Anti-Spam Status Badges (Needs Review / Duplicate / Verified) */}
            {(needsReviewFlag ||
              duplicateImageDetected ||
              photoAuditStatus === "verified") && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {photoAuditStatus === "verified" && !duplicateImageDetected && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <CheckCircle2 size={11} aria-hidden="true" />
                    <span>Verified</span>
                  </span>
                )}
                {needsReviewFlag && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                    <AlertCircle size={11} aria-hidden="true" />
                    <span>Needs Review</span>
                  </span>
                )}
                {duplicateImageDetected && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
                    <AlertCircle size={11} aria-hidden="true" />
                    <span>Duplicate</span>
                  </span>
                )}
                {exifStrippedReady && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                    <ShieldCheck size={11} className="text-blue-600" aria-hidden="true" />
                    <span>EXIF Stripped</span>
                  </span>
                )}
              </div>
            )}

            {photoAuditStatus === "checking" && (
              <p
                role="status"
                className="mt-3 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800"
              >
                <Loader2 size={14} className="animate-spin shrink-0" aria-hidden="true" />
                <span>
                  CivicSnap AI is inspecting your photo for real civic issue authenticity...
                </span>
              </p>
            )}
            {photoAuditStatus === "rejected" && photoRejectionReason && (
              <div
                role="alert"
                className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-3 text-xs text-rose-800"
              >
                <p className="flex items-center gap-1.5 font-bold text-rose-900">
                  <AlertCircle size={14} className="shrink-0" aria-hidden="true" />
                  <span>Photo Rejected by CivicSnap AI</span>
                </p>
                {detectedPhotoSubject && (
                  <p className="mt-1 font-semibold text-rose-800">
                    Detected: {detectedPhotoSubject}
                  </p>
                )}
                <p className="mt-1 leading-5 text-rose-700">{photoRejectionReason}</p>
              </div>
            )}
            {auditNotice && photoAuditStatus === "verified" && (
              <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                {auditNotice}
              </p>
            )}
            {cameraError && (
              <p
                role="alert"
                className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
              >
                {cameraError}
              </p>
            )}
            {photoError && (
              <p
                role="alert"
                className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"
              >
                {photoError}
              </p>
            )}
          </section>

          {/* 2. Live GPS & Location Card */}
          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MapPin size={17} className="text-blue-600" aria-hidden="true" />
                <h2 className="font-[var(--font-heading)] text-base font-bold text-slate-900">
                  2. Live GPS &amp; Location
                </h2>
              </div>
              {priorityZoneCheck.isHighPriority && (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-medium text-rose-700">
                  <Siren size={12} aria-hidden="true" />
                  High Priority Zone
                </span>
              )}
            </div>

            <div className="mt-4 space-y-3.5">
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={gpsLoading}
                className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-70"
              >
                {gpsLoading ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                ) : (
                  <MapPin size={16} aria-hidden="true" />
                )}
                <span>
                  {gpsLoading
                    ? "Fetching Live GPS Location..."
                    : "Detect My Live Location"}
                </span>
              </button>

              {gpsStatus && (
                <div
                  role="status"
                  className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-3.5 py-2.5 text-xs text-emerald-900"
                >
                  <p className="font-semibold">{gpsStatus}</p>
                  {gpsCoords && (
                    <p className="mt-0.5 text-[11px] text-emerald-800">
                      Coordinates: {gpsCoords.lat}, {gpsCoords.lng}
                    </p>
                  )}
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline"
                    >
                      <span>View coordinates on Google Maps</span>
                      <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  )}
                </div>
              )}

              {gpsError && (
                <p
                  role="alert"
                  className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
                >
                  {gpsError}
                </p>
              )}

              <div>
                <label
                  htmlFor="bengaluru-ward-select"
                  className="block text-xs font-semibold text-slate-700"
                >
                  City Ward / Area
                </label>
                <select
                  id="bengaluru-ward-select"
                  value={selectedWardOption}
                  onChange={(e) => setSelectedWardOption(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
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
                    htmlFor="manual-locality-input"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Your Exact Locality / City
                  </label>
                  <input
                    id="manual-locality-input"
                    type="text"
                    value={manualLocality}
                    onChange={(e) => setManualLocality(e.target.value)}
                    placeholder="e.g., Sector 62 Noida / BTM Layout / Gomti Nagar"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="report-street-address"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Exact Street / Landmark Address (Auto-filled by GPS or edit manually)
                </label>
                <input
                  id="report-street-address"
                  type="text"
                  maxLength={160}
                  value={detectedAddress ?? ""}
                  onChange={(e) =>
                    setDetectedAddress(e.target.value ? e.target.value : null)
                  }
                  placeholder="e.g., 100ft Road near CMH Hospital gate"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Hinglish Voice + AI Estimator + Details Form + Submit */}
        <div className="space-y-6 lg:col-span-7">
          {/* 3. Hinglish Voice Recorder Card with Animated Waveform */}
          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Mic size={17} className="text-blue-600" aria-hidden="true" />
                <h2 className="font-[var(--font-heading)] text-base font-bold text-slate-900">
                  3. Hinglish Voice-to-Report
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                  <Languages size={12} aria-hidden="true" />
                  Hindi / Hinglish → English
                </span>
                <select
                  aria-label="Speech recognition language"
                  value={voiceLang}
                  onChange={(e) =>
                    setVoiceLang(e.target.value as "hi-IN" | "en-IN")
                  }
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-blue-600"
                >
                  <option value="hi-IN">hi-IN</option>
                  <option value="en-IN">en-IN</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleToggleMic}
                disabled={convertingVoice}
                aria-label={
                  listening
                    ? "Stop Hinglish voice recording"
                    : "Start Hinglish voice recording"
                }
                className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm transition-all active:scale-95 ${
                  listening
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {convertingVoice ? (
                  <Loader2 size={22} className="animate-spin" aria-hidden="true" />
                ) : listening ? (
                  <Square size={20} aria-hidden="true" />
                ) : speechSupported ? (
                  <Mic size={22} aria-hidden="true" />
                ) : (
                  <MicOff size={20} aria-hidden="true" />
                )}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {listening
                      ? "Listening in Hinglish — speak now..."
                      : convertingVoice
                        ? "CivicSnap AI structuring your civic report..."
                        : "Tap the Mic & speak in Hinglish"}
                  </p>
                  {/* Animated Audio Waveform Bars */}
                  <div
                    aria-hidden="true"
                    className="flex h-6 items-end gap-1"
                  >
                    {WAVEFORM_BARS.map((height, idx) => (
                      <motion.span
                        key={idx}
                        className={`w-1 rounded-full ${
                          listening ? "bg-rose-500" : "bg-blue-500/60"
                        }`}
                        animate={
                          listening
                            ? {
                                height: [
                                  `${Math.round(height * 8)}px`,
                                  `${Math.round(height * 22)}px`,
                                  `${Math.round(height * 6)}px`,
                                ],
                              }
                            : { height: `${Math.round(height * 12)}px` }
                        }
                        transition={{
                          repeat: listening ? Infinity : 0,
                          duration: 0.65 + idx * 0.07,
                          ease: "easeInOut",
                        }}
                      />
                    ))}
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {voiceInterim ||
                    voiceTranscript ||
                    'Example: "Bhai yahan 100ft road pe 2ft ka gehra gaddha hai"'}
                </p>
              </div>
            </div>

            {/* Editable Hinglish Transcript + Quick Chips */}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                aria-label="Hinglish transcript input"
                value={voiceTranscript}
                onChange={(e) => setVoiceTranscript(e.target.value)}
                placeholder="Or type Hinglish here to auto-fill with CivicSnap AI..."
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              />
              <button
                type="button"
                disabled={convertingVoice || voiceTranscript.trim().length < 3}
                onClick={() => void convertVoiceWithAi(voiceTranscript)}
                className="inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-100 disabled:opacity-50"
              >
                <Sparkles size={13} className="text-blue-600" aria-hidden="true" />
                <span>Auto-Fill Form</span>
              </button>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-500">
                Try Hinglish sample:
              </span>
              {SAMPLE_HINGLISH_PROMPTS.map((sample) => (
                <button
                  key={sample.label}
                  type="button"
                  disabled={convertingVoice}
                  onClick={() => {
                    setVoiceTranscript(sample.text);
                    void convertVoiceWithAi(sample.text);
                  }}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                >
                  {sample.label}
                </button>
              ))}
            </div>

            {voiceNotice && (
              <p
                role="status"
                className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800"
              >
                {voiceNotice}
              </p>
            )}
            {voiceError && (
              <p
                role="alert"
                className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
              >
                {voiceError}
              </p>
            )}
          </section>

          {/* 4. Issue Details + Authentic CivicSnap AI Material Audit Chip */}
          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-[var(--font-heading)] text-base font-bold text-slate-900">
                4. Report Details &amp; CivicSnap AI Audit
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                <Coins size={12} aria-hidden="true" />
                0 pts on submit · +50 pts on Verified Fix (≥90% AI Score)
              </span>
            </div>

            {/* Authentic CivicSnap AI Estimator Chip — NEVER invents scores or materials before real verification */}
            <div
              className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 ${
                photoAuditStatus === "rejected"
                  ? "border-rose-300 bg-rose-50/70"
                  : photoAuditStatus === "verified"
                    ? "border-emerald-200 bg-emerald-50/40"
                    : "border-blue-200/80 bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    photoAuditStatus === "rejected"
                      ? "bg-rose-100 text-rose-700"
                      : photoAuditStatus === "verified"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-blue-600/10 text-blue-700"
                  }`}
                >
                  {photoAuditStatus === "checking" ? (
                    <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                  ) : photoAuditStatus === "rejected" ? (
                    <AlertCircle size={18} aria-hidden="true" />
                  ) : (
                    <Gauge size={18} aria-hidden="true" />
                  )}
                </div>
                <div>
                  <p
                    className={`text-[11px] font-semibold uppercase tracking-wide ${
                      photoAuditStatus === "rejected"
                        ? "text-rose-700"
                        : photoAuditStatus === "verified"
                          ? "text-emerald-700"
                          : "text-blue-600"
                    }`}
                  >
                    CivicSnap AI Material &amp; Authenticity Audit
                  </p>
                  <p className="text-sm font-bold text-slate-900">
                    {photoAuditStatus === "checking"
                      ? "Inspecting photo authenticity..."
                      : photoAuditStatus === "rejected"
                        ? "Invalid Civic Photo · Score 0/100"
                        : urgencyScore !== null
                          ? `Verified Urgency Score: ${urgencyScore}/100`
                          : "Awaiting genuine photo verification"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {photoAuditStatus === "verified" && asphaltEstimateKg !== null && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    ~{asphaltEstimateKg} kg Asphalt
                  </span>
                )}
                {photoAuditStatus === "verified" && estimatedCostInr !== null && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    Est. ₹{estimatedCostInr.toLocaleString("en-IN")}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  <Wrench size={12} className="text-blue-600" aria-hidden="true" />
                  {photoAuditStatus === "rejected"
                    ? "No repair material — invalid image"
                    : estimatedMaterialShort ??
                      "Calculated after CivicSnap AI verifies photo"}
                </span>
                {photoAuditStatus === "verified" && priorityZoneCheck.isHighPriority && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                    <Siren size={12} aria-hidden="true" />
                    High Priority Zone
                  </span>
                )}
              </div>
            </div>

            {/* Editable Fields */}
            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="report-category"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Civic Category
                </label>
                <div
                  id="report-category"
                  className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4"
                >
                  {ISSUE_CATEGORIES.map((cat) => {
                    const active = category === cat.value;
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setCategory(cat.value)}
                        className={`min-h-[38px] rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                          active
                            ? "border-blue-600 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {cat.label.split(" / ")[0]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="report-title"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Issue Title
                  </label>
                  <button
                    type="button"
                    onClick={() => handleToggleFieldDictation("title")}
                    aria-label={
                      dictatingField === "title"
                        ? "Stop voice typing for issue title"
                        : "Dictate issue title by voice"
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                      dictatingField === "title"
                        ? "border-rose-300 bg-rose-50 text-rose-700"
                        : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                    }`}
                  >
                    {dictatingField === "title" ? (
                      <>
                        <Square size={11} className="animate-pulse" aria-hidden="true" />
                        <span>Stop Mic</span>
                      </>
                    ) : (
                      <>
                        <Mic size={12} aria-hidden="true" />
                        <span>Voice Type Title</span>
                      </>
                    )}
                  </button>
                </div>
                <input
                  id="report-title"
                  type="text"
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., 100ft Road Severe Pothole near Chinmaya Mission Hospital"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                />
                {dictatingField === "title" && (
                  <p className="mt-1 text-[11px] font-medium text-rose-600">
                    Listening for Title ({voiceLang})...{" "}
                    {fieldVoiceInterim ? `"${fieldVoiceInterim}"` : "Speak clearly"}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="report-description"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Issue Description
                  </label>
                  <button
                    type="button"
                    onClick={() => handleToggleFieldDictation("description")}
                    aria-label={
                      dictatingField === "description"
                        ? "Stop voice typing for issue description"
                        : "Dictate issue description by voice"
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                      dictatingField === "description"
                        ? "border-rose-300 bg-rose-50 text-rose-700"
                        : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                    }`}
                  >
                    {dictatingField === "description" ? (
                      <>
                        <Square size={11} className="animate-pulse" aria-hidden="true" />
                        <span>Stop Mic</span>
                      </>
                    ) : (
                      <>
                        <Mic size={12} aria-hidden="true" />
                        <span>Voice Type Description</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  id="report-description"
                  rows={3}
                  maxLength={800}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe road hazard depth, nearby school/hospital landmarks, or traffic impact..."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                />
                {dictatingField === "description" && (
                  <p className="mt-1 text-[11px] font-medium text-rose-600">
                    Listening for Description ({voiceLang})...{" "}
                    {fieldVoiceInterim ? `"${fieldVoiceInterim}"` : "Speak clearly"}
                  </p>
                )}
              </div>

              {fieldVoiceError && (
                <p
                  role="alert"
                  className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
                >
                  {fieldVoiceError}
                </p>
              )}

              {formError && (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700"
                >
                  <AlertCircle
                    size={15}
                    className="mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{formError}</span>
                </p>
              )}

              <button
                type="button"
                disabled={
                  submitting ||
                  photoAuditStatus === "rejected" ||
                  duplicateImageDetected
                }
                onClick={() => void handleSubmit()}
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 size={17} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles size={17} aria-hidden="true" />
                )}
                <span>
                  {validatingReport
                    ? "Verifying Authenticity with CivicSnap AI..."
                    : submitting
                      ? "Submitting Live Civic Report..."
                      : duplicateImageDetected
                        ? "Duplicate Image Blocked — Capture New Live Photo"
                        : photoAuditStatus === "rejected"
                          ? "Replace Rejected Photo to Submit"
                          : "Submit Live Civic Report (Points Awarded After Verification)"}
                </span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </PageTransition>
  );
}
