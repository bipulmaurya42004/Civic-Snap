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
  AUDIT_DISCLAIMER_TEXT,
  CIVICSNAP_AI_SYSTEM_PROMPT,
  mapProtocolCategoryToIssueCategory,
  normalizeBeforeAfterVerification,
  normalizeCivicAuditResponse,
} from "@/lib/civicsnap-ai-protocol";
import {
  createGeminiServerClient,
  generateContentResilient,
  sanitizeGeminiErrorMessage,
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
  const safe = sanitizeGeminiErrorMessage(error);
  console.error("[CivicSnap AI] Upstream error:", safe);
  const lower = safe.toLowerCase();
  if (lower.includes("api_key_invalid") || lower.includes("permission_denied")) {
    return {
      status: 502,
      message: `Gemini API authentication failed (${safe}). Please check GEMINI_API_KEY in Settings > Secrets.`,
    };
  }
  if (lower.includes("resource_exhausted") || lower.includes("429")) {
    return {
      status: 429,
      message: `Gemini API rate limit reached (${safe}). Please wait a few seconds and try again.`,
    };
  }
  return {
    status: 502,
    message: safe || "Gemini AI request failed. Please try again.",
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
      const response = await generateContentResilient(
        ai,
        (model, useThinkingConfig) => ({
          model,
          contents: prompt,
          config: {
            ...(useThinkingConfig
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
            systemInstruction: CIVICSNAP_AI_SYSTEM_PROMPT,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                ticket_title: {
                  type: Type.STRING,
                  description:
                    "Formal 6-10 word engineering ticket title in professional English (Task 2).",
                },
                category: {
                  type: Type.STRING,
                  description:
                    "One of: Pothole / Road Damage, Open Manhole, Garbage Blackspot, Broken Footpath, Waterlogging, or Streetlight.",
                },
                ticket_description: {
                  type: Type.STRING,
                  description:
                    "Objective municipal-grade engineering description translated from Hinglish/Kannada-English input (20 to 500 characters).",
                },
                audit_disclaimer: {
                  type: Type.STRING,
                  description: AUDIT_DISCLAIMER_TEXT,
                },
              },
              required: [
                "ticket_title",
                "category",
                "ticket_description",
                "audit_disclaimer",
              ],
            },
          },
        })
      );

      const rawText = extractJsonObject(response.text ?? "");
      const parsedJson = JSON.parse(rawText) as {
        ticket_title?: string;
        title?: string;
        category?: string;
        ticket_description?: string;
        description?: string;
        audit_disclaimer?: string;
      };

      const normalizedCategory = mapProtocolCategoryToIssueCategory(
        parsedJson.category
      );
      const title = (parsedJson.ticket_title ?? parsedJson.title ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);
      const description = (
        parsedJson.ticket_description ??
        parsedJson.description ??
        ""
      )
        .trim()
        .slice(0, 600);

      if (title.length < 5 || description.length < 10) {
        return NextResponse.json(
          { error: "CivicSnap AI returned an incomplete report draft. Please try speaking again." },
          { status: 502 }
        );
      }

      return NextResponse.json({
        title,
        ticket_title: title,
        category: normalizedCategory,
        categoryDisplay: getPromptCategoryName(normalizedCategory),
        protocolCategory: parsedJson.category ?? getPromptCategoryName(normalizedCategory),
        description,
        ticket_description: description,
        audit_disclaimer: AUDIT_DISCLAIMER_TEXT,
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
      const response = await generateContentResilient(
        ai,
        (model, useThinkingConfig) => ({
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
            ...(useThinkingConfig
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
            systemInstruction: CIVICSNAP_AI_SYSTEM_PROMPT,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                is_civic_issue: {
                  type: Type.BOOLEAN,
                  description:
                    "True ONLY if the photo genuinely shows an outdoor public civic/road hazard.",
                },
                detected_subject: {
                  type: Type.STRING,
                  description:
                    "Honest plain-English description of what is actually visible in the photo.",
                },
                rejection_reason: {
                  type: Type.STRING,
                  nullable: true,
                  description:
                    "Concise rejection reason if is_civic_issue is false; null if genuine.",
                },
                confidence: {
                  type: Type.NUMBER,
                  description: "Confidence percentage from 0 to 100.",
                },
                category: {
                  type: Type.STRING,
                  nullable: true,
                  description:
                    "One of: Pothole / Road Damage, Open Manhole, Garbage Blackspot, Broken Footpath, Waterlogging. Null if rejected.",
                },
                ticket_title: {
                  type: Type.STRING,
                  nullable: true,
                  description:
                    "Formal 6-10 word title in professional English; null if rejected.",
                },
                ticket_description: {
                  type: Type.STRING,
                  nullable: true,
                  description:
                    "Objective engineering description of the hazard; null if rejected.",
                },
                severity_score: {
                  type: Type.INTEGER,
                  nullable: true,
                  description: "Severity score 1 to 10; null if rejected.",
                },
                sla_priority: {
                  type: Type.STRING,
                  nullable: true,
                  description:
                    "P1 - Critical (<24h), P2 - High (<48h), or P3 - Routine (<7d); null if rejected.",
                },
                engineering_estimates: {
                  type: Type.OBJECT,
                  nullable: true,
                  properties: {
                    estimated_dimensions: { type: Type.STRING },
                    required_material: { type: Type.STRING },
                    estimated_repair_cost_inr: { type: Type.NUMBER },
                    labor_requirement: { type: Type.STRING },
                  },
                  required: [
                    "estimated_dimensions",
                    "required_material",
                    "estimated_repair_cost_inr",
                    "labor_requirement",
                  ],
                },
                hazard_risk_summary: {
                  type: Type.STRING,
                  nullable: true,
                },
                audit_disclaimer: {
                  type: Type.STRING,
                  description: AUDIT_DISCLAIMER_TEXT,
                },
              },
              required: [
                "is_civic_issue",
                "detected_subject",
                "rejection_reason",
                "confidence",
                "category",
                "ticket_title",
                "ticket_description",
                "severity_score",
                "sla_priority",
                "engineering_estimates",
                "hazard_risk_summary",
                "audit_disclaimer",
              ],
            },
          },
        })
      );

      const rawText = extractJsonObject(response.text ?? "");
      let parsedJson: Record<string, unknown> = {};
      try {
        parsedJson = JSON.parse(rawText) as Record<string, unknown>;
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

      const protocolAudit = normalizeCivicAuditResponse(
        parsedJson,
        payload.locality || "Bengaluru"
      );
      const detectedSubject =
        typeof parsedJson.detected_subject === "string"
          ? parsedJson.detected_subject.replace(/\s+/g, " ").trim().slice(0, 180)
          : "";
      const confidence = Math.min(
        100,
        Math.max(
          0,
          Math.round(
            Number(parsedJson.confidence ?? (protocolAudit.is_civic_issue ? 90 : 95)) ||
              0
          )
        )
      );

      if (!protocolAudit.is_civic_issue) {
        return NextResponse.json({
          ...protocolAudit,
          isGenuineCivicIssue: false,
          detectedSubject: detectedSubject || "Non-civic / irrelevant image",
          rejectionReason: protocolAudit.rejection_reason ?? "",
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

      const normalizedCategory = mapProtocolCategoryToIssueCategory(
        protocolAudit.category
      );
      const est = protocolAudit.engineering_estimates!;
      const socialImpactScore = clampSocialImpactScore(
        (protocolAudit.severity_score ?? 7) * 10
      );

      return NextResponse.json({
        ...protocolAudit,
        isGenuineCivicIssue: true,
        detectedSubject: detectedSubject || protocolAudit.ticket_title!,
        rejectionReason: "",
        confidence,
        title: protocolAudit.ticket_title!,
        category: normalizedCategory,
        categoryDisplay: protocolAudit.category!,
        description: protocolAudit.ticket_description!,
        surroundingLandmarks: `${payload.locality || "Bengaluru"} · ${protocolAudit.sla_priority}`,
        materialEstimate: `${est.required_material} · Est. ₹${est.estimated_repair_cost_inr.toLocaleString("en-IN")} · ${est.labor_requirement}`,
        socialImpactScore,
        economicCostOfDelay: protocolAudit.hazard_risk_summary!,
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

      const response = await generateContentResilient(
        ai,
        (model, useThinkingConfig) => ({
          model,
          contents: promptText,
          config: {
            ...(useThinkingConfig
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
            systemInstruction: CIVICSNAP_AI_SYSTEM_PROMPT,
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

    const response = await generateContentResilient(
      ai,
      (model, useThinkingConfig) => ({
        model,
        contents: { parts },
        config: {
          ...(useThinkingConfig
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
          systemInstruction: CIVICSNAP_AI_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              fix_verified: {
                type: Type.BOOLEAN,
                description:
                  "True ONLY if the specific civic defect has been properly filled/paved/resolved AND match_confidence_score >= 85.",
              },
              match_confidence_score: {
                type: Type.NUMBER,
                description:
                  "Match confidence percentage from 0 to 100. Only pass (fix_verified = true) when >= 85.",
              },
              reason: {
                type: Type.STRING,
                description:
                  "Objective 1-sentence engineering verification rationale.",
              },
              audit_disclaimer: {
                type: Type.STRING,
                description: AUDIT_DISCLAIMER_TEXT,
              },
            },
            required: [
              "fix_verified",
              "match_confidence_score",
              "reason",
              "audit_disclaimer",
            ],
          },
        },
      })
    );

    const rawText = extractJsonObject(response.text ?? "");
    let parsedResult: {
      fix_verified?: boolean;
      match_confidence_score?: number;
      verdict?: string;
      aiConfidenceScore?: number;
      reason?: string;
    } = {};
    try {
      parsedResult = JSON.parse(rawText) as typeof parsedResult;
    } catch {
      const legacy = parseVerificationVerdict(rawText);
      parsedResult = {
        fix_verified: legacy.verdict === "Verified",
        verdict: legacy.verdict,
        reason: legacy.reason,
      };
    }

    const verifiedOutput = normalizeBeforeAfterVerification(parsedResult);

    return NextResponse.json({
      ...verifiedOutput,
      demoMode: false,
    });
  } catch (error) {
    const mapped = mapGeminiError(error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
