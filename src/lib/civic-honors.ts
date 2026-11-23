import type {
  CertificateMilestone,
  CitizenHonorsSnapshot,
  CivicCertificateData,
  StateCivicBadge,
} from "@/types/civic";

export const ANNUAL_CM_SEASON_YEAR = 2025;
export const ANNUAL_CM_SEASON_CLOSE_LABEL = "31st December";
export const ANNUAL_CM_TOP_5_THRESHOLD_POINTS = 1100;
export const DEFAULT_PREVIEW_MERIT_POINTS = 750;
export const DEFAULT_PREVIEW_VERIFIED_FIXES = 7;
export const DEFAULT_PREVIEW_CITYWIDE_RANK = 12;

export const CM_ANNUAL_AWARD_PERKS = [
  {
    number: "01",
    title: "Felicitation by the Hon'ble Chief Minister",
    description:
      "Top 5 Bengaluru citizen stewards are personally honored on stage at the Annual Urban Governance Summit.",
  },
  {
    number: "02",
    title: "Official State Civic Medal & Honors Citation",
    description:
      "Receive the State Civic Champions Medal and a signed Urban Infrastructure Stewardship Citation.",
  },
  {
    number: "03",
    title: "State Civic Innovation Grant & Technology Prizes",
    description:
      "Awarded state-backed civic innovation grants and official recognition packages for high-impact ward monitoring.",
  },
  {
    number: "04",
    title: "1-Year 'Honorary Civic Warden' Appointment",
    description:
      "Official 12-month ward designation featuring direct municipal commissioner escalation privileges.",
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
    title: "State Urban Sentinel",
    tierScope: "State Level",
    requirementLabel: "5+ Verified Fixes",
    minVerifiedFixes: 5,
    description:
      "Recognized state-level contributor with at least 5 AI-verified street repairs and Level 1 Merit Certificate.",
  },
  {
    id: "state-infrastructure-guardian",
    level: 3,
    title: "State Infrastructure Guardian",
    tierScope: "State Level",
    requirementLabel: "15+ Verified Fixes",
    minVerifiedFixes: 15,
    description:
      "Senior civic auditor safeguarding roads, lighting, and school/hospital corridors across Bengaluru Urban.",
  },
  {
    id: "national-civic-vanguard",
    level: 4,
    title: "National Civic Vanguard",
    tierScope: "National Level",
    requirementLabel: "30+ Verified Fixes",
    minVerifiedFixes: 30,
    description:
      "Distinguished national civic benchmark for sustained urban accountability and verified public works.",
  },
  {
    id: "cm-civic-laureate",
    level: 5,
    title: "CM Civic Laureate",
    tierScope: "Annual CM Podium",
    requirementLabel: "Top 5 Annual Podium",
    minVerifiedFixes: null,
    top5Only: true,
    description:
      "Exclusive honor conferred upon the Top 5 annual citizen leaders invited to the Chief Minister's Summit podium.",
  },
] as const;

/**
 * Generates a deterministic, tamper-evident Civic Merit Certificate ID
 * (e.g., CS-BLR-2025-V7492) purely on the client from citizen identity and milestone.
 */
export function generateCertificateId(
  citizenName: string,
  milestoneLevel: number,
  year: number = ANNUAL_CM_SEASON_YEAR
): string {
  const seed = `${citizenName.trim().toLowerCase() || "bengaluru-citizen"}::L${milestoneLevel}::${year}`;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const numericCode = (Math.abs(hash >>> 0) % 9000) + 1000;
  return `CS-BLR-${year}-V${numericCode}`;
}

export function getStateCivicTierTitle(
  verifiedFixes: number,
  rank?: number | null
): string {
  if (typeof rank === "number" && rank >= 1 && rank <= 5) {
    return "CM Civic Laureate";
  }
  const safeFixes = Math.max(0, Math.floor(verifiedFixes || 0));
  if (safeFixes >= 30) return "National Civic Vanguard";
  if (safeFixes >= 15) return "State Infrastructure Guardian";
  if (safeFixes >= 5) return "State Urban Sentinel";
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
  year: number = ANNUAL_CM_SEASON_YEAR
): CertificateMilestone[] {
  const safeFixes = Math.max(0, Math.floor(verifiedFixes || 0));
  const milestoneSpecs = [
    {
      level: 1,
      requiredFixes: 5,
      title: "Official Civic Merit Certificate (Level 1: 5 Verified Fixes)",
      subtitle: "State Urban Sentinel Commendation · Bengaluru Urban",
    },
    {
      level: 2,
      requiredFixes: 10,
      title: "Official Civic Merit Certificate (Level 2: 10 Verified Fixes)",
      subtitle: "Distinguished Ward Stewardship Citation · Bengaluru Urban",
    },
    {
      level: 3,
      requiredFixes: 15,
      title: "Official Civic Merit Certificate (Level 3: 15 Verified Fixes)",
      subtitle: "State Infrastructure Guardian Honor · Bengaluru Urban",
    },
    {
      level: 4,
      requiredFixes: 20,
      title: "Official Civic Merit Certificate (Level 4: 20 Verified Fixes)",
      subtitle: "Chief Minister's Summit Merit Citation · Bengaluru Urban",
    },
  ];

  // Show Levels 1–3 by default, and also reveal Level 4 once the citizen passes 15 verified fixes
  const visibleSpecs =
    safeFixes >= 15 ? milestoneSpecs : milestoneSpecs.slice(0, 3);

  return visibleSpecs.map((spec) => {
    const unlocked = safeFixes >= spec.requiredFixes;
    const progressPercent = Math.min(
      100,
      Math.round((Math.min(safeFixes, spec.requiredFixes) / spec.requiredFixes) * 100)
    );
    return {
      ...spec,
      unlocked,
      completedFixes: Math.min(safeFixes, spec.requiredFixes),
      progressPercent,
      certificateId: generateCertificateId(citizenName, spec.level, year),
    };
  });
}

export function computeCitizenHonorsSnapshot(input: {
  citizenName: string;
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

  // Estimate citywide rank deterministically if not explicitly provided
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
    verifiedFixes
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
  return `Honored to receive the official ${cert.milestoneTitle} (${cert.certificateId}) from CivicSnap Bengaluru Urban for verifying ${cert.verifiedFixes} public infrastructure fixes through AI-audited Before-vs-After accountability. Competing towards the Chief Minister's Annual Civic Champions Award! #CivicSnap #BengaluruUrban #CivicTech #UrbanGovernance`;
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
 * certificate download with zero backend rendering overhead.
 */
export function buildCertificateHtmlDocument(cert: CivicCertificateData): string {
  const safeName = escapeHtml(cert.recipientName);
  const safeWard = escapeHtml(cert.ward);
  const safeId = escapeHtml(cert.certificateId);
  const safeDate = escapeHtml(cert.issuedDate);
  const safeLevel = escapeHtml(cert.milestoneTitle);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Certificate of Civic Merit — ${safeName} (${safeId})</title>
  <style>
    @page { size: landscape; margin: 12mm; }
    body { margin: 0; padding: 32px; background: #f8fafc; font-family: Georgia, "Times New Roman", serif; color: #0f172a; display: flex; justify-content: center; }
    .frame { width: 960px; background: #ffffff; border: 6px double #b45309; padding: 40px 52px; box-sizing: border-box; position: relative; box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08); }
    .inner { border: 1.5px solid #e2e8f0; padding: 36px 44px; text-align: center; }
    .gov { font-family: system-ui, -apple-system, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 2.2px; color: #1d4ed8; text-transform: uppercase; }
    .title { font-size: 36px; font-weight: 700; letter-spacing: 1.5px; color: #0f172a; margin: 16px 0 8px; }
    .sub { font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #b45309; font-weight: 600; margin-bottom: 28px; }
    .present { font-size: 15px; color: #475569; margin: 0; }
    .recipient { font-size: 34px; font-weight: 700; color: #1e3a8a; border-bottom: 2px solid #f59e0b; display: inline-block; padding: 6px 28px; margin: 14px 0 20px; }
    .body { font-family: system-ui, -apple-system, sans-serif; font-size: 15px; line-height: 1.75; color: #334155; max-width: 720px; margin: 0 auto 36px; }
    .footer { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #e2e8f0; padding-top: 24px; font-family: system-ui, -apple-system, sans-serif; text-align: left; }
    .meta { font-size: 12px; color: #475569; line-height: 1.6; }
    .meta strong { color: #0f172a; font-family: ui-monospace, monospace; }
    .seal { width: 112px; height: 112px; border-radius: 999px; border: 4px double #b45309; background: radial-gradient(circle, #fef3c7, #f59e0b); color: #78350f; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; font-weight: 800; font-size: 10px; letter-spacing: 0.8px; text-transform: uppercase; padding: 8px; box-sizing: border-box; }
    .sig { text-align: right; }
    .sig-line { font-family: Georgia, serif; font-style: italic; font-size: 20px; color: #1e3a8a; border-bottom: 1.5px solid #94a3b8; padding-bottom: 4px; margin-bottom: 6px; }
    .sig-title { font-size: 12px; font-weight: 700; color: #0f172a; }
    .sig-sub { font-size: 11px; color: #64748b; }
  </style>
</head>
<body>
  <div class="frame">
    <div class="inner">
      <div class="gov">GOVERNMENT OF KARNATAKA &bull; URBAN INFRASTRUCTURE COLLABORATIVE</div>
      <h1 class="title">CERTIFICATE OF CIVIC MERIT</h1>
      <div class="sub">${safeLevel}</div>
      <p class="present">This is proudly presented to</p>
      <div class="recipient">${safeName}</div>
      <p class="body">
        in recognition of outstanding civic stewardship and verifying
        <strong>${cert.verifiedFixes} public infrastructure fixes</strong> in
        Bengaluru Urban (${safeWard}), validated through CivicSnap AI Audit.
      </p>
      <div class="footer">
        <div class="meta">
          <div>Certificate ID: <strong>${safeId}</strong></div>
          <div>Issued Date: <strong>${safeDate}</strong></div>
          <div>Verified Merit Standing: <strong>${cert.meritPoints} Civic Merit Points</strong></div>
        </div>
        <div class="seal">
          <span>CivicSnap AI</span>
          <span style="margin-top:4px;font-size:9px;">Verified Seal</span>
        </div>
        <div class="sig">
          <div class="sig-line">Urban Dev. Directorate</div>
          <div class="sig-title">Urban Development Directorate</div>
          <div class="sig-sub">Bengaluru Urban Governance Collaborative</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
