import {
  GoogleGenAI,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from "@google/genai";

const ALLOWED_MODELS = new Set([
  "gemini-4-hydrogen",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
]);

export function getGeminiServerModel(): string {
  const configured = process.env.GEMINI_MODEL?.trim() ?? "";
  if (configured && ALLOWED_MODELS.has(configured)) {
    return configured;
  }
  return "gemini-4-hydrogen";
}

export function getGeminiCandidateModels(): string[] {
  const primary = getGeminiServerModel();
  const candidates = [primary, "gemini-4-hydrogen", "gemini-3.1-flash-lite"];
  return Array.from(new Set(candidates));
}

export function isGeminiApiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

/**
 * Shared server-side Gemini SDK client with required telemetry header.
 * Never import this file from client components.
 */
export function createGeminiServerClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

/**
 * Strips any potential API key query strings or noisy wrappers from upstream
 * Gemini error messages while preserving actionable diagnostics.
 */
export function sanitizeGeminiErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "Unknown error");
  // Redact any key=... query parameter or AIza... token if present
  const redacted = raw
    .replace(/key=[A-Za-z0-9_\-]+/gi, "key=[REDACTED]")
    .replace(/AIza[0-9A-Za-z\-_]{20,}/g, "[REDACTED_KEY]")
    .replace(/\s+/g, " ")
    .trim();

  // Try extracting nested JSON error.message if the SDK stringified an API JSON payload
  try {
    const braceIdx = redacted.indexOf("{");
    if (braceIdx !== -1) {
      const parsed = JSON.parse(redacted.slice(braceIdx)) as {
        error?: { message?: string; status?: string; code?: number };
      };
      if (parsed?.error?.message) {
        const statusPart = parsed.error.status ? `${parsed.error.status}: ` : "";
        return `${statusPart}${parsed.error.message}`.slice(0, 320);
      }
    }
  } catch {
    // Use redacted plain text below
  }

  return redacted.slice(0, 320) || "Gemini AI request failed.";
}

function isModelUnavailableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("not_found") ||
    lower.includes("404") ||
    lower.includes("is not found for api version") ||
    lower.includes("not supported for generatecontent") ||
    lower.includes("unsupported model")
  );
}

function isRetryableTransientError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("503") ||
    lower.includes("500") ||
    lower.includes("unavailable") ||
    lower.includes("overloaded") ||
    lower.includes("econnreset") ||
    lower.includes("fetch failed") ||
    lower.includes("timeout")
  );
}

/**
 * Executes ai.models.generateContent with automatic retry on transient 5xx/network
 * errors and automatic fallback from gemini-4-hydrogen -> gemini-3.1-flash-lite
 * if a model alias returns 404/NOT_FOUND or thinkingConfig incompatibility.
 */
export async function generateContentResilient(
  ai: GoogleGenAI,
  buildParams: (model: string, useThinkingConfig: boolean) => GenerateContentParameters
): Promise<GenerateContentResponse> {
  const models = getGeminiCandidateModels();
  let lastError: unknown;

  for (const model of models) {
    // gemini-3.1-flash-lite defaults to minimal thinking; keep thinkingConfig optional on fallback
    const useThinking = model === "gemini-4-hydrogen";

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await ai.models.generateContent(buildParams(model, useThinking));
      } catch (err) {
        lastError = err;
        const msg = sanitizeGeminiErrorMessage(err);

        // If thinkingConfig itself caused a 400 error, retry immediately without thinkingConfig
        if (
          useThinking &&
          msg.toLowerCase().includes("thinking") &&
          attempt === 0
        ) {
          try {
            return await ai.models.generateContent(buildParams(model, false));
          } catch (retryErr) {
            lastError = retryErr;
          }
        }

        // If this model is not found/supported on the user's API key, immediately try next model
        if (isModelUnavailableError(msg)) {
          break;
        }

        if (isRetryableTransientError(msg) && attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 600));
          continue;
        }

        throw err;
      }
    }
  }

  throw lastError;
}
