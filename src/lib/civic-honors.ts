import { computeSha256Hex } from "@/lib/anti-spam";
import type {
  CertificateMilestone,
  CitizenHonorsSnapshot,
  CivicCertificateData,
  StateCivicBadge,
} from "@/types/civic";

export const ANNUAL_CM_SEASON_YEAR = 2026;
export const ANNUAL_CM_SEASON_CLOSE_LABEL = "31st December 2026";
export const ANNUAL_CM_SEASON_SHORT_CLOSE = "Dec 31, 2026";
export const ANNUAL_CM_SUMMIT_TITLE =
  "CivicSnap Independent Community Civic Audit Cycle 2026";
export const CERTIFICATE_HEADER_TITLE =
  "Certificate of Civic Merit — Issued by CivicSnap (Independent Prototype)";
export const CERTIFICATE_RECORD_LABEL = "Independent Open Civic Audit Record";
export const CERTIFICATE_VERIFY_BASE_URL =
  "https://civicsnap-ai.vercel.app/verify";
export const ANNUAL_CM_TOP_5_THRESHOLD_POINTS = 1100;
export const DEFAULT_PREVIEW_MERIT_POINTS = 750;
export const DEFAULT_PREVIEW_VERIFIED_FIXES = 7;
export const DEFAULT_PREVIEW_CITYWIDE_RANK = 12;

export const CM_HERO_SPOTLIGHT_PILLARS = [
  {
    id: "citation",
    title: "Bengaluru Civic Vanguard Citation",
    subtitle: "SHA-256 Verifiable Open Civic Record",
  },
  {
    id: "grant",
    title: "CivicTech Community Micro-Grant",
    subtitle: "(Planned – aspirational, not funded in this prototype)",
  },
  {
    id: "panel",
    title: "Independent Community Review Panel",
    subtitle: "Top 5 Annual Shortlist with AI Confidence Score ≥ 90%",
  },
] as const;

export const CM_ANNUAL_AWARD_PERKS = [
  {
    number: "01",
    title: "Bengaluru Civic Vanguard Citation",
    description:
      "Top 5 independent citizen auditors in the 2026 season receive a publicly verifiable Bengaluru Civic Vanguard Citation backed by a SHA-256 audit hash.",
  },
  {
    number: "02",
    title: "Open Civic Audit Ledger Recognition",
    description:
      "Permanent placement on the CivicSnap 2026 Vanguard Shortlist after an independent community review panel validates all high-confidence fixes.",
  },
  {
    number: "03",
    title: "CivicTech Community Micro-Grant (Planned)",
    description:
      "CivicTech Community Micro-Grant (Planned – aspirational, not funded in this prototype) envisioned to support neighborhood open-data tools and civic sensors.",
  },
  {
    number: "04",
    title: "Community Ward Coordinator Recognition",
    description:
      "Featured independent contributor profile highlighting verified before-and-after infrastructure audits across Bengaluru wards.",
  },
] as const;

interface BadgeDefinition {
  id: StateCivicBadge["id"];
  level: StateCivicBadge["level"];
  title: string;
  tierScope: StateCivicBadge["tierScope"];
  requirementLabel: string;
  minVerifiedFixes: number | null;
  top5Only?: boolean;
  description: string;
}

export const STATE_CIVIC_BADGE_DEFINITIONS: readonly BadgeDefinition[] = [
  {
    id: "ward-scout",
    level: 1,
    title: "Ward Scout",
    tierScope: "Ward Level",
    requirementLabel: "1+ Verified Fix",
    minVerifiedFixes: 1,
    description:
      "First-responder neighborhood steward who documents and verifies public infrastructure hazards.",
  },
  {
    id: "state-urban-sentinel",
    level: 2,
    title: "Bengaluru Urban Sentinel",
    tierScope: "City Level",
    requirementLabel: "5+ Verified Fixes",
    minVerifiedFixes: 5,
    description:
      "Recognized citizen contributor with at least 5 AI-verified street repairs (AI Confidence Score ≥ 90%) and Level 1 Civic Merit Certificate.",
  },
  {
    id: "state-infrastructure-guardian",
    level: 3,
    title: "Infrastructure Audit Guardian",
    tierScope: "City Level",
    requirementLabel: "15+ Verified Fixes",
    minVerifiedFixes: 15,
    description:
      "Senior civic auditor safeguarding roads, lighting, and school/hospital corridors across Bengaluru wards.",
  },
  {
    id: "national-civic-vanguard",
    level: 4,
    title: "Bengaluru Civic Vanguard",
    tierScope: "Bengaluru Vanguard",
    requirementLabel: "30+ Verified Fixes",
    minVerifiedFixes: 30,
    description:
      "Distinguished independent civic benchmark for sustained urban accountability and verified public works.",
  },
  {
    id: "cm-civic-laureate",
    level: 5,
    title: "Civic Vanguard Laureate",
    tierScope: "Annual Vanguard Shortlist",
    requirementLabel: "Top 5 Annual Shortlist",
    minVerifiedFixes: null,
    top5Only: true,
    description:
      "Top 5 annual citizen auditors shortlisted for the Bengaluru Civic Vanguard Citation after independent community panel review.",
  },
] as const;

/**
 * Normalizes a Firebase UID or falls back to a deterministic 6-char hash
 * or 'DEMO' so every 2026 Certificate ID follows:
 *   CS-BLR-2026-${user.uid ? user.uid.slice(0, 6).toUpperCase() : 'DEMO'}
 * (with `-L{level}` suffix for Level 2+ milestones).
 */
export function generateCertificateId(
  citizenName: string,
  milestoneLevel: number = 1,
  year: number = ANNUAL_CM_SEASON_YEAR,
  userUid?: string | null
): string {
  const cleanUid = (userUid ?? "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 6)
    .toUpperCase();

  let token = cleanUid;
  if (!token) {
    const normalizedName = citizenName.trim().toLowerCase();
    if (
      !normalizedName ||
      normalizedName.includes("aarav sharma") ||
      normalizedName.includes("demo") ||
      normalizedName.includes("sample")
    ) {
      token = "DEMO";
    } else {
      const seed = `${normalizedName}::${year}`;
      let hash = 2166136261;
      for (let i = 0; i < seed.length; i += 1) {
        hash ^= seed.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      token = Math.abs(hash >>> 0)
        .toString(36)
        .toUpperCase()
        .padStart(6, "0")
        .slice(0, 6);
    }
  }

  const suffix = milestoneLevel > 1 ? `-L${milestoneLevel}` : "";
  return `CS-BLR-${year}-${token}${suffix}`;
}

export function computeCertificateSha256(cert: {
  certificateId: string;
  recipientName: string;
  ward: string;
  verifiedFixes: number;
  meritPoints: number;
  milestoneLevel: number;
}): string {
  const canonicalPayload = [
    "CIVICSNAP-OPEN-CIVIC-AUDIT-V1",
    cert.certificateId.trim().toUpperCase(),
    cert.recipientName.trim(),
    cert.ward.trim(),
    String(cert.verifiedFixes),
    String(cert.meritPoints),
    String(cert.milestoneLevel),
  ].join("|");
  return computeSha256Hex(canonicalPayload);
}

export function buildCertificateVerifyUrl(certificateId: string): string {
  return `${CERTIFICATE_VERIFY_BASE_URL}/${encodeURIComponent(certificateId)}`;
}

export interface ParsedCertificateId {
  raw: string;
  valid: boolean;
  year: number | null;
  token: string | null;
  milestoneLevel: number;
  isDemo: boolean;
}

export function parseCertificateId(rawId: string): ParsedCertificateId {
  const cleaned = decodeURIComponent(rawId || "").trim().toUpperCase();
  const match = /^CS-BLR-(202\d)-([A-Z0-9]{4,10})(?:-L([1-9]))?$/.exec(cleaned);
  if (!match) {
    return {
      raw: cleaned,
      valid: false,
      year: null,
      token: null,
      milestoneLevel: 1,
      isDemo: false,
    };
  }
  const year = Number(match[1]);
  const token = match[2];
  const milestoneLevel = match[3] ? Number(match[3]) : 1;
  return {
    raw: cleaned,
    valid: true,
    year,
    token,
    milestoneLevel,
    isDemo: token === "DEMO",
  };
}

export function computeSeasonCountdown2026(now: Date = new Date()): {
  days: number;
  hours: number;
  minutes: number;
  isClosed: boolean;
} {
  const deadline = new Date("2026-12-31T23:59:59+05:30").getTime();
  const diff = deadline - now.getTime();
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, isClosed: true };
  }
  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return { days, hours, minutes, isClosed: false };
}

export function getStateCivicTierTitle(
  verifiedFixes: number,
  rank?: number | null
): string {
  if (typeof rank === "number" && rank >= 1 && rank <= 5) {
    return "Civic Vanguard Laureate";
  }
  const safeFixes = Math.max(0, Math.floor(verifiedFixes || 0));
  if (safeFixes >= 30) return "Bengaluru Civic Vanguard";
  if (safeFixes >= 15) return "Infrastructure Audit Guardian";
  if (safeFixes >= 5) return "Bengaluru Urban Sentinel";
  if (safeFixes >= 1) return "Ward Scout";
  return "Civic Contributor";
}

export function evaluateStateCivicBadges(
  verifiedFixes: number,
  citywideRank: number | null
): StateCivicBadge[] {
  const safeFixes = Math.max(0, Math.floor(verifiedFixes || 0));
  const isTop5 =
    typeof citywideRank === "number" && citywideRank >= 1 && citywideRank <= 5;

  return STATE_CIVIC_BADGE_DEFINITIONS.map((def) => {
    if (def.top5Only) {
      return {
        ...def,
        unlocked: isTop5,
        fixesRemaining: 0,
      };
    }
    const required = def.minVerifiedFixes ?? 1;
    const unlocked = safeFixes >= required;
    return {
      ...def,
      unlocked,
      fixesRemaining: Math.max(0, required - safeFixes),
    };
  });
}

export function buildCertificateMilestones(
  citizenName: string,
  verifiedFixes: number,
  year: number = ANNUAL_CM_SEASON_YEAR,
  userUid?: string | null
): CertificateMilestone[] {
  const safeFixes = Math.max(0, Math.floor(verifiedFixes || 0));
  const milestoneSpecs = [
    {
      level: 1,
      requiredFixes: 5,
      title: "Civic Merit Certificate (Level 1: 5 Verified Fixes)",
      subtitle: "Bengaluru Urban Sentinel Citation · Independent Civic Ledger 2026",
    },
    {
      level: 2,
      requiredFixes: 10,
      title: "Civic Merit Certificate (Level 2: 10 Verified Fixes)",
      subtitle: "Distinguished Ward Stewardship Citation · Independent Civic Ledger 2026",
    },
    {
      level: 3,
      requiredFixes: 15,
      title: "Civic Merit Certificate (Level 3: 15 Verified Fixes)",
      subtitle: "Infrastructure Audit Guardian Citation · Independent Civic Ledger 2026",
    },
    {
      level: 4,
      requiredFixes: 20,
      title: "Civic Merit Certificate (Level 4: 20 Verified Fixes)",
      subtitle: "Bengaluru Civic Vanguard Citation · Independent Civic Ledger 2026",
    },
  ];

  const visibleSpecs =
    safeFixes >= 15 ? milestoneSpecs : milestoneSpecs.slice(0, 3);

  return visibleSpecs.map((spec) => {
    const unlocked = safeFixes >= spec.requiredFixes;
    const progressPercent = Math.min(
      100,
      Math.round(
        (Math.min(safeFixes, spec.requiredFixes) / spec.requiredFixes) * 100
      )
    );
    return {
      ...spec,
      unlocked,
      completedFixes: Math.min(safeFixes, spec.requiredFixes),
      progressPercent,
      certificateId: generateCertificateId(
        citizenName,
        spec.level,
        year,
        userUid
      ),
    };
  });
}

export function computeCitizenHonorsSnapshot(input: {
  citizenName: string;
  userUid?: string | null;
  ward?: string;
  meritPoints: number;
  verifiedFixes: number;
  citywideRank?: number;
  top5ThresholdPoints?: number;
}): CitizenHonorsSnapshot {
  const meritPoints = Math.max(0, Math.floor(input.meritPoints || 0));
  const verifiedFixes = Math.max(0, Math.floor(input.verifiedFixes || 0));
  const top5ThresholdPoints =
    input.top5ThresholdPoints ?? ANNUAL_CM_TOP_5_THRESHOLD_POINTS;

  const computedRank =
    typeof input.citywideRank === "number" && input.citywideRank >= 1
      ? Math.floor(input.citywideRank)
      : meritPoints >= 1420
        ? 1
        : meritPoints >= 1285
          ? 2
          : meritPoints >= 1200
            ? 3
            : meritPoints >= 1145
              ? 4
              : meritPoints >= top5ThresholdPoints
                ? 5
                : meritPoints >= 920
                  ? 8
                  : meritPoints >= 750
                    ? 12
                    : meritPoints >= 400
                      ? 24
                      : meritPoints >= 100
                        ? 48
                        : 120;

  const isTop5Finalist =
    computedRank <= 5 || meritPoints >= top5ThresholdPoints;
  const pointsToTop5 = isTop5Finalist
    ? 0
    : Math.max(0, top5ThresholdPoints - meritPoints);
  const top5ProgressPercent = isTop5Finalist
    ? 100
    : Math.min(99, Math.round((meritPoints / top5ThresholdPoints) * 100));

  const badges = evaluateStateCivicBadges(verifiedFixes, computedRank);
  const unlockedBadges = badges.filter((b) => b.unlocked);
  const currentBadge =
    unlockedBadges[unlockedBadges.length - 1] ?? badges[0];
  const certificates = buildCertificateMilestones(
    input.citizenName,
    verifiedFixes,
    ANNUAL_CM_SEASON_YEAR,
    input.userUid
  );

  return {
    citizenName: input.citizenName.trim() || "Bengaluru Citizen Steward",
    ward: input.ward?.trim() || "Indiranagar",
    meritPoints,
    verifiedFixes,
    citywideRank: computedRank,
    top5ThresholdPoints,
    pointsToTop5,
    top5ProgressPercent,
    isTop5Finalist,
    currentBadge,
    badges,
    certificates,
    unlockedCertificateCount: certificates.filter((c) => c.unlocked).length,
  };
}

export function formatCertificateIssueDate(date: Date = new Date()): string {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function buildLinkedInShareText(cert: CivicCertificateData): string {
  const verifyUrl = buildCertificateVerifyUrl(cert.certificateId);
  return `Earned the ${cert.milestoneTitle} (${cert.certificateId}) on CivicSnap AI — Independent Bengaluru Public Infrastructure Ledger for verifying ${cert.verifiedFixes} infrastructure fixes with Gemini AI Confidence Score audits. Verify independent SHA-256 record: ${verifyUrl} #CivicSnapAI #OpenCivicTech #BengaluruCivicVanguard`;
}

export function buildLinkedInAddCertificationUrl(
  cert: CivicCertificateData
): string {
  const verifyUrl = buildCertificateVerifyUrl(cert.certificateId);
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: cert.milestoneTitle,
    organizationName: "CivicSnap AI (Independent Open Civic Prototype)",
    issueYear: String(ANNUAL_CM_SEASON_YEAR),
    issueMonth: String(new Date().getMonth() + 1),
    certId: cert.certificateId,
    certUrl: verifyUrl,
  });
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}

export function buildLinkedInShareUrl(cert: CivicCertificateData): string {
  const text = buildLinkedInShareText(cert);
  return `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Generates a standalone print/PDF-ready HTML document for instant client-side
 * 2026 certificate download with SHA-256 cryptographic digest and zero government claims.
 */
export function buildCertificateHtmlDocument(cert: CivicCertificateData): string {
  const safeName = escapeHtml(cert.recipientName);
  const safeWard = escapeHtml(cert.ward);
  const safeId = escapeHtml(cert.certificateId);
  const safeDate = escapeHtml(cert.issuedDate);
  const safeLevel = escapeHtml(cert.milestoneTitle);
  const verifyUrl = escapeHtml(buildCertificateVerifyUrl(cert.certificateId));
  const sha256 = escapeHtml(
    cert.sha256Hash || computeCertificateSha256(cert)
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(CERTIFICATE_HEADER_TITLE)} — ${safeName} (${safeId})</title>
  <style>
    @page { size: landscape; margin: 12mm; }
    body { margin: 0; padding: 32px; background: #f8fafc; font-family: Georgia, "Times New Roman", serif; color: #0f172a; display: flex; justify-content: center; }
    .frame { width: 960px; background: #ffffff; border: 6px double #b45309; padding: 38px 48px; box-sizing: border-box; position: relative; box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08); }
    .inner { border: 1.5px solid #e2e8f0; padding: 32px 40px; text-align: center; }
    .eyebrow { font-family: system-ui, -apple-system, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #1d4ed8; text-transform: uppercase; }
    .title { font-size: 28px; font-weight: 700; letter-spacing: 0.6px; color: #0f172a; margin: 14px 0 8px; }
    .sub { font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #b45309; font-weight: 600; margin-bottom: 22px; }
    .present { font-size: 15px; color: #475569; margin: 0; }
    .recipient { font-size: 32px; font-weight: 700; color: #1e3a8a; border-bottom: 2px solid #f59e0b; display: inline-block; padding: 6px 28px; margin: 12px 0 18px; }
    .body { font-family: system-ui, -apple-system, sans-serif; font-size: 14px; line-height: 1.75; color: #334155; max-width: 720px; margin: 0 auto 24px; }
    .hash-box { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 11px; color: #0f172a; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; margin: 0 auto 24px; max-width: 760px; word-break: break-all; }
    .footer { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #e2e8f0; padding-top: 20px; font-family: system-ui, -apple-system, sans-serif; text-align: left; }
    .meta { font-size: 12px; color: #475569; line-height: 1.6; }
    .meta strong { color: #0f172a; font-family: ui-monospace, monospace; }
    .seal { width: 120px; height: 120px; border-radius: 999px; border: 4px double #b45309; background: radial-gradient(circle, #fef3c7, #f59e0b); color: #78350f; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; font-weight: 800; font-size: 9px; letter-spacing: 0.6px; text-transform: uppercase; padding: 8px; box-sizing: border-box; }
    .sig { text-align: right; max-width: 240px; }
    .sig-line { font-family: Georgia, serif; font-style: italic; font-size: 18px; color: #1e3a8a; border-bottom: 1.5px solid #94a3b8; padding-bottom: 4px; margin-bottom: 6px; }
    .sig-title { font-size: 12px; font-weight: 700; color: #0f172a; }
    .sig-sub { font-size: 11px; color: #64748b; }
  </style>
</head>
<body>
  <div class="frame">
    <div class="inner">
      <div class="eyebrow">${escapeHtml(CERTIFICATE_RECORD_LABEL)} &bull; BENGALURU 2026</div>
      <h1 class="title">${escapeHtml(CERTIFICATE_HEADER_TITLE)}</h1>
      <div class="sub">${safeLevel}</div>
      <p class="present">This is presented to</p>
      <div class="recipient">${safeName}</div>
      <p class="body">
        in recognition of citizen-led public infrastructure auditing and verifying
        <strong>${cert.verifiedFixes} civic infrastructure fixes</strong> in
        Bengaluru (${safeWard}), validated with Gemini AI Confidence Score audits on the CivicSnap Open Civic Ledger.
      </p>
      <div class="hash-box">
        <strong>SHA-256 Audit Hash:</strong> ${sha256}
      </div>
      <div class="footer">
        <div class="meta">
          <div>Certificate ID: <strong>${safeId}</strong></div>
          <div>Issued Date: <strong>${safeDate}</strong></div>
          <div>Verified Merit Standing: <strong>${cert.meritPoints} Civic Merit Points</strong></div>
          <div>Public Verification: <strong>${verifyUrl}</strong></div>
        </div>
        <div class="seal">
          <span>Open Civic</span>
          <span style="margin-top:4px;">SHA-256 Audit</span>
          <span style="margin-top:2px;font-size:8px;">2026 Prototype</span>
        </div>
        <div class="sig">
          <div class="sig-line">CivicSnap Audit Protocol</div>
          <div class="sig-title">${escapeHtml(CERTIFICATE_RECORD_LABEL)}</div>
          <div class="sig-sub">Independent Citizen Prototype · Not a Government Agency</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
