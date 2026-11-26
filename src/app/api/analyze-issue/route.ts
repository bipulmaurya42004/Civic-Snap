import { NextRequest, NextResponse } from "next/server";
import { ThinkingLevel, Type } from "@google/genai";
import {
  AUDIT_DISCLAIMER_TEXT,
  CIVICSNAP_AI_SYSTEM_PROMPT,
  extractAsphaltKgFromMaterial,
  mapProtocolCategoryToIssueCategory,
  normalizeCivicAuditResponse,
  severityScoreToLegacyLabel,
} from "@/lib/civicsnap-ai-protocol";
import {
  createGeminiServerClient,
  generateContentResilient,
  isHighDemandOrUnavailableError,
  isRateLimitError,
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

  const dataUrlMatch = base64.match(
    /^data:([a-zA-Z0-9/+.-]+);base64,([\s\S]+)$/
  );
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
 * CivicSnap AI Independent Civic Audit & Ward Triage Protocol endpoint.
 * Executes Task 1 (Anti-Spam & Image Validity Check), Task 2 (Hinglish to
 * Formal Civic Translation when userInput is provided), and Task 3 (Bengaluru
 * Civil Engineering & Cost Estimation) in strict pure JSON.
 */
export async function POST(request: NextRequest) {
  let locality = "Bengaluru";

  try {
    let body: {
      imageBase64?: unknown;
      mimeType?: unknown;
      locality?: unknown;
      userInput?: unknown;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const parsedImage = parseBase64Input(body?.imageBase64, body?.mimeType);
    if (parsedImage.error || !parsedImage.base64 || !parsedImage.mimeType) {
      return NextResponse.json(
        { success: false, error: parsedImage.error ?? "Invalid image input." },
        { status: 400 }
      );
    }

    if (typeof body?.locality === "string" && body.locality.trim()) {
      locality = body.locality.trim().slice(0, 80);
    }
    const userNote =
      typeof body?.userInput === "string"
        ? body.userInput.replace(/\s+/g, " ").trim().slice(0, 600)
        : "";

    const ai = createGeminiServerClient();
    if (!ai) {
      return NextResponse.json(
        {
          success: false,
          error:
            "GEMINI_API_KEY is not configured on the server. Please add GEMINI_API_KEY in Settings > Secrets and retry.",
        },
        { status: 503 }
      );
    }

    const promptText = [
      `Run the Independent Civic Audit & Ward Triage Protocol for this image captured in ${locality}, Bengaluru.`,
      userNote
        ? `Citizen colloquial/Hinglish note to translate & formalize (Task 2): "${userNote}"`
        : "No additional colloquial text note was provided; derive ticket_title and ticket_description directly from the visual civic defect.",
      "Perform Task 1 (Anti-Spam & Image Validity Check), Task 2 (Hinglish to Formal Civic Translation if applicable), and Task 3 (Bengaluru Standard Rates Civil Engineering & Cost Estimation).",
      "If the image is an indoor photo, selfie, meme, laptop/phone screen, animal, food, document, clean undamaged road, or irrelevant screenshot, set is_civic_issue = false, provide a concise rejection_reason describing what you actually saw, and set category, ticket_title, ticket_description, severity_score, sla_priority, engineering_estimates, and hazard_risk_summary to null.",
      `Always set audit_disclaimer to: "${AUDIT_DISCLAIMER_TEXT}"`,
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
          systemInstruction: CIVICSNAP_AI_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              is_civic_issue: {
                type: Type.BOOLEAN,
                description:
                  "True ONLY if the image shows a genuine outdoor civic/road hazard.",
              },
              rejection_reason: {
                type: Type.STRING,
                nullable: true,
                description:
                  "Concise reason if is_civic_issue is false; null if genuine.",
              },
              detected_subject: {
                type: Type.STRING,
                description:
                  "Short plain-English summary of what is visible in the photo.",
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
                  "Objective engineering description of the hazard translated from colloquial input; null if rejected.",
              },
              severity_score: {
                type: Type.INTEGER,
                nullable: true,
                description:
                  "Severity score from 1 to 10; null if rejected.",
              },
              sla_priority: {
                type: Type.STRING,
                nullable: true,
                description:
                  "One of: P1 - Critical (<24h), P2 - High (<48h), P3 - Routine (<7d). Null if rejected.",
              },
              engineering_estimates: {
                type: Type.OBJECT,
                nullable: true,
                properties: {
                  estimated_dimensions: {
                    type: Type.STRING,
                    description:
                      "Estimated surface area (sq meters) and depth (cm), e.g., Approx 1.4m x 0.8m, depth ~9cm.",
                  },
                  required_material: {
                    type: Type.STRING,
                    description:
                      "Estimated repair material (e.g., Approx 120-150 kg Cold-Mix Bituminous Asphalt).",
                  },
                  estimated_repair_cost_inr: {
                    type: Type.NUMBER,
                    description:
                      "Standard Bengaluru market repair cost estimate in INR.",
                  },
                  labor_requirement: {
                    type: Type.STRING,
                    description:
                      "Crew size, equipment, and estimated duration.",
                  },
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
                description:
                  "Concise commuter/pedestrian risk summary; null if rejected.",
              },
              audit_disclaimer: {
                type: Type.STRING,
                description: AUDIT_DISCLAIMER_TEXT,
              },
            },
            required: [
              "is_civic_issue",
              "rejection_reason",
              "detected_subject",
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
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "CivicSnap AI returned a non-JSON audit response. Please retake the photo and try again.",
        },
        { status: 502 }
      );
    }

    const detectedSubject =
      typeof parsed.detected_subject === "string"
        ? parsed.detected_subject.replace(/\s+/g, " ").trim().slice(0, 180)
        : "";

    const protocolAudit = normalizeCivicAuditResponse(parsed, locality);

    if (!protocolAudit.is_civic_issue) {
      return NextResponse.json(
        {
          success: true,
          ...protocolAudit,
          audit: {
            ...protocolAudit,
            detected_subject: detectedSubject || "Non-civic / indoor image",
          },
        },
        { status: 200 }
      );
    }

    const normalizedCat = mapProtocolCategoryToIssueCategory(
      protocolAudit.category
    );
    const severityScore10 = protocolAudit.severity_score ?? 7;
    const socialImpactScore = Math.min(100, Math.max(10, severityScore10 * 10));
    const est = protocolAudit.engineering_estimates!;
    const asphaltEstimateKg = extractAsphaltKgFromMaterial(
      est.required_material,
      normalizedCat === "pothole" ? 120 : 0
    );
    const estimatedCostInr = est.estimated_repair_cost_inr;

    return NextResponse.json(
      {
        success: true,
        ...protocolAudit,
        audit: {
          ...protocolAudit,
          normalized_category: normalizedCat,
          severity: severityScoreToLegacyLabel(severityScore10),
          asphalt_estimate_kg: asphaltEstimateKg,
          estimated_cost_inr: estimatedCostInr,
          title: protocolAudit.ticket_title!,
          summary: protocolAudit.ticket_description!,
          detected_subject: detectedSubject || protocolAudit.ticket_title!,
          surrounding_landmarks: `${locality}, Bengaluru — ${protocolAudit.sla_priority}`,
          material_estimate: `${est.required_material} · ${est.labor_requirement}`,
          social_impact_score: socialImpactScore,
          economic_cost_of_delay:
            protocolAudit.hazard_risk_summary ??
            `₹${(estimatedCostInr * 4).toLocaleString("en-IN")}+ est. 30-day commuter & vehicle wear impact`,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    const safeError = sanitizeGeminiErrorMessage(err);
    console.error("[CivicSnap /api/analyze-issue] Error:", safeError);

    if (isRateLimitError(safeError)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Gemini API quota or rate limit reached (429). Please wait a moment and tap CivicSnap AI Verify again, or select a billing-enabled key in Settings > Secrets.",
        },
        { status: 429 }
      );
    }

    if (isHighDemandOrUnavailableError(safeError)) {
      return NextResponse.json(
        {
          success: false,
          error: "AI traffic is momentarily high. Tap Verify again in 5 seconds.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: safeError,
      },
      { status: 502 }
    );
  }
}
