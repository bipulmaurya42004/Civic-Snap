import type { Metadata } from "next";
import { DM_Sans, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { FirebaseAuthProvider } from "@/components/providers/FirebaseAuthProvider";
import { AuthModalProvider } from "@/components/AuthModal";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default:
      "CivicSnap AI — Independent Bengaluru Public Infrastructure Ledger & AI Audit Protocol",
    template: "%s · CivicSnap AI",
  },
  description:
    "CivicSnap AI — Independent Bengaluru Public Infrastructure Ledger & AI Audit Protocol. Citizen-driven photo reporting, Hinglish voice intake, Gemini AI Confidence Score audits, and Bengaluru Civic Vanguard Citations.",
  openGraph: {
    title:
      "CivicSnap AI — Independent Bengaluru Public Infrastructure Ledger & AI Audit Protocol",
    description:
      "Independent citizen-driven open civic infrastructure ledger for Bengaluru with live-camera verification, AI Confidence Score repair audits, and tamper-evident SHA-256 certificates.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title:
      "CivicSnap AI — Independent Bengaluru Public Infrastructure Ledger & AI Audit Protocol",
    description:
      "Independent citizen-driven Bengaluru public infrastructure ledger with Hinglish voice reporting, AI Confidence Score verification, and Bengaluru Civic Vanguard Citations.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${dmSans.variable}`}
    >
      <body className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900 antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[#2563EB] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to main content
        </a>
        <FirebaseAuthProvider>
          <AuthModalProvider>
            <SiteHeader />
            <main id="main-content" className="flex-1">
              {children}
            </main>
            <SiteFooter />
          </AuthModalProvider>
        </FirebaseAuthProvider>
      </body>
    </html>
  );
}
