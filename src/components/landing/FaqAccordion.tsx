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
    id: "privacy-protection",
    question: "How does CivicSnap protect my privacy and location data?",
    answer:
      "Public issue cards display your ward, street landmark, and verified repair photos — never your personal email or phone number. You can also opt out of public citizen aliases anytime from your profile while still earning CivicPoints.",
  },
  {
    id: "state-civic-honors",
    question:
      "How do the Chief Minister's Annual Civic Honors and Digital Certificates work?",
    answer:
      "Citizens earn +50 Civic Merit Points for every AI-verified Before-vs-After infrastructure repair. Every 5 verified fixes automatically unlock an official Bengaluru Urban Digital Civic Merit Certificate with a unique verification ID ready for LinkedIn. At year-end (31st December), the Top 5 Bengaluru citizens are felicitated by the Hon'ble Chief Minister at the Annual Urban Governance Summit with a State Civic Medal, innovation grant, and 1-year Honorary Civic Warden designation.",
  },
  {
    id: "contractor-audits",
    question: "How do AI contractor material audits prevent fake repairs?",
    answer:
      "When a citizen snaps an issue, CivicSnap Vision AI inspects photo authenticity, estimates repair materials (such as kg of hot-mix asphalt or LED fixtures), and computes a 30-day cost of delay. Before a ticket can close, contractors upload an After photo; CivicSnap Vision AI compares both photos for location match and repair quality, flagging duplicate or incomplete patches.",
  },
  {
    id: "hinglish-voice",
    question: "Can I report issues in Hindi or Hinglish?",
    answer:
      "Yes. Tap the microphone button on /report and speak naturally (for example, 'Bhai yahan main road pe 2ft ka gaddha hai'). CivicSnap converts your Hinglish speech into a structured English title, category, and factual description for quick review.",
  },
  {
    id: "gov-affiliation",
    question: "Is CivicSnap an official government portal?",
    answer:
      "CivicSnap is an independent civic-technology pilot built for Bengaluru communities (Indiranagar, HSR Layout, Koramangala, Whitefield, Jayanagar, MG Road, and Malleshwaram). It documents issues transparently and provides auditable proof timelines alongside community follow-up.",
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
