import { NextRequest, NextResponse } from "next/server";
import { ThinkingLevel, Type } from "@google/genai";
import {
  clampSocialImpactScore,
  getPromptCategoryName,
  normalizeAiCategory,
} from "@/lib/ai-civic-helpers";
import {
  createGeminiServerClient,
  generateContentResilient,
  sanitizeGeminiErrorMessage,
} from "@/lib/gemini-server";

export const runtime = "nodejs";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_BASE64_LENGTH = 8 * 1024 * 1024; // ~6 MB decoded

function extractJsonObject(rawText: string): string {
  const stripped = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return stripped.slice(firstBrace, lastBrace + 1);
  }
  return stripped;
}

function normalizeSeverity(raw: string | undefined, score: number): "Critical" | "High" | "Medium" | "Low" {
  const lower = (raw ?? "").trim().toLowerCase();
  if (lower.includes("crit")) return "Critical";
  if (lower.includes("high")) return "High";
  if (lower.includes("med")) return "Medium";
  if (lower.includes("low")) return "Low";
  if (score >= 85) return "Critical";
  if (score >= 65) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

function parseBase64Input(
  rawBase64: unknown,
  rawMimeType: unknown
): { base64?: string; mimeType?: string; error?: string } {
  if (typeof rawBase64 !== "string" || !rawBase64.trim()) {
    return { error: "Missing imageBase64 in request body." };
  }

  let base64 = rawBase64.trim();
  let detectedMime =
    typeof rawMimeType === "string" && rawMimeType.trim()
      ? rawMimeType.trim().toLowerCase()
      : "image/jpeg";

  // Support optional data URL prefix gracefully
  const dataUrlMatch = base64.match(/^data:([a-zA-Z0-9/+.-]+);base64,([\s\S]+)$/);
  if (dataUrlMatch) {
    detectedMime = dataUrlMatch[1].toLowerCase();
    base64 = dataUrlMatch[2];
  }

  base64 = base64.replace(/\s+/g, "");

  if (base64.length < 20) {
    return { error: "Uploaded image payload is too small or corrupted." };
  }
  if (base64.length > MAX_BASE64_LENGTH) {
    return { error: "Uploaded image exceeds the 6 MB analysis limit." };
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(base64)) {
    return { error: "Invalid base64 image encoding." };
  }

  const normalizedMime =
    detectedMime === "image/jpg" ? "image/jpeg" : detectedMime;
  if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
    return { error: `Unsupported image MIME type: ${normalizedMime}` };
  }

  return { base64, mimeType: normalizedMime };
}

/**
 * Clean, public Next.js POST endpoint for live-captured civic photo analysis.
 * No Firebase Admin SDK or blocking auth middleware — resilient in all environments.
 */
export async function POST(request: NextRequest) {
  try {
    let body: {
      imageBase64?: unknown;
      mimeType?: unknown;
      locality?: unknown;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request body." },
        { status: 200 }
      );
    }

    const parsedImage = parseBase64Input(body?.imageBase64, body?.mimeType);
    if (parsedImage.error || !parsedImage.base64 || !parsedImage.mimeType) {
      return NextResponse.json(
        { success: false, error: parsedImage.error ?? "Invalid image input." },
        { status: 200 }
      );
    }

    const locality =
      typeof body?.locality === "string" && body.locality.trim()
        ? body.locality.trim().slice(0, 80)
        : "Bengaluru";

    const ai = createGeminiServerClient();
    if (!ai) {
      return NextResponse.json(
        {
          success: false,
          error:
            "GEMINI_API_KEY is not configured on the server. Please add GEMINI_API_KEY in Settings > Secrets and retry.",
        },
        { status: 200 }
      );
    }

    const promptText = [
      `Inspect this live-captured photo from ${locality}, Bengaluru as a strict civic infrastructure auditor.`,
      "Step 1 (Authenticity Gate): Decide if this photo genuinely depicts a real outdoor public civic infrastructure or sanitation hazard (pothole, cracked/broken road asphalt, overflowing garbage/waste pile, broken/unlit streetlight, open/clogged drain, waterlogging, broken footpath, fallen tree/pole, leaking public water pipe).",
      "STRICTLY REJECT (set is_civic_issue = false) any computer screen, laptop, code editor, browser window, screenshot, mobile phone screen, indoor room/desk/wall/ceiling, selfie, portrait/person, pet, food, document, meme, blank/blurry unreadable photo, or clean undamaged road.",
      "Step 2 (Engineering Audit): ONLY if is_civic_issue is true, provide a realistic category (Pothole, Garbage, Streetlight, or Other), severity (Critical, High, Medium, Low), asphalt_estimate_kg (integer kg, 0 if not road damage), estimated_cost_inr (integer INR), concise title, clear 2-sentence summary, surrounding_landmarks, material_estimate, social_impact_score (1-100), and economic_cost_of_delay.",
      "If is_civic_issue is false, set asphalt_estimate_kg = 0, estimated_cost_inr = 0, social_impact_score = 0, and write a clear, specific rejection_reason describing what you actually saw.",
    ].join("\n");

    const response = await generateContentResilient(
      ai,
      (model, useThinkingConfig) => ({
        model,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: parsedImage.mimeType!,
                data: parsedImage.base64!,
              },
            },
            { text: promptText },
          ],
        },
        config: {
          ...(useThinkingConfig
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
          systemInstruction:
            "You are CivicSnap AI, an independent Bengaluru public infrastructure vision auditor. Always return strict JSON matching the schema. Never invent repair metrics for non-civic images.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              is_civic_issue: {
                type: Type.BOOLEAN,
                description:
                  "True ONLY if the photo clearly shows a real outdoor public civic infrastructure or sanitation problem.",
              },
              detected_subject: {
                type: Type.STRING,
                description:
                  "Plain-English description of what is actually visible in the photo (max 150 chars).",
              },
              rejection_reason: {
                type: Type.STRING,
                description:
                  "If is_civic_issue is false, explain clearly in 1-2 sentences what was detected and why it was rejected. Empty string if genuine.",
              },
              category: {
                type: Type.STRING,
                description:
                  "Exactly one of: Pothole, Garbage, Streetlight, Other.",
              },
              severity: {
                type: Type.STRING,
                description: "One of: Critical, High, Medium, Low.",
              },
              asphalt_estimate_kg: {
                type: Type.NUMBER,
                description:
                  "Estimated asphalt/patching material in kg (integer >= 0). 0 if rejected or non-road issue.",
              },
              estimated_cost_inr: {
                type: Type.NUMBER,
                description:
                  "Estimated civic repair cost in INR (integer >= 0). 0 if rejected.",
              },
              title: {
                type: Type.STRING,
                description:
                  "Concise English report title (5-110 chars) if genuine; empty string if rejected.",
              },
              summary: {
                type: Type.STRING,
                description:
                  "Clear factual 1-2 sentence description of the civic issue (20-450 chars) if genuine; empty string if rejected.",
              },
              surrounding_landmarks: {
                type: Type.STRING,
                description:
                  "Visible road/corridor context if genuine; empty string if rejected.",
              },
              material_estimate: {
                type: Type.STRING,
                description:
                  "Realistic material and crew estimate if genuine; empty string if rejected.",
              },
              social_impact_score: {
                type: Type.NUMBER,
                description:
                  "Calibrated 1-100 urgency score if genuine; 0 if rejected.",
              },
              economic_cost_of_delay: {
                type: Type.STRING,
                description:
                  "Estimated 30-day safety/economic impact in INR if genuine; empty string if rejected.",
              },
            },
            required: [
              "is_civic_issue",
              "detected_subject",
              "rejection_reason",
              "category",
              "severity",
              "asphalt_estimate_kg",
              "estimated_cost_inr",
              "title",
              "summary",
              "surrounding_landmarks",
              "material_estimate",
              "social_impact_score",
              "economic_cost_of_delay",
            ],
          },
        },
      })
    );

    const rawText = extractJsonObject(response.text ?? "");
    let parsed: {
      is_civic_issue?: boolean;
      detected_subject?: string;
      rejection_reason?: string;
      category?: string;
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

    try {
      parsed = JSON.parse(rawText) as typeof parsed;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Gemini AI returned a non-JSON audit response. Please retake the photo and try again.",
        },
        { status: 200 }
      );
    }

    const detectedSubject = (parsed.detected_subject ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180);

    if (parsed.is_civic_issue !== true) {
      const rejectionReason =
        (parsed.rejection_reason ?? "").replace(/\s+/g, " ").trim().slice(0, 300) ||
        (detectedSubject
          ? `Detected "${detectedSubject}" instead of outdoor public civic infrastructure. Please capture a real street pothole, waste pile, streetlight, or civic hazard.`
          : "Detected a computer screen/indoor photo rather than outdoor public civic infrastructure. Please capture a real street pothole or civic issue.");

      return NextResponse.json(
        {
          success: true,
          audit: {
            is_civic_issue: false,
            detected_subject: detectedSubject || "Non-civic / indoor image",
            rejection_reason: rejectionReason,
          },
        },
        { status: 200 }
      );
    }

    const normalizedCat = normalizeAiCategory(parsed.category);
    const categoryDisplay = getPromptCategoryName(normalizedCat);
    const socialImpactScore = clampSocialImpactScore(parsed.social_impact_score);
    const severity = normalizeSeverity(parsed.severity, socialImpactScore);

    const rawAsphalt = Math.round(Number(parsed.asphalt_estimate_kg) || 0);
    const asphaltEstimateKg =
      rawAsphalt > 0
        ? Math.min(5000, rawAsphalt)
        : normalizedCat === "pothole"
          ? 120
          : 0;

    const rawCost = Math.round(Number(parsed.estimated_cost_inr) || 0);
    const estimatedCostInr =
      rawCost > 0
        ? Math.min(500000, rawCost)
        : normalizedCat === "pothole"
          ? 3800
          : 2500;

    const title =
      (parsed.title ?? "").replace(/\s+/g, " ").trim().slice(0, 120) ||
      `${categoryDisplay} Issue Reported in ${locality}`;
    const summary =
      (parsed.summary ?? "").replace(/\s+/g, " ").trim().slice(0, 600) ||
      `Visible outdoor ${categoryDisplay.toLowerCase()} infrastructure issue captured in ${locality} requiring field inspection and repair.`;

    const surroundingLandmarks =
      (parsed.surrounding_landmarks ?? "").replace(/\s+/g, " ").trim().slice(0, 200) ||
      `${locality} neighborhood street corridor`;

    const materialEstimate =
      (parsed.material_estimate ?? "").replace(/\s+/g, " ").trim().slice(0, 240) ||
      (asphaltEstimateKg > 0
        ? `~${asphaltEstimateKg} kg Hot-Mix Asphalt · Est. ₹${estimatedCostInr.toLocaleString("en-IN")} repair`
        : `Field maintenance crew · Est. ₹${estimatedCostInr.toLocaleString("en-IN")} repair`);

    const economicCostOfDelay =
      (parsed.economic_cost_of_delay ?? "").replace(/\s+/g, " ").trim().slice(0, 240) ||
      `₹${(estimatedCostInr * 4).toLocaleString("en-IN")}+ est. 30-day commuter & vehicle wear impact`;

    return NextResponse.json(
      {
        success: true,
        audit: {
          is_civic_issue: true,
          category: categoryDisplay,
          normalized_category: normalizedCat,
          severity,
          asphalt_estimate_kg: asphaltEstimateKg,
          estimated_cost_inr: estimatedCostInr,
          title,
          summary,
          detected_subject: detectedSubject || title,
          surrounding_landmarks: surroundingLandmarks,
          material_estimate: materialEstimate,
          social_impact_score: socialImpactScore,
          economic_cost_of_delay: economicCostOfDelay,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    const safeError = sanitizeGeminiErrorMessage(err);
    console.error("[CivicSnap /api/analyze-issue] Error:", safeError);
    return NextResponse.json(
      {
        success: false,
        error: safeError,
      },
      { status: 200 }
    );
  }
}
