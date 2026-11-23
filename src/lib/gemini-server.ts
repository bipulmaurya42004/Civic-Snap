import { GoogleGenAI } from "@google/genai";

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
