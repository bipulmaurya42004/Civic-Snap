# CivicSnap

**Snap. Report. Track.**  
*Sirf photo nahi. Follow-up bhi.*

CivicSnap is an independent civic-technology prototype where residents, students, commuters, and volunteers can create photo-based reports of local city issues, review editable AI category suggestions, and follow available status updates in one place.

> **Important boundary:** CivicSnap is **not** an official government service and has no affiliation with any municipal authority. Submitting a report does not automatically send it to authorities or guarantee a repair. Prototype status updates are managed by the CivicSnap project team.

---

## Current Status: Milestone 1 — Runnable UI Foundation

This repository currently implements **Milestone 1** (genuine Next.js App Router + TypeScript + Tailwind CSS UI foundation). It is **not** the finished backend submission yet.

### What works in Milestone 1
- Genuine **Next.js App Router** TypeScript application (`strict: true`) with Tailwind CSS v4 and `next/font/google` (`Plus Jakarta Sans` + `Inter`).
- Brand system including original SVG pin-and-lens logo (`CivicSnapLogo`), accessible status indicators (color + icon + text), and reusable loading, empty, and error state components.
- Complete responsive **Landing Page** (`/`) with all 10 sections (Header, Hero with clearly labelled sample report preview, The Problem, How It Works, Feature Grid, Interactive Product Preview using real app components, Why CivicSnap dark contrast section, FAQ accordion, Final CTA, and Footer with independent-project disclaimer).
- Interactive **Read-Only Demo** (`/demo`) with prominent sample-data banner, fictional localities (`Demo Area A`–`Demo Area D`), live filtering/sorting/pagination, sample report detail timelines (`/issues/CS-DEMO-101`–`CS-DEMO-106`), sample dashboard, and server-rule-derived sample leaderboard.
- All main route layouts ready for modular backend integration: `/`, `/demo`, `/report`, `/issues`, `/issues/[id]`, `/dashboard`, `/leaderboard`, `/profile`, `/login`, `/signup`, `/admin`, `/privacy`.
- Decoupled, unit-tested domain logic (`src/lib/civic-logic.ts` & `src/lib/civic-logic.test.ts`).

### Remaining Milestones
- **Milestone 2 — Real Supabase Flow**: Postgres migrations, Row Level Security policies, private Storage bucket + policies, `@supabase/ssr` Auth (`/login`, `/signup`, callbacks), server-side photo validation & EXIF stripping, real report creation, saved report detail pages, and user profile management.
- **Milestone 3 — AI, Admin, and Real Data**: Authenticated server-side Gemini image analysis (`@google/genai`) with schema validation, persistent rate limiting, and manual fallback; protected server-verified `/admin` workflow with atomic `report_events` transitions; live `/dashboard` queries and server-derived opt-in `/leaderboard`.
- **Milestone 4 — Verification and Deployment**: End-to-end checks for auth, persistence, private-data isolation, AI fallback, mobile usability, and Vercel production deployment.

---

## 1. Local Installation

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

### Scripts
- `npm run dev` — Start Next.js development server on port `3000`
- `npm run build` — Production build (`next build`)
- `npm run start` — Start production server on port `3000`
- `npm run lint` — TypeScript strict check (`tsc --noEmit`)
- `npm run test` — Run pure domain-logic unit tests (`tsx --test src/lib/civic-logic.test.ts`)

## 2. Environment Variables

See `.env.example`:
- `NEXT_PUBLIC_APP_URL` — Public site URL (e.g. `http://localhost:3000`)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (Milestone 2+)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (Milestone 2+)
- `GEMINI_API_KEY` — Server-only Gemini API key (Milestone 3+; never prefix with `NEXT_PUBLIC_`)
- `GEMINI_MODEL` — Supported multimodal Gemini model identifier (Milestone 3+, e.g. `gemini-2.5-flash`)

Missing production environment variables will not break the build; the read-only `/demo` route remains fully browsable while backend-dependent routes display clear configuration/milestone notices.

## 3. Vercel Deployment

This repository is a standard single-project Next.js App Router codebase compatible with Vercel:
1. Push the repository to GitHub/GitLab/Bitbucket.
2. Import into Vercel (Framework Preset: **Next.js**).
3. Configure environment variables for Milestones 2–3 in Vercel Project Settings.
4. Deploy (`npm run build`).
