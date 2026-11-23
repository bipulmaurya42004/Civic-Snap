"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Languages,
  Loader2,
  Mic,
  MicOff,
  Sparkles,
  Square,
} from "lucide-react";
import type { IssueCategory, VoiceToReportResponse } from "@/types/civic";

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

interface HinglishVoiceInputProps {
  onAutoFill: (result: {
    title: string;
    category: IssueCategory;
    description: string;
    demoMode: boolean;
    notice?: string;
  }) => void;
}

const SAMPLE_HINGLISH_PHRASES = [
  "Yahan Sector 4 main road par bahut bada gaddha hai aur baarish ka paani bhara hua hai",
  "Bus stop ke paas kachra ka dher pada hai aur bahut badboo aa rahi hai",
  "Hamari gali ki streetlight teen din se band hai aur raat me bilkul andhera rehta hai",
] as const;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

export function HinglishVoiceInput({ onAutoFill }: HinglishVoiceInputProps) {
  const [speechSupported, setSpeechSupported] = useState(true);
  const [lang, setLang] = useState<"hi-IN" | "en-IN">("hi-IN");
  const [listening, setListening] = useState(false);
  const [converting, setConverting] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [demoNotice, setDemoNotice] = useState<string | null>(null);
  const [showManualFallback, setShowManualFallback] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const finalTranscriptRef = useRef("");
  const latestTranscriptRef = useRef("");

  useEffect(() => {
    setSpeechSupported(Boolean(getSpeechRecognitionCtor()));
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore teardown errors
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  const convertTranscriptWithGemini = async (spokenText: string) => {
    const clean = spokenText.replace(/\s+/g, " ").trim();
    if (clean.length < 3) {
      setError(
        "No clear speech was detected. Please tap the Mic button again and speak in Hindi or Hinglish."
      );
      return;
    }

    setConverting(true);
    setError(null);
    setSuccessNote(null);
    setDemoNotice(null);

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

      onAutoFill({
        title: data.title,
        category: data.category,
        description: data.description,
        demoMode: Boolean(data.demoMode),
        notice: data.notice,
      });

      setSuccessNote(
        `Auto-filled Title, Category (${data.categoryDisplay || data.category}), and Description. Review below before continuing.`
      );
      if (data.demoMode && data.notice) {
        setDemoNotice(data.notice);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Voice-to-Report conversion failed. Please try again or type manually."
      );
    } finally {
      setConverting(false);
    }
  };

  const handleStopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        setListening(false);
      }
    }
  };

  const handleStartListening = () => {
    setError(null);
    setSuccessNote(null);
    setDemoNotice(null);

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSpeechSupported(false);
      setShowManualFallback(true);
      setError(
        "Web Speech API is not supported in this browser. Type or pick a Hinglish phrase below to auto-fill with Gemini AI."
      );
      return;
    }

    try {
      const recognition = new Ctor();
      recognition.lang = lang;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      finalTranscriptRef.current = "";
      latestTranscriptRef.current = "";
      setTranscript("");
      setInterimText("");

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
        const combined = `${finalChunk} ${interimChunk}`.trim();
        latestTranscriptRef.current = combined;
        setTranscript(finalChunk);
        setInterimText(interimChunk);
      };

      recognition.onerror = (event) => {
        setListening(false);
        recognitionRef.current = null;
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setError(
            "Microphone permission was denied. Allow mic access in your browser or use the Hinglish text input below."
          );
          setShowManualFallback(true);
        } else if (event.error === "no-speech") {
          setError("No speech detected. Tap the Mic button and speak clearly.");
        } else if (event.error !== "aborted") {
          setError(`Voice capture error (${event.error}). Please retry or type Hinglish below.`);
          setShowManualFallback(true);
        }
      };

      recognition.onend = () => {
        setListening(false);
        recognitionRef.current = null;
        const spoken = (
          finalTranscriptRef.current || latestTranscriptRef.current
        ).trim();
        setInterimText("");
        if (spoken.length >= 3) {
          setTranscript(spoken);
          void convertTranscriptWithGemini(spoken);
        }
      };

      recognitionRef.current = recognition;
      setListening(true);
      recognition.start();
    } catch {
      setListening(false);
      setShowManualFallback(true);
      setError(
        "Could not start microphone capture. You can type Hinglish text below to convert with AI."
      );
    }
  };

  const liveDisplayText = [transcript, interimText].filter(Boolean).join(" ").trim();

  return (
    <div className="rounded-2xl border border-blue-200/80 bg-blue-50/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB]">
              <Sparkles size={13} aria-hidden="true" />
              Hinglish Voice-to-Report
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
              <Languages size={11} aria-hidden="true" />
              Hindi / Hinglish → English
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Speak naturally in Hindi or Hinglish (e.g., &ldquo;Road par bada gaddha
            hai&rdquo;) — Gemini AI auto-fills the Title, Category, and Description
            for your review.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <select
            aria-label="Voice recognition language"
            value={lang}
            onChange={(e) => setLang(e.target.value as "hi-IN" | "en-IN")}
            disabled={listening || converting}
            className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700"
          >
            <option value="hi-IN">Hindi / Hinglish (hi-IN)</option>
            <option value="en-IN">Indian English (en-IN)</option>
          </select>

          {listening ? (
            <button
              type="button"
              onClick={handleStopListening}
              aria-label="Stop voice recording and convert to report"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 whitespace-nowrap"
            >
              <Square size={13} aria-hidden="true" />
              <span>Stop &amp; Fill</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartListening}
              disabled={converting}
              aria-label="Speak civic issue in Hinglish using microphone"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#2563EB] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap"
            >
              {converting ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : speechSupported ? (
                <Mic size={14} aria-hidden="true" />
              ) : (
                <MicOff size={14} aria-hidden="true" />
              )}
              <span>{converting ? "Converting..." : "Speak in Hinglish"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Listening Banner */}
      {listening && (
        <div
          role="status"
          className="mt-3 flex items-center gap-2.5 rounded-xl border border-red-200 bg-white px-3.5 py-2.5 text-xs text-slate-800"
        >
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-red-700">
              Listening ({lang === "hi-IN" ? "Hindi / Hinglish" : "English"})...
            </p>
            <p className="mt-0.5 text-slate-600">
              {liveDisplayText || "Speak your civic issue now, then pause or click Stop & Fill."}
            </p>
          </div>
        </div>
      )}

      {/* Optional / Fallback Hinglish Text Input for browsers without Web Speech API */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowManualFallback((prev) => !prev)}
          className="text-xs font-medium text-[#2563EB] hover:underline"
        >
          {showManualFallback
            ? "Hide Hinglish text input"
            : "Mic unavailable? Type or try a Hinglish phrase"}
        </button>
        {transcript && !listening && !showManualFallback && (
          <span className="truncate text-[11px] text-slate-500">
            Heard: &ldquo;{transcript}&rdquo;
          </span>
        )}
      </div>

      {showManualFallback && (
        <div className="mt-3 space-y-2.5 rounded-xl border border-slate-200 bg-white p-3">
          <label
            htmlFor="hinglish-fallback-input"
            className="block text-xs font-semibold text-slate-700"
          >
            Hinglish voice transcript (editable)
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="hinglish-fallback-input"
              type="text"
              maxLength={500}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="e.g., Sector 4 road par bahut bada gaddha hai aur paani bhara hai"
              className="min-h-[40px] flex-1 rounded-xl border border-slate-200 px-3 text-xs text-slate-900 placeholder:text-slate-400"
            />
            <button
              type="button"
              disabled={converting || transcript.trim().length < 3}
              onClick={() => void convertTranscriptWithGemini(transcript)}
              className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {converting ? (
                <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles size={13} aria-hidden="true" />
              )}
              <span>Auto-Fill with AI</span>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] font-medium text-slate-500">
              Try sample:
            </span>
            {SAMPLE_HINGLISH_PHRASES.map((phrase, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setTranscript(phrase);
                  void convertTranscriptWithGemini(phrase);
                }}
                disabled={converting}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
              >
                {idx === 0 ? "Pothole (Hinglish)" : idx === 1 ? "Garbage (Hinglish)" : "Streetlight (Hinglish)"}
              </button>
            ))}
          </div>
        </div>
      )}

      {successNote && (
        <p
          role="status"
          className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800"
        >
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{successNote}</span>
        </p>
      )}

      {demoNotice && (
        <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {demoNotice}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
        >
          <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
