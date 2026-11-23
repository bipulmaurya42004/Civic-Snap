import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { ThinkingLevel, Type } from "@google/genai";
import { z } from "zod";
import {
  buildBeforeAfterVerificationPrompt,
  buildHinglishVoicePrompt,
  buildPhotoAuditPrompt,
  clampSocialImpactScore,
  convertHinglishToDemoReport,
  generateDemoPhotoAudit,
  getPromptCategoryName,
  normalizeAiCategory,
  parseVerificationVerdict,
  validateSafeImageSourceUrl,
} from "@/lib/ai-civic-helpers";
import {
  createGeminiServerClient,
  getGeminiServerModel,
} from "@/lib/gemini-server";

export const runtime = "nodejs";

const MAX_INLINE_IMAGE_BASE64_LENGTH = 8 * 1024 * 1024; // ~6 MB decoded
const MAX_FETCHED_IMAGE_BYTES = 6 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const inlineImageSchema = z.object({
  mimeType: z
    .string()
    .trim()
    .refine((m) => ALLOWED_IMAGE_MIME_TYPES.has(m.toLowerCase()), {
      message: "Unsupported image MIME type.",
    }),
  base64: z
    .string()
    .trim()
    .min(20)
    .max(MAX_INLINE_IMAGE_BASE64_LENGTH)
    .regex(/^[A-Za-z0-9+/=\s]+$/, "Invalid base64 image payload."),
});

const voiceToReportSchema = z.object({
  action: z.literal("voice_to_report"),
  transcript: z.string().trim().min(3, "Please speak or enter at least 3 characters.").max(1500),
});

const verifyFixSchema = z.object({
  action: z.literal("verify_fix"),
  reportTitle: z.string().trim().max(120).optional(),
  category: z.string().trim().max(40).optional(),
  locality: z.string().trim().max(80).optional(),
  beforeImage: inlineImageSchema.optional(),
  beforeImageUrl: z.string().trim().max(2048).optional(),
  afterImage: inlineImageSchema.optional(),
  afterImageUrl: z.string().trim().max(2048).optional(),
  /** Only honored in Demo Mode when GEMINI_API_KEY is not configured */
  demoOutcomeHint: z.enum(["verified", "flagged"]).optional(),
});

const analyzePhotoSchema = z.object({
  action: z.literal("analyze_photo"),
  image: inlineImageSchema.optional(),
  imageUrl: z.string().trim().max(2048).optional(),
  fileName: z.string().trim().max(120).optional(),
  locality: z.string().trim().max(80).optional(),
});

const requestSchema = z.discriminatedUnion("action", [
  voiceToReportSchema,
  analyzePhotoSchema,
  verifyFixSchema,
]);

interface ResolvedImagePart {
  mimeType: string;
  base64: string;
}

function extensionToMime(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

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

async function withGeminiRetry<T>(operation: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
      const isRetryable =
        msg.includes("503") ||
        msg.includes("500") ||
        msg.includes("unavailable") ||
        msg.includes("overloaded") ||
        msg.includes("econnreset") ||
        msg.includes("fetch failed") ||
        msg.includes("timeout");
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function resolveImageInput(
  inlineImg: z.infer<typeof inlineImageSchema> | undefined,
  sourceUrl: string | undefined
): Promise<{ part?: ResolvedImagePart; error?: string }> {
  if (inlineImg) {
    return {
      part: {
        mimeType:
          inlineImg.mimeType.toLowerCase() === "image/jpg"
            ? "image/jpeg"
            : inlineImg.mimeType.toLowerCase(),
        base64: inlineImg.base64.replace(/\s+/g, ""),
      },
    };
  }

  if (!sourceUrl) {
    return { error: "Missing required image payload." };
  }

  const checked = validateSafeImageSourceUrl(sourceUrl);
  if (!checked.valid || !checked.normalized) {
    return { error: checked.error ?? "Invalid image URL." };
  }

  if (checked.kind === "demo") {
    const publicDemoDir = path.resolve(process.cwd(), "public", "demo");
    const fileName = path.basename(checked.normalized);
    const resolvedPath = path.resolve(publicDemoDir, fileName);
    if (!resolvedPath.startsWith(publicDemoDir + path.sep)) {
      return { error: "Demo image path outside allowed directory." };
    }
    try {
      const buf = await readFile(resolvedPath);
      return {
        part: {
          mimeType: extensionToMime(resolvedPath),
          base64: buf.toString("base64"),
        },
      };
    } catch {
      return { error: "Demo reference image could not be loaded." };
    }
  }

  // Strictly allowlisted HTTPS Firebase Storage fetch with timeout & byte limit
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(checked.normalized, {
      method: "GET",
      signal: controller.signal,
      redirect: "error",
    });
    if (!res.ok) {
      return { error: `Could not fetch stored image (HTTP ${res.status}).` };
    }
    const contentType = (res.headers.get("content-type") ?? "image/jpeg")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!ALLOWED_IMAGE_MIME_TYPES.has(contentType)) {
      return { error: "Remote URL did not return a valid image type." };
    }
    const arrBuf = await res.arrayBuffer();
    if (arrBuf.byteLength === 0 || arrBuf.byteLength > MAX_FETCHED_IMAGE_BYTES) {
      return { error: "Stored image is empty or exceeds the 6 MB limit." };
    }
    return {
      part: {
        mimeType: contentType === "image/jpg" ? "image/jpeg" : contentType,
        base64: Buffer.from(arrBuf).toString("base64"),
      },
    };
  } catch {
    return { error: "Timed out or failed while fetching stored image." };
  } finally {
    clearTimeout(timer);
  }
}

function mapGeminiError(error: unknown): { status: number; message: string } {
  const raw = error instanceof Error ? error.message : String(error);
  console.error("[CivicSnap /api/gemini] Upstream error:", raw.slice(0, 300));
  const lower = raw.toLowerCase();
  if (lower.includes("api_key_invalid") || lower.includes("permission_denied")) {
    return {
      status: 502,
      message:
        "Gemini API key was rejected. Please check your GEMINI_API_KEY in Settings > Secrets.",
    };
  }
  if (lower.includes("resource_exhausted") || lower.includes("429")) {
    return {
      status: 429,
      message:
        "Gemini API quota limit reached right now. Please wait a moment and try again.",
    };
  }
  return {
    status: 502,
    message: "Gemini AI analysis could not complete right now. Please try again.",
  };
}

export async function POST(request: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const parsed = requestSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? "Invalid request parameters.";
    return NextResponse.json({ error: firstIssue }, { status: 400 });
  }

  const payload = parsed.data;
  const ai = createGeminiServerClient();
  const model = getGeminiServerModel();

  // -------------------------------------------------------------------------
  // MODULE 1: Hinglish Voice-to-Report
  // -------------------------------------------------------------------------
  if (payload.action === "voice_to_report") {
    if (!ai) {
      const demo = convertHinglishToDemoReport(payload.transcript);
      return NextResponse.json({
        title: demo.title,
        category: demo.category,
        categoryDisplay: demo.categoryDisplay,
        description: demo.description,
        demoMode: true,
        notice:
          "Demo Mode active (GEMINI_API_KEY is not configured on the server). Converted with CivicSnap's local Hinglish parser — add GEMINI_API_KEY in Settings > Secrets for live Gemini AI.",
      });
    }

    try {
      const prompt = buildHinglishVoicePrompt(payload.transcript);
      const response = await withGeminiRetry(() =>
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            systemInstruction:
              "You convert spoken Hindi/Hinglish civic complaints into concise, professional English civic issue reports. Always choose the best matching Category among Pothole, Garbage, Streetlight, or Other.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description:
                    "Concise professional English report title (5 to 110 characters).",
                },
                category: {
                  type: Type.STRING,
                  description:
                    "Exactly one of: Pothole, Garbage, Streetlight, Other.",
                },
                description: {
                  type: Type.STRING,
                  description:
                    "Clear, factual English description of the civic issue (20 to 500 characters).",
                },
              },
              required: ["title", "category", "description"],
            },
          },
        })
      );

      const rawText = extractJsonObject(response.text ?? "");
      const parsedJson = JSON.parse(rawText) as {
        title?: string;
        category?: string;
        description?: string;
      };

      const normalizedCategory = normalizeAiCategory(parsedJson.category);
      const title = (parsedJson.title ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
      const description = (parsedJson.description ?? "").trim().slice(0, 600);

      if (title.length < 5 || description.length < 10) {
        return NextResponse.json(
          { error: "Gemini returned an incomplete report draft. Please try speaking again." },
          { status: 502 }
        );
      }

      return NextResponse.json({
        title,
        category: normalizedCategory,
        categoryDisplay: getPromptCategoryName(normalizedCategory),
        description,
        demoMode: false,
      });
    } catch (error) {
      const mapped = mapGeminiError(error);
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
  }

  // -------------------------------------------------------------------------
  // MODULE 1B: Photo Analysis + Civil Engineering Auditing (/report)
  // -------------------------------------------------------------------------
  if (payload.action === "analyze_photo") {
    const resolvedPhoto = await resolveImageInput(
      payload.image,
      payload.imageUrl
    );
    if (resolvedPhoto.error || !resolvedPhoto.part) {
      return NextResponse.json(
        { error: `Photo error: ${resolvedPhoto.error ?? "Required."}` },
        { status: 400 }
      );
    }

    if (!ai) {
      const demo = generateDemoPhotoAudit(payload.fileName, payload.locality);
      return NextResponse.json({
        ...demo,
        demoMode: true,
        notice:
          "Demo Mode active (GEMINI_API_KEY is not configured on the server). Showing sample engineering audit — add GEMINI_API_KEY in Settings > Secrets for live Gemini Vision analysis.",
      });
    }

    try {
      const promptText = buildPhotoAuditPrompt(payload.locality);
      const response = await withGeminiRetry(() =>
        ai.models.generateContent({
          model,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: resolvedPhoto.part!.mimeType,
                  data: resolvedPhoto.part!.base64,
                },
              },
              { text: promptText },
            ],
          },
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            systemInstruction:
              "You are a municipal civil engineering auditor. Analyze civic issue photos accurately and return concise, realistic structured JSON with title, category, description, surroundingLandmarks, materialEstimate, socialImpactScore (1-100), and economicCostOfDelay (30-day estimate in ₹).",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description:
                    "Concise professional English issue title (5 to 110 characters).",
                },
                category: {
                  type: Type.STRING,
                  description:
                    "Exactly one of: Pothole, Garbage, Streetlight, Other.",
                },
                description: {
                  type: Type.STRING,
                  description:
                    "Clear, factual English description of the issue visible in the photo (20 to 450 characters).",
                },
                surroundingLandmarks: {
                  type: Type.STRING,
                  description:
                    "Nearby landmarks or zone type visible/inferred (e.g., school, hospital, high-traffic market, residential road) for priority scoring (max 190 chars).",
                },
                materialEstimate: {
                  type: Type.STRING,
                  description:
                    "Rough estimate of repair materials and crew labor hours (e.g., kgs of asphalt, liters of paint, replacement lamp, hours of labor; max 230 chars).",
                },
                socialImpactScore: {
                  type: Type.NUMBER,
                  description:
                    "Priority score from 1 to 100 based on location sensitivity and safety severity.",
                },
                economicCostOfDelay: {
                  type: Type.STRING,
                  description:
                    "Estimated hidden 30-day economic cost to citizens (vehicle damage, delays, accidents) if left unfixed (max 230 chars).",
                },
              },
              required: [
                "title",
                "category",
                "description",
                "surroundingLandmarks",
                "materialEstimate",
                "socialImpactScore",
                "economicCostOfDelay",
              ],
            },
            maxOutputTokens: 1024,
          },
        })
      );

      const rawText = extractJsonObject(response.text ?? "");
      let parsedJson: {
        title?: string;
        category?: string;
        description?: string;
        surroundingLandmarks?: string;
        materialEstimate?: string;
        socialImpactScore?: number | string;
        economicCostOfDelay?: string;
      } = {};
      try {
        parsedJson = JSON.parse(rawText) as typeof parsedJson;
      } catch (parseErr) {
        console.error(
          "[CivicSnap /api/gemini] analyze_photo JSON parse error:",
          parseErr instanceof Error ? parseErr.message : String(parseErr),
          "raw length:",
          rawText.length
        );
        return NextResponse.json(
          { error: "Gemini returned an unreadable photo audit format. Please try again." },
          { status: 502 }
        );
      }

      const normalizedCategory = normalizeAiCategory(parsedJson.category);
      const title = (parsedJson.title ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
      const description = (parsedJson.description ?? "").trim().slice(0, 600);
      const surroundingLandmarks = (parsedJson.surroundingLandmarks ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200);
      const materialEstimate = (parsedJson.materialEstimate ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 240);
      const socialImpactScore = clampSocialImpactScore(parsedJson.socialImpactScore);
      const economicCostOfDelay = (parsedJson.economicCostOfDelay ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 240);

      if (title.length < 5 || description.length < 10) {
        return NextResponse.json(
          { error: "Gemini returned an incomplete photo analysis. Please try again." },
          { status: 502 }
        );
      }

      return NextResponse.json({
        title,
        category: normalizedCategory,
        categoryDisplay: getPromptCategoryName(normalizedCategory),
        description,
        surroundingLandmarks:
          surroundingLandmarks.length >= 2
            ? surroundingLandmarks
            : "Local neighborhood street corridor",
        materialEstimate:
          materialEstimate.length >= 2
            ? materialEstimate
            : "Field crew inspection and standard patching materials (2–3 labor hours)",
        socialImpactScore,
        economicCostOfDelay:
          economicCostOfDelay.length >= 2
            ? economicCostOfDelay
            : "Ongoing commuter disruption and minor vehicle wear if unaddressed for 30 days",
        demoMode: false,
      });
    } catch (error) {
      const mapped = mapGeminiError(error);
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
  }

  // -------------------------------------------------------------------------
  // MODULE 2: AI Before-vs-After Fix Verification (Gemini Vision)
  // -------------------------------------------------------------------------
  const resolvedAfter = await resolveImageInput(
    payload.afterImage,
    payload.afterImageUrl
  );
  if (resolvedAfter.error || !resolvedAfter.part) {
    return NextResponse.json(
      { error: `After photo error: ${resolvedAfter.error ?? "Required."}` },
      { status: 400 }
    );
  }

  const hasBeforeInput = Boolean(payload.beforeImage || payload.beforeImageUrl);
  let resolvedBeforePart: ResolvedImagePart | undefined;
  if (hasBeforeInput) {
    const resolvedBefore = await resolveImageInput(
      payload.beforeImage,
      payload.beforeImageUrl
    );
    if (resolvedBefore.error) {
      return NextResponse.json(
        { error: `Original photo error: ${resolvedBefore.error}` },
        { status: 400 }
      );
    }
    resolvedBeforePart = resolvedBefore.part;
  }

  if (!ai) {
    // Explicit Demo Mode fallback when GEMINI_API_KEY is not configured
    const sameImage =
      Boolean(resolvedBeforePart) &&
      resolvedBeforePart!.base64 === resolvedAfter.part.base64;
    const isFlagged = payload.demoOutcomeHint === "flagged" || sameImage;
    const demoVerdict = isFlagged ? "Flagged" : "Verified";
    const demoReason = sameImage
      ? "The uploaded after photo appears identical to the original issue photo, so the repair could not be verified."
      : isFlagged
        ? "Demo Mode flagged this upload because visible issue remnants still appear to require follow-up work."
        : "Demo Mode verified that the uploaded proof-of-fix image shows a repaired surface compared to the original report.";

    return NextResponse.json({
      verdict: demoVerdict,
      verificationStatus: isFlagged ? "flagged" : "verified",
      reason: demoReason,
      demoMode: true,
      notice:
        "Demo Mode active (GEMINI_API_KEY is not configured on the server). Add GEMINI_API_KEY in Settings > Secrets for live Gemini Vision comparison.",
    });
  }

  try {
    const promptText = buildBeforeAfterVerificationPrompt({
      title: payload.reportTitle,
      category: payload.category,
      locality: payload.locality,
    });

    const parts: Array<
      { inlineData: { mimeType: string; data: string } } | { text: string }
    > = [];

    if (resolvedBeforePart) {
      parts.push({
        inlineData: {
          mimeType: resolvedBeforePart.mimeType,
          data: resolvedBeforePart.base64,
        },
      });
    }
    parts.push({
      inlineData: {
        mimeType: resolvedAfter.part.mimeType,
        data: resolvedAfter.part.base64,
      },
    });
    parts.push({ text: promptText });

    const response = await withGeminiRetry(() =>
      ai.models.generateContent({
        model,
        contents: { parts },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'You are an impartial civic repair verification inspector. Compare the original issue image and the repair proof image carefully. Reply strictly as JSON with verdict ("Verified" or "Flagged") and a single clear 1-sentence reason.',
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              verdict: {
                type: Type.STRING,
                description: 'Must be exactly "Verified" or "Flagged".',
              },
              reason: {
                type: Type.STRING,
                description:
                  "A clear 1-sentence explanation of why the fix is Verified or Flagged.",
              },
            },
            required: ["verdict", "reason"],
          },
        },
      })
    );

    const rawText = extractJsonObject(response.text ?? "");
    let parsedResult: { verdict?: string; reason?: string } = {};
    try {
      parsedResult = JSON.parse(rawText) as { verdict?: string; reason?: string };
    } catch {
      parsedResult = { verdict: rawText };
    }

    const normalized = parseVerificationVerdict(
      parsedResult.verdict,
      parsedResult.reason
    );

    return NextResponse.json({
      verdict: normalized.verdict,
      verificationStatus: normalized.verificationStatus,
      reason: normalized.reason,
      demoMode: false,
    });
  } catch (error) {
    const mapped = mapGeminiError(error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
