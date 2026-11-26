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
 * Deterministic pre-filter that catches obvious gibberish, keyboard mash,
 * placeholder test strings, or clearly non-civic subjects (e.g. laptops,
 * phones, personal gadgets) before/alongside CivicSnap AI evaluation.
 */
export function validateCivicReportText(input: {
  title: string;
  description: string;
  locality?: string;
}): { valid: boolean; reason?: string } {
  const title = input.title.replace(/\s+/g, " ").trim();
  const description = input.description.replace(/\s+/g, " ").trim();
  const combined = `${title} ${description}`.trim();

  if (title.length < 5) {
    return {
      valid: false,
      reason: "Please write a clear civic issue title (at least 5 characters).",
    };
  }
  if (description.length < 10) {
    return {
      valid: false,
      reason:
        "Please describe the actual street, sanitation, streetlight, or infrastructure issue (at least 10 characters).",
    };
  }

  // Catch repeated single characters or keyboard mashing (e.g. "aaaaaaa", "asdfghjkl", "qwerty")
  if (/(.)\1{4,}/i.test(combined)) {
    return {
      valid: false,
      reason:
        "This text looks like repeated placeholder characters rather than a genuine civic report.",
    };
  }

  const keyboardMashRegex =
    /\b(asdf|sdfg|dfgh|fghj|ghjk|hjkl|qwer|wert|erty|rtyu|tyui|yuio|uiop|zxcv|xcvb|cvbn|vbnm|abcd|efgh|ijkl|mnop|12345|test\s*test|testing\s*123|blah\s*blah|lorem\s*ipsum)\b/i;
  if (keyboardMashRegex.test(combined)) {
    return {
      valid: false,
      reason:
        "CivicSnap AI detected placeholder or random keyboard text. Please describe a real local civic issue.",
    };
  }

  // Check alphabetic ratio and vowel presence (catches random consonant strings like "xkcdjflskdjf")
  const words = combined
    .toLowerCase()
    .split(/[^a-z\u0900-\u097f]+/)
    .filter((w) => w.length >= 2);
  if (words.length < 3) {
    return {
      valid: false,
      reason:
        "Please enter a meaningful description with at least a few real words explaining the public issue.",
    };
  }

  const latinWords = words.filter((w) => /^[a-z]+$/.test(w));
  if (latinWords.length >= 2) {
    const gibberishWords = latinWords.filter(
      (w) =>
        (w.length >= 5 && !/[aeiouy]/.test(w)) ||
        /[bcdfghjklmnpqrstvwxz]{5,}/.test(w)
    );
    if (gibberishWords.length >= Math.ceil(latinWords.length * 0.4)) {
      return {
        valid: false,
        reason:
          "The entered text appears to contain random or unreadable characters. Please write a clear civic issue report.",
      };
    }
  }

  // Catch obvious non-civic personal gadget / indoor items unless paired with real civic terms
  const nonCivicGadgetRegex =
    /\b(laptop|macbook|desktop|keyboard|mouse|monitor|iphone|smartphone|charger|headphones|earbuds|playstation|xbox|selfie|my\s+room|bedroom|homework|exam|assignment|netflix|instagram\s+reel)\b/i;
  const realCivicKeywordRegex =
    /\b(pothole|gaddha|road|sadak|street|asphalt|footpath|sidewalk|pavement|drain|drainage|sewer|manhole|waterlog|flood|garbage|waste|kachra|kooda|trash|dump|bin|dustbin|sanitation|streetlight|street\s*light|lamp|pole|batti|andhera|dark|wire|cable|traffic|signal|signage|park|public|municipal|ward|bbmp|bridge|flyover|bus\s*stop|crosswalk|pipe|leak|water\s*supply|tree\s*fell|fallen\s*tree|encroachment|debris|rubble|crack|broken)\b/i;

  if (nonCivicGadgetRegex.test(combined) && !realCivicKeywordRegex.test(combined)) {
    return {
      valid: false,
      reason:
        "CivicSnap only accepts public outdoor civic infrastructure issues (roads, garbage, streetlights, drainage, footpaths), not personal devices or indoor items.",
    };
  }

  return { valid: true };
}

/**
 * Builds the strict Human-Brain CivicSnap Vision Authenticity & Engineering Audit prompt.
 */
export function buildPhotoAuditPrompt(locality?: string): string {
  const locLine = locality?.trim()
    ? `Reported locality hint: ${locality.trim().slice(0, 80)}.`
    : "";
  return [
    "Act like a strict, experienced human municipal civil inspector reviewing a citizen-submitted photo.",
    "STEP 1 — AUTHENTICITY GATE (CRITICAL): Honestly identify what is actually in the photograph first.",
    "Set isGenuineCivicIssue = true ONLY if the image clearly shows a real outdoor public civic infrastructure or municipal sanitation problem (such as a road pothole, cracked/broken pavement, overflowing garbage/waste dump, broken/dark streetlight pole, open/clogged drain, waterlogged street, broken footpath, fallen tree/pole, leaking public water pipe, or damaged public road hazard).",
    "You MUST set isGenuineCivicIssue = false if the photo shows a laptop, computer screen, monitor, phone, keyboard, indoor desk/room/ceiling/wall, selfie/human face/portrait, pet/animal, food, document/textbook, screenshot/meme/cartoon, car interior, random household object, completely dark/blank/unintelligible blur, or a clean undamaged road with NO visible civic issue.",
    "ALWAYS fill detectedSubject with an honest, plain-English description of what you actually see in the photo (e.g., 'A laptop on an indoor desk' or 'A deep waterlogged asphalt pothole on a city street').",
    "If isGenuineCivicIssue is FALSE: set socialImpactScore = 0, materialEstimate = '', surroundingLandmarks = '', economicCostOfDelay = '', title = '', description = '', and write a polite, specific rejectionReason explaining what was seen and why it is not a valid civic issue report.",
    "STEP 2 — ENGINEERING AUDIT (ONLY IF isGenuineCivicIssue is TRUE):",
    "1. title (concise, 5-110 chars), category (Pothole, Garbage, Streetlight, or Other), and description (factual, 20-450 chars) grounded strictly in what is visible.",
    "2. surroundingLandmarks: Identify visible surrounding context (e.g., school, hospital, market, residential street, or commuter road) for priority scoring.",
    "3. materialEstimate: Realistic estimate of repair materials and crew labor needed ONLY for the visible defect (e.g., kgs of asphalt, replacement LED unit, compactor trip, labor hours). Never fabricate material estimates for non-civic photos.",
    "4. socialImpactScore: Calibrated integer 1 to 100 based on genuine safety severity and surrounding public sensitivity (minor curb crack ~30-50, moderate issue ~55-75, severe safety/hospital/school hazard ~78-95).",
    "5. economicCostOfDelay: Realistic 30-day economic/safety impact to citizens in ₹ if left unfixed.",
    locLine,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Builds the strict Human-Brain CivicSnap AI Report Text Authenticity prompt.
 */
export function buildReportValidationPrompt(input: {
  title: string;
  description: string;
  category: string;
  locality: string;
}): string {
  return [
    "Act like a sharp human municipal moderator verifying whether a citizen's submitted text describes a GENUINE public civic infrastructure issue.",
    `Category selected: ${input.category.slice(0, 40)}`,
    `Location: ${input.locality.slice(0, 100)}`,
    `Title: "${input.title.slice(0, 120)}"`,
    `Description: "${input.description.slice(0, 600)}"`,
    "Set isGenuine = true ONLY if the title and description meaningfully describe a real-world public civic problem (road damage, pothole, garbage, broken streetlight, drainage, waterlogging, public safety hazard, broken footpath, fallen tree, water leak, etc.) in English, Hindi, or Hinglish.",
    "Set isGenuine = false if the text is gibberish, keyboard mash, random letters/numbers, placeholder test text ('test', 'hello', 'abcde'), jokes, spam, personal tech/gadget problems (like laptop/phone issues), private household complaints, or unrelated chatter.",
    "Provide a clear 1-sentence reason. If isGenuine is true, also provide a realistic calibrated suggestedScore (15 to 95) matching actual severity (0 if false).",
  ].join("\n");
}

/**
 * Deterministic Demo Mode photo audit fallback used ONLY for built-in /demo/ sample images
 * when no server AI key is configured.
 */
export function generateDemoPhotoAudit(
  fileName?: string,
  locality?: string
): {
  isGenuineCivicIssue: boolean;
  detectedSubject: string;
  rejectionReason: string;
  confidence: number;
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
      isGenuineCivicIssue: true,
      detectedSubject: "Overflowing roadside civic waste pile next to sidewalk",
      rejectionReason: "",
      confidence: 92,
      title: `Overflowing roadside waste accumulation near ${area}`.slice(0, 120),
      category: "waste",
      categoryDisplay: "Garbage",
      description:
        `Accumulated street waste and overflowing refuse visible along the street shoulder near ${area}, obstructing pedestrian movement and creating a sanitation hazard.`,
      surroundingLandmarks:
        "High-traffic pedestrian sidewalk near local shops and residential frontage",
      materialEstimate:
        "1 waste compactor trip, ~20L disinfectant spray, 2 sanitation workers (2 labor hours)",
      socialImpactScore: 76,
      economicCostOfDelay:
        "Est. ₹12,000–₹24,000 over 30 days in localized health/sanitation impact and footfall loss to nearby shops",
    };
  }

  if (/\b(light|lamp|pole|dark|street)\b/.test(hint)) {
    return {
      isGenuineCivicIssue: true,
      detectedSubject: "Unlit public streetlight pole along evening street corridor",
      rejectionReason: "",
      confidence: 90,
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
    isGenuineCivicIssue: true,
    detectedSubject: "Damaged asphalt pothole cavity on active city road",
    rejectionReason: "",
    confidence: 94,
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
