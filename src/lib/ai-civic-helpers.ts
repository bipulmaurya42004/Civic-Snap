import type {
  IssueCategory,
  IssueStatus,
  ReviewState,
  VerificationStatus,
} from "@/types/civic";

const ALLOWED_FIREBASE_STORAGE_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
]);

/**
 * Normalizes AI-returned category strings ("Pothole", "Garbage", "Streetlight",
 * etc.) into CivicSnap's canonical IssueCategory union.
 */
export function normalizeAiCategory(raw: string | null | undefined): IssueCategory {
  const value = (raw ?? "").trim().toLowerCase();
  if (
    value.includes("pothole") ||
    value.includes("road") ||
    value.includes("asphalt") ||
    value.includes("gaddha") ||
    value.includes("sadak")
  ) {
    return "pothole";
  }
  if (
    value.includes("garbage") ||
    value.includes("waste") ||
    value.includes("trash") ||
    value.includes("kachra") ||
    value.includes("kooda") ||
    value.includes("dump") ||
    value.includes("bin")
  ) {
    return "waste";
  }
  if (
    value.includes("streetlight") ||
    value.includes("street light") ||
    value.includes("lamp") ||
    value.includes("light") ||
    value.includes("batti") ||
    value.includes("bijli") ||
    value.includes("pole")
  ) {
    return "streetlight";
  }
  return "other";
}

export function getPromptCategoryName(category: IssueCategory): string {
  switch (category) {
    case "pothole":
      return "Pothole";
    case "waste":
      return "Garbage";
    case "streetlight":
      return "Streetlight";
    default:
      return "Other";
  }
}

/**
 * Exact Hinglish Voice-to-Report prompt sent to Gemini AI.
 */
export function buildHinglishVoicePrompt(transcript: string): string {
  const cleanText = transcript.replace(/\s+/g, " ").trim().slice(0, 1200);
  return `The user said this in Hinglish: "${cleanText}". Convert this into a professional English civic report with a Title, Category (Pothole/Garbage/Streetlight), and a clear Description. Keep the Title concise (5 to 110 characters) and the Description clear, polite, and factual (20 to 500 characters).`;
}

/**
 * Exact Before-vs-After repair comparison prompt sent to Gemini Vision.
 */
export function buildBeforeAfterVerificationPrompt(context?: {
  title?: string;
  category?: string;
  locality?: string;
}): string {
  const basePrompt =
    'Compare these two images of the same location. First shows a civic issue, second shows the repair. Is the issue successfully fixed? Reply with "Verified" or "Flagged" and a 1-sentence reason.';
  const details = [
    context?.title ? `Reported issue: ${context.title.slice(0, 120)}.` : "",
    context?.category ? `Category: ${context.category.slice(0, 40)}.` : "",
    context?.locality ? `Locality: ${context.locality.slice(0, 80)}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return details ? `${basePrompt}\nContext: ${details}` : basePrompt;
}

/**
 * Deterministic Demo Mode converter used ONLY when GEMINI_API_KEY is not
 * configured on the server so users can still test Hinglish Voice-to-Report.
 */
export function convertHinglishToDemoReport(transcript: string): {
  title: string;
  category: IssueCategory;
  categoryDisplay: string;
  description: string;
} {
  const cleaned = transcript.replace(/\s+/g, " ").trim();
  const lower = cleaned.toLowerCase();

  let category: IssueCategory = "other";
  if (
    /\b(gaddha|gaddhe|gadha|pothole|sadak|road|toota|tuta|crack|asphalt|pavement|paani|pani)\b/i.test(
      lower
    )
  ) {
    category = "pothole";
  } else if (
    /\b(kachra|kachara|kooda|kuda|garbage|waste|trash|bin|dustbin|gandagi|safai|dump|smell|badboo)\b/i.test(
      lower
    )
  ) {
    category = "waste";
  } else if (
    /\b(light|streetlight|lamp|batti|andhera|dark|pole|khamba|bijli|flicker|band)\b/i.test(
      lower
    )
  ) {
    category = "streetlight";
  }

  // Extract optional landmark/sector mention
  const locationMatch = cleaned.match(
    /(?:sector\s*\d+|near\s+[a-z0-9\s]{3,28}|ke\s+paas|main\s+road|market\s+road|chowk|station|park)/i
  );
  const locationSnippet = locationMatch ? ` (${locationMatch[0].trim()})` : "";

  if (category === "pothole") {
    return {
      title: `Road pothole and damaged pavement${locationSnippet}`.slice(0, 120),
      category,
      categoryDisplay: "Pothole",
      description:
        `A damaged road surface / pothole was reported via Hinglish voice input${locationSnippet}. Residents noted hazardous road conditions that require patching and resurfacing. Original voice note: "${cleaned.slice(0, 260)}".`.slice(
          0,
          600
        ),
    };
  }

  if (category === "waste") {
    return {
      title: `Uncollected garbage pile and sanitation issue${locationSnippet}`.slice(
        0,
        120
      ),
      category,
      categoryDisplay: "Garbage",
      description:
        `Overflowing garbage and uncollected waste were reported via Hinglish voice input${locationSnippet}. Prompt waste clearance and area sanitization are requested. Original voice note: "${cleaned.slice(0, 260)}".`.slice(
          0,
          600
        ),
    };
  }

  if (category === "streetlight") {
    return {
      title: `Non-functioning streetlight causing dark stretch${locationSnippet}`.slice(
        0,
        120
      ),
      category,
      categoryDisplay: "Streetlight",
      description:
        `An unlit or malfunctioning streetlight was reported via Hinglish voice input${locationSnippet}, creating poor visibility after dusk for pedestrians and commuters. Original voice note: "${cleaned.slice(0, 260)}".`.slice(
          0,
          600
        ),
    };
  }

  return {
    title: `Local civic maintenance issue reported${locationSnippet}`.slice(0, 120),
    category: "other",
    categoryDisplay: "Other",
    description:
      `A local civic issue was reported via Hinglish voice input${locationSnippet} and converted for review. Original voice note: "${cleaned.slice(0, 320)}".`.slice(
        0,
        600
      ),
  };
}

/**
 * Parses Gemini Vision JSON or plain-text output into a strict Verified/Flagged verdict.
 */
export function parseVerificationVerdict(
  rawVerdict: string | null | undefined,
  rawReason?: string | null
): {
  verdict: "Verified" | "Flagged";
  verificationStatus: "verified" | "flagged";
  reason: string;
} {
  const combined = `${rawVerdict ?? ""} ${rawReason ?? ""}`.trim();
  const normalizedVerdict = (rawVerdict ?? "").trim().toLowerCase();

  const isVerified =
    normalizedVerdict === "verified" ||
    (/^verified\b/i.test(combined) && !/\bflagged\b/i.test(normalizedVerdict));

  const verdict: "Verified" | "Flagged" = isVerified ? "Verified" : "Flagged";
  const verificationStatus: "verified" | "flagged" = isVerified
    ? "verified"
    : "flagged";

  let reason = (rawReason ?? "").replace(/\s+/g, " ").trim();
  if (!reason) {
    reason = (rawVerdict ?? "")
      .replace(/^(verified|flagged)\s*[:\-–—.]?\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  if (reason.length < 3) {
    reason = isVerified
      ? "The uploaded after photo confirms the reported civic issue has been visibly repaired."
      : "The uploaded after photo does not clearly confirm that the reported civic issue is fully repaired.";
  }

  return {
    verdict,
    verificationStatus,
    reason: reason.slice(0, 400),
  };
}

/**
 * Maps an AI Before-vs-After verdict to the exact Firestore moderation transition:
 * - Verified -> Resolved + award +25 CivicPoints
 * - Flagged  -> Keep In Progress + notify admin (no resolution bonus)
 */
export function evaluateVerificationOutcome(
  verdict: "Verified" | "Flagged",
  previousReviewState: ReviewState
): {
  status: IssueStatus;
  reviewState: ReviewState;
  publicApproved: boolean;
  verificationStatus: VerificationStatus;
  awardsResolutionBonus: boolean;
} {
  if (verdict === "Verified") {
    return {
      status: "resolved",
      reviewState: "accepted",
      publicApproved: true,
      verificationStatus: "verified",
      awardsResolutionBonus: true,
    };
  }

  const nextReviewState: ReviewState =
    previousReviewState === "accepted" ? "accepted" : previousReviewState;

  return {
    status: "in_progress",
    reviewState: nextReviewState,
    publicApproved: nextReviewState === "accepted",
    verificationStatus: "flagged",
    awardsResolutionBonus: false,
  };
}

/**
 * Strict SSRF & scheme validator for server-side image loading in /api/gemini.
 * Allows ONLY:
 * 1. Local read-only demo assets (`/demo/<safe-name>.(jpg|jpeg|png|webp)`)
 * 2. HTTPS Firebase Storage / GCS URLs (`firebasestorage.googleapis.com`,
 *    `storage.googleapis.com`, or `*.firebasestorage.app`).
 */
export function validateSafeImageSourceUrl(
  rawUrl: string | null | undefined
): { valid: boolean; kind?: "demo" | "remote"; normalized?: string; error?: string } {
  const trimmed = (rawUrl ?? "").trim();
  if (!trimmed) {
    return { valid: false, error: "Image URL is empty." };
  }
  if (trimmed.length > 2048) {
    return { valid: false, error: "Image URL exceeds maximum allowed length." };
  }

  if (trimmed.startsWith("/demo/")) {
    const match = /^\/demo\/([a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp))$/.exec(
      trimmed
    );
    if (!match) {
      return { valid: false, error: "Invalid demo image asset path." };
    }
    return { valid: true, kind: "demo", normalized: trimmed };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: "Malformed image URL." };
  }

  if (parsed.protocol !== "https:") {
    return { valid: false, error: "Only HTTPS Firebase Storage URLs are allowed." };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "169.254.169.254" ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  ) {
    return { valid: false, error: "Private or local network hosts are blocked." };
  }

  const isAllowedHost =
    ALLOWED_FIREBASE_STORAGE_HOSTS.has(hostname) ||
    hostname.endsWith(".firebasestorage.app");

  if (!isAllowedHost) {
    return {
      valid: false,
      error: "Image host must be Firebase Storage.",
    };
  }

  return { valid: true, kind: "remote", normalized: parsed.toString() };
}

/**
 * Client-side display guard preventing javascript: or data: URLs from being
 * rendered in stored Before/After image elements.
 */
export function isSafeDisplayImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (trimmed.length < 6 || trimmed.length > 2048) return false;
  if (trimmed.startsWith("/demo/")) {
    return /^\/demo\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp)$/.test(trimmed);
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Clamps an AI-produced social impact score into a safe integer 1–100.
 */
export function clampSocialImpactScore(raw: unknown): number {
  const numeric =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseFloat(raw)
        : Number.NaN;
  if (!Number.isFinite(numeric)) {
    return 50;
  }
  return Math.min(100, Math.max(1, Math.round(numeric)));
}

export function getPriorityTierFromScore(score: number): {
  label: "High Priority" | "Medium Priority" | "Standard Priority";
  tone: "high" | "medium" | "standard";
} {
  const clamped = clampSocialImpactScore(score);
  if (clamped >= 75) {
    return { label: "High Priority", tone: "high" };
  }
  if (clamped >= 45) {
    return { label: "Medium Priority", tone: "medium" };
  }
  return { label: "Standard Priority", tone: "standard" };
}

/**
 * Builds the Gemini Vision Engineering Auditing prompt for /report photo analysis.
 */
export function buildPhotoAuditPrompt(locality?: string): string {
  const locLine = locality?.trim()
    ? `Reported locality hint: ${locality.trim().slice(0, 80)}.`
    : "";
  return [
    "Analyze this civic issue photograph as a municipal civil engineering auditor.",
    "Return a professional English civic report with:",
    "1. title (concise, 5-110 chars), category (Pothole, Garbage, Streetlight, or Other), and description (factual, 20-450 chars).",
    "2. surroundingLandmarks: Identify visible surrounding context (e.g., near a school, hospital, high-traffic market, residential street, or commuter junction) for priority scoring.",
    "3. materialEstimate: Rough estimate of repair materials and crew labor needed (e.g., kgs of asphalt, liters of paint, replacement lamp unit, or hours of labor).",
    "4. socialImpactScore: Integer from 1 to 100 based on location sensitivity and safety severity.",
    "5. economicCostOfDelay: Concise estimate of the hidden 30-day economic cost to citizens (vehicle damage, delays, health or accident risk) if left unfixed.",
    locLine,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Deterministic Demo Mode photo audit fallback used ONLY when GEMINI_API_KEY
 * is not configured on the server.
 */
export function generateDemoPhotoAudit(
  fileName?: string,
  locality?: string
): {
  title: string;
  category: IssueCategory;
  categoryDisplay: string;
  description: string;
  surroundingLandmarks: string;
  materialEstimate: string;
  socialImpactScore: number;
  economicCostOfDelay: string;
} {
  const hint = `${fileName ?? ""} ${locality ?? ""}`
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase();
  const area = locality?.trim() || "local commuter road";

  if (/\b(waste|garbage|trash|bin|kachra|dump)\b/.test(hint)) {
    return {
      title: `Overflowing roadside waste accumulation near ${area}`.slice(0, 120),
      category: "waste",
      categoryDisplay: "Garbage",
      description:
        `Accumulated municipal waste and overflowing refuse visible along the street shoulder near ${area}, obstructing pedestrian movement and creating a sanitation hazard.`,
      surroundingLandmarks:
        "High-traffic pedestrian sidewalk near local shops and residential frontage",
      materialEstimate:
        "1 municipal compactor trip, ~20L disinfectant spray, 2 sanitation workers (2 labor hours)",
      socialImpactScore: 76,
      economicCostOfDelay:
        "Est. ₹12,000–₹24,000 over 30 days in localized health/sanitation impact and footfall loss to nearby shops",
    };
  }

  if (/\b(light|lamp|pole|dark|street)\b/.test(hint)) {
    return {
      title: `Non-functional streetlight fixture along ${area}`.slice(0, 120),
      category: "streetlight",
      categoryDisplay: "Streetlight",
      description:
        `Streetlight luminaire appears unlit along ${area}, leaving the footpath and carriageway poorly illuminated after dusk.`,
      surroundingLandmarks:
        "Residential footpath and evening commuter corridor near transit stop",
      materialEstimate:
        "1 LED luminaire (60W–90W), ~10m insulated cable, 1 bucket truck + 2 electricians (1.5 labor hours)",
      socialImpactScore: 72,
      economicCostOfDelay:
        "Est. ₹15,000–₹30,000 over 30 days in heightened evening accident risk and commuter safety exposure",
    };
  }

  return {
    title: `Asphalt pothole and curb-lane surface damage at ${area}`.slice(0, 120),
    category: "pothole",
    categoryDisplay: "Pothole",
    description:
      `Deep road surface cavity with loose gravel along the active carriageway edge near ${area}, posing a wheel-impact and skidding hazard for two-wheelers and cars.`,
    surroundingLandmarks:
      "Active commuter carriageway near commercial frontage and pedestrian crossing",
    materialEstimate:
      "~55 kg hot/cold-mix asphalt, 15 kg base aggregate, 2L bitumen tack coat, 3 crew labor hours",
    socialImpactScore: 84,
    economicCostOfDelay:
      "Est. ₹25,000–₹48,000 over 30 days in two-wheeler/car suspension repairs, tire damage, and traffic slowdown",
  };
}
