"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: "privacy-exif-protection",
    question: "How does CivicSnap protect my privacy, EXIF metadata, and GPS data?",
    answer:
      "Citizen reports require live camera capture to deter reused screenshots. EXIF GPS coordinates and timestamps are checked privately inside your browser solely for anti-fraud review (flagging mismatches > 500m or photos older than 24 hours), then completely stripped before upload. Raw EXIF data is never stored or shown publicly.",
  },
  {
    id: "vanguard-citation-points",
    question:
      "How do Civic Merit Points, SHA-256 Certificates, and the Bengaluru Civic Vanguard Citation work?",
    answer:
      "Zero points are awarded on raw report submission. Citizens earn +50 Civic Merit Points strictly when a repair is marked Verified and Resolved with an AI Confidence Score ≥ 90% plus Admin approval. Every 5 verified fixes unlock a SHA-256 verifiable Certificate of Civic Merit (Independent Open Civic Audit Record). Annual Top 5 shortlist winners are reviewed by an independent community review panel for the Bengaluru Civic Vanguard Citation and a planned CivicTech Community Micro-Grant (aspirational, not funded in this prototype).",
  },
  {
    id: "anti-spam-duplicates",
    question: "How does CivicSnap prevent duplicate images, spam, and point farming?",
    answer:
      "Every live photo is fingerprinted using a 64-bit perceptual hash before upload so duplicate or near-duplicate images are immediately rejected. Accounts are capped at 5 reports per day, and reports filed within 50 meters of a previously credited site enter a 30-day points cooldown.",
  },
  {
    id: "hinglish-voice",
    question: "Can I report issues in Hindi or Hinglish?",
    answer:
      "Yes. Tap the microphone button on /report and speak naturally (for example, 'Bhai yahan main road pe 2ft ka gaddha hai'). CivicSnap converts your Hinglish speech into a structured English title, category, and factual description for quick review.",
  },
  {
    id: "independent-prototype",
    question: "Is CivicSnap an official government portal?",
    answer:
      "No. CivicSnap is an independent citizen-driven open civic tech prototype built for Bengaluru communities (Indiranagar, HSR Layout, Koramangala, Whitefield, Jayanagar, MG Road, and Malleshwaram). It is not affiliated with any municipal agency or state government, and documents issues transparently as an open civic audit ledger.",
  },
] as const;

export function FaqAccordion() {
  const [openId, setOpenId] = useState<string | null>(FAQ_ITEMS[0].id);

  return (
    <div className="divide-y divide-slate-200/90 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      {FAQ_ITEMS.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div key={item.id}>
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${item.id}`}
                onClick={() => setOpenId(isOpen ? null : item.id)}
                className="flex min-h-[58px] w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold text-slate-900 transition-colors hover:bg-slate-50 sm:px-6"
              >
                <span>{item.question}</span>
                <ChevronDown
                  size={18}
                  aria-hidden="true"
                  className={`shrink-0 text-slate-400 transition-transform duration-200 ${
                    isOpen ? "rotate-180 text-blue-600" : ""
                  }`}
                />
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={`faq-panel-${item.id}`}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 text-sm leading-6 text-slate-600 sm:px-6">
                    {item.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
