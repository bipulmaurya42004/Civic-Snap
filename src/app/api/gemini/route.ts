import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { ThinkingLevel, Type } from "@google/genai";
import { z } from "zod";
import {
  buildBeforeAfterVerificationPrompt,
  buildHinglishVoicePrompt,
  buildPhotoAuditPrompt,
  buildReportValidationPrompt,
  clampSocialImpactScore,
  convertHinglishToDemoReport,
  generateDemoPhotoAudit,
  getPromptCategoryName,
  normalizeAiCategory,
  parseVerificationVerdict,
  validateCivicReportText,
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

const validateReportSchema = z.object({
  action: z.literal("validate_report"),
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().min(1).max(1000),
  category: z.string().trim().max(40).optional(),
  locality: z.string().trim().max(120).optional(),
});

const requestSchema = z.discriminatedUnion("action", [
  voiceToReportSchema,
  analyzePhotoSchema,
  validateReportSchema,
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
  console.error("[CivicSnap AI] Upstream error:", raw.slice(0, 300));
  const lower = raw.toLowerCase();
  if (lower.includes("api_key_invalid") || lower.includes("permission_denied")) {
    return {
      status: 502,
      message:
        "CivicSnap AI verification service is temporarily unavailable due to server credentials. Please retry shortly.",
    };
  }
  if (lower.includes("resource_exhausted") || lower.includes("429")) {
    return {
      status: 429,
      message:
        "CivicSnap AI is handling high traffic right now. Please wait a few seconds and try again.",
    };
  }
  return {
    status: 502,
    message: "CivicSnap AI analysis could not complete right now. Please try again.",
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
          "Converted using CivicSnap AI local language parser.",
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
          { error: "CivicSnap AI returned an incomplete report draft. Please try speaking again." },
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
  // MODULE 1B: Strict Authenticity Photo Inspection + Engineering Audit (/report)
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
      // Only allow deterministic audit for built-in /demo/ sample assets — NEVER fake a passing audit on arbitrary user uploads
      if (payload.imageUrl?.startsWith("/demo/")) {
        const demo = generateDemoPhotoAudit(payload.fileName, payload.locality);
        return NextResponse.json({
          ...demo,
          demoMode: true,
          notice: "Verified sample civic photo with CivicSnap AI.",
        });
      }
      return NextResponse.json(
        {
          error:
            "CivicSnap AI Vision service is not active on this server yet, so this photo could not be authenticated.",
        },
        { status: 503 }
      );
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
              "You are CivicSnap AI, a strict, human-level municipal civil inspector. FIRST determine if the uploaded image genuinely depicts an outdoor public civic infrastructure or sanitation issue (pothole, damaged road, overflowing garbage, broken streetlight, open drain, waterlogging, broken footpath, fallen tree/pole, leaking public pipe). REJECT laptops, phones, screens, indoor desks/rooms, selfies, people, pets, food, documents, screenshots, memes, random objects, blank images, or clean undamaged roads by setting isGenuineCivicIssue = false, socialImpactScore = 0, materialEstimate = '', and writing an honest detectedSubject + rejectionReason.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                isGenuineCivicIssue: {
                  type: Type.BOOLEAN,
                  description:
                    "True ONLY if the photo genuinely shows a real outdoor public civic infrastructure or municipal sanitation problem. Must be false for laptops, indoor items, selfies, screens, screenshots, pets, documents, random objects, or clean undamaged roads.",
                },
                detectedSubject: {
                  type: Type.STRING,
                  description:
                    "Honest plain-English description of what is actually visible in the photo (max 160 chars).",
                },
                rejectionReason: {
                  type: Type.STRING,
                  description:
                    "If isGenuineCivicIssue is false, a clear 1-sentence human explanation of why this photo cannot be accepted as a civic issue. Empty string if genuine.",
                },
                confidence: {
                  type: Type.NUMBER,
                  description: "Confidence percentage from 0 to 100.",
                },
                title: {
                  type: Type.STRING,
                  description:
                    "Concise English issue title (5-110 chars) if genuine; empty string if rejected.",
                },
                category: {
                  type: Type.STRING,
                  description:
                    "Exactly one of: Pothole, Garbage, Streetlight, Other.",
                },
                description: {
                  type: Type.STRING,
                  description:
                    "Factual English description of the visible civic issue (20-450 chars) if genuine; empty string if rejected.",
                },
                surroundingLandmarks: {
                  type: Type.STRING,
                  description:
                    "Visible surrounding landmarks or road context if genuine; empty string if rejected.",
                },
                materialEstimate: {
                  type: Type.STRING,
                  description:
                    "Realistic estimate of repair materials and crew hours ONLY if genuine; empty string if rejected.",
                },
                socialImpactScore: {
                  type: Type.NUMBER,
                  description:
                    "Calibrated 1-100 urgency score if genuine; MUST be 0 if isGenuineCivicIssue is false.",
                },
                economicCostOfDelay: {
                  type: Type.STRING,
                  description:
                    "Estimated 30-day economic/safety impact in ₹ ONLY if genuine; empty string if rejected.",
                },
              },
              required: [
                "isGenuineCivicIssue",
                "detectedSubject",
                "rejectionReason",
                "confidence",
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
        isGenuineCivicIssue?: boolean;
        detectedSubject?: string;
        rejectionReason?: string;
        confidence?: number;
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
          "[CivicSnap AI] analyze_photo JSON parse error:",
          parseErr instanceof Error ? parseErr.message : String(parseErr)
        );
        return NextResponse.json(
          { error: "CivicSnap AI could not read the photo analysis output. Please try again." },
          { status: 502 }
        );
      }

      const detectedSubject = (parsedJson.detectedSubject ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 180);
      const isGenuine = parsedJson.isGenuineCivicIssue === true;
      const confidence = Math.min(
        100,
        Math.max(0, Math.round(Number(parsedJson.confidence ?? (isGenuine ? 85 : 95)) || 0))
      );

      // Strict human-brain rejection branch: zero fake scores, zero fake material estimates!
      if (!isGenuine) {
        const rejectionReason =
          (parsedJson.rejectionReason ?? "").replace(/\s+/g, " ").trim().slice(0, 280) ||
          (detectedSubject
            ? `This image appears to show "${detectedSubject}" instead of an outdoor public civic issue. Please upload a real photo of a pothole, garbage dump, broken streetlight, or street hazard.`
            : "This image does not show a recognizable public civic infrastructure issue. Please upload a clear outdoor photo of the actual problem.");

        return NextResponse.json({
          isGenuineCivicIssue: false,
          detectedSubject: detectedSubject || "Non-civic / irrelevant image",
          rejectionReason,
          confidence,
          title: "",
          category: "other",
          categoryDisplay: "Other",
          description: "",
          surroundingLandmarks: "",
          materialEstimate: "",
          socialImpactScore: 0,
          economicCostOfDelay: "",
          demoMode: false,
        });
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
          { error: "CivicSnap AI returned an incomplete photo analysis. Please try again." },
          { status: 502 }
        );
      }

      return NextResponse.json({
        isGenuineCivicIssue: true,
        detectedSubject: detectedSubject || title,
        rejectionReason: "",
        confidence,
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
  // MODULE 1C: Report Text Authenticity Check (Blocks Gibberish / Fake Text)
  // -------------------------------------------------------------------------
  if (payload.action === "validate_report") {
    const localCheck = validateCivicReportText({
      title: payload.title,
      description: payload.description,
      locality: payload.locality,
    });
    if (!localCheck.valid) {
      return NextResponse.json({
        isGenuine: false,
        reason:
          localCheck.reason ||
          "Please describe a genuine public civic issue in clear language.",
        suggestedScore: 0,
        demoMode: false,
      });
    }

    if (!ai) {
      return NextResponse.json({
        isGenuine: true,
        reason: "Report text passed basic civic quality validation.",
        suggestedScore: 55,
        demoMode: true,
      });
    }

    try {
      const promptText = buildReportValidationPrompt({
        title: payload.title,
        description: payload.description,
        category: payload.category ?? "other",
        locality: payload.locality ?? "Unknown",
      });

      const response = await withGeminiRetry(() =>
        ai.models.generateContent({
          model,
          contents: promptText,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            systemInstruction:
              "You are CivicSnap AI's strict municipal intake moderator. Reject fake, random, gibberish, test, spam, joke, or non-civic personal gadget complaints. Approve ONLY genuine public civic infrastructure/sanitation reports in English, Hindi, or Hinglish.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                isGenuine: {
                  type: Type.BOOLEAN,
                  description:
                    "True ONLY if the text describes a real outdoor public civic issue; false for gibberish, test text, spam, jokes, or non-civic items like laptops/phones.",
                },
                reason: {
                  type: Type.STRING,
                  description:
                    "Clear 1-sentence human explanation of why the report was approved or rejected.",
                },
                suggestedScore: {
                  type: Type.NUMBER,
                  description:
                    "Calibrated 15-95 severity score if genuine; 0 if rejected.",
                },
                suggestedCategory: {
                  type: Type.STRING,
                  description:
                    "Best matching category among Pothole, Garbage, Streetlight, Other.",
                },
              },
              required: ["isGenuine", "reason", "suggestedScore", "suggestedCategory"],
            },
            maxOutputTokens: 512,
          },
        })
      );

      const rawText = extractJsonObject(response.text ?? "");
      const parsedVal = JSON.parse(rawText) as {
        isGenuine?: boolean;
        reason?: string;
        suggestedScore?: number;
        suggestedCategory?: string;
      };

      const isGenuine = parsedVal.isGenuine === true;
      const reason =
        (parsedVal.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 260) ||
        (isGenuine
          ? "Report verified as a genuine local civic issue."
          : "This text does not appear to describe a genuine public civic issue. Please enter accurate details.");

      return NextResponse.json({
        isGenuine,
        reason,
        suggestedScore: isGenuine
          ? clampSocialImpactScore(parsedVal.suggestedScore)
          : 0,
        suggestedCategory: normalizeAiCategory(parsedVal.suggestedCategory),
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
    const demoConfidence = sameImage ? 15 : isFlagged ? 42 : 94;
    const demoReason = sameImage
      ? "The uploaded after photo appears identical to the original issue photo, so the repair could not be verified."
      : isFlagged
        ? "Preview audit flagged this upload because visible issue remnants still appear to require follow-up work."
        : "Preview audit assessed that the uploaded proof-of-fix image shows a repaired surface compared to the original report.";

    return NextResponse.json({
      verdict: demoVerdict,
      verificationStatus: isFlagged ? "flagged" : "verified",
      aiConfidenceScore: demoConfidence,
      reason: demoReason,
      demoMode: true,
      notice:
        "Evaluated in CivicSnap AI preview verification mode.",
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
            'You are an impartial civic repair verification inspector. Compare the original issue image and the repair proof image carefully. Reply strictly as JSON with verdict ("Verified" or "Flagged"), aiConfidenceScore (integer 0-100), and a single clear 1-sentence reason.',
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              verdict: {
                type: Type.STRING,
                description: 'Must be exactly "Verified" or "Flagged".',
              },
              aiConfidenceScore: {
                type: Type.NUMBER,
                description:
                  "Calibrated AI Confidence Score from 0 to 100 (90+ only when clear, genuine repair is visible at the same site).",
              },
              reason: {
                type: Type.STRING,
                description:
                  "A clear 1-sentence explanation of why the fix is Verified or Flagged.",
              },
            },
            required: ["verdict", "aiConfidenceScore", "reason"],
          },
        },
      })
    );

    const rawText = extractJsonObject(response.text ?? "");
    let parsedResult: {
      verdict?: string;
      aiConfidenceScore?: number;
      reason?: string;
    } = {};
    try {
      parsedResult = JSON.parse(rawText) as {
        verdict?: string;
        aiConfidenceScore?: number;
        reason?: string;
      };
    } catch {
      parsedResult = { verdict: rawText };
    }

    const normalized = parseVerificationVerdict(
      parsedResult.verdict,
      parsedResult.reason
    );
    const fallbackConfidence =
      normalized.verificationStatus === "verified" ? 93 : 44;
    const rawConfidence = Number(parsedResult.aiConfidenceScore);
    const aiConfidenceScore = Number.isFinite(rawConfidence)
      ? Math.min(100, Math.max(0, Math.round(rawConfidence)))
      : fallbackConfidence;

    return NextResponse.json({
      verdict: normalized.verdict,
      verificationStatus: normalized.verificationStatus,
      aiConfidenceScore,
      reason: normalized.reason,
      demoMode: false,
    });
  } catch (error) {
    const mapped = mapGeminiError(error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
