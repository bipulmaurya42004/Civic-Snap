# CivicSnap AI — Independent Bengaluru Public Infrastructure Ledger & AI Audit Protocol

> **Independent Citizen-Driven Open Civic Tech Prototype** — Live-camera street reporting, Hinglish voice-to-report AI, anti-spam verification, Before-vs-After Gemini Vision audits, and SHA-256 tamper-evident Civic Merit Certificates for Bengaluru (2026).

---

## Disclaimer

CivicSnap is an independent citizen-driven open civic tech prototype. It is not affiliated with, nor an official agency of, the BBMP, BDA, or the Government of Karnataka.

---

## Key Features

### 1. Anti-Spam & Fraud-Prevention Verification Layer
- **Live Camera Only (`/report`)**: Uses `<input type="file" accept="image/*" capture="environment">` with gallery selection disabled to deter reused screenshots and stock photos.
- **Private EXIF Validation & Stripping (`exifr`)**: Reads EXIF GPS and timestamp privately in-browser, automatically flagging reports as **Needs Review** if EXIF GPS differs by > 500m from reported GPS or if the photo timestamp is older than 24 hours. Raw EXIF data is never displayed publicly and is completely stripped via `<canvas>` re-encoding (< 200KB optimization).
- **Perceptual Image Hashing (`imageHash`)**: Computes a 64-bit average perceptual hash client-side and rejects duplicate or near-duplicate submissions (`"This image was already submitted."`).
- **Daily Rate Limits & 50m / 30-Day Cooldown**: Enforces a maximum of 5 reports per user per day and prevents earning points twice within 50m of an existing report inside a 30-day window.
- **Verification-Only Points**: Zero points are awarded on submission or acceptance. `+50 Civic Merit Points` are credited strictly when a report is marked **Verified & Resolved** with **AI Confidence Score ≥ 90%** AND **Admin approval**.
- **Admin Flagged Reports Queue (`/admin`)**: Dedicated **Flagged Reports** tab listing EXIF/fraud flag reasons with **Approve**, **Reject**, and Before-vs-After AI Verification actions.

### 2. Multimodal AI Audit & Hinglish Voice Intake
- **Hinglish Voice-to-Report**: Converts natural Hindi/Hinglish spoken complaints into structured English titles, categories, and descriptions via server-side Gemini API routes (`/api/gemini`).
- **Material & Priority Audit**: Estimates repair materials (asphalt kg, LED fixtures, labor hours) and automatically tags **Hospital / School High Priority Zones**.
- **Before-vs-After AI Confidence Score**: Compares original citizen hazard photos against repair proof photos and outputs a calibrated **AI Confidence Score (0–100%)**.

### 3. SHA-256 Civic Merit Certificates & Bengaluru Civic Vanguard 2026
- **Certificate of Civic Merit — Issued by CivicSnap (Independent Prototype)**: Automatically unlocked every 5 verified fixes with format `CS-BLR-2026-<UID>`, scannable QR code, public `/verify/[id]` portal, and deterministic **SHA-256 audit hash** (`Independent Open Civic Audit Record`).
- **Bengaluru Civic Vanguard Citation (2026)**: Annual Top 5 shortlist reviewed by an independent community review panel, alongside a **CivicTech Community Micro-Grant (Planned – aspirational, not funded in this prototype)**.

### 4. Hardened Firestore Security Rules
- Enforces zero client forgery on `users/{userId}`, `reports/{reportId}`, `public_reports/{reportId}`, and `issues/{issueId}` — preventing clients from escalating roles, forging points, mutating `status`/`aiScore`/`verifiedAt`, or deleting audit logs.

---

## Tech Stack

- **Framework**: Next.js (App Router), React, TypeScript
- **Styling & Motion**: Tailwind CSS v4 (Clean Light SaaS palette), `motion/react`, `lucide-react`
- **AI & Vision**: `@google/genai` (server-side `/api/gemini` route only)
- **Backend & Auth**: Firebase Authentication (Google Sign-In) + Cloud Firestore + Firebase Storage
- **Image Forensics**: `exifr` (EXIF extraction) + HTML5 Canvas EXIF stripping & < 200KB compression + 64-bit perceptual hash

---

## Judge Mode Instructions

Append `?mode=judge` to the Admin Audit Dashboard URL to open the interactive read-only **Audit Verification Preview** with pre-loaded Before-vs-After Bengaluru repair comparisons and AI Confidence Score breakdowns:

```
/admin?mode=judge
```

You can also inspect the public SHA-256 certificate verification portal directly with the demo credential:

```
/verify/CS-BLR-2026-DEMO
```

---

## Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and configure `GEMINI_API_KEY` (server-only) and optional `NEXT_PUBLIC_ADMIN_EMAILS`.
3. Run the unit test suite:
   ```bash
   npx tsx --test src/lib/civic-logic.test.ts
   ```
4. Start the development server on port 3000:
   ```bash
   npm run dev
   ```
5. Build for production:
   ```bash
   npm run build
   ```
