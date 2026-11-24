import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAuthHref,
  computeAdminReportStats,
  computeCivicPointsDelta,
  computeDashboardMetrics,
  computeReportCivicPoints,
  deriveLeaderboard,
  filterAndSortIssues,
  filterIssuesByDateRange,
  getCivicLevelBadge,
  getPendingAgeLabel,
  isAuthorizedAdminEmail,
  MAX_PHOTO_BYTES,
  paginateIssues,
  parseAdminEmailList,
  parseFirestoreSubmitError,
  sanitizeRedirectPath,
  validateAuthInput,
  validatePhotoFileMeta,
} from "./civic-logic";
import {
  ANNUAL_CM_SEASON_YEAR,
  ANNUAL_CM_SUMMIT_TITLE,
  buildCertificateHtmlDocument,
  buildCertificateMilestones,
  buildCertificateVerifyUrl,
  buildLinkedInAddCertificationUrl,
  buildLinkedInShareUrl,
  CERTIFICATE_HEADER_TITLE,
  CERTIFICATE_RECORD_LABEL,
  CM_ANNUAL_AWARD_PERKS,
  computeCertificateSha256,
  computeCitizenHonorsSnapshot,
  computeSeasonCountdown2026,
  evaluateStateCivicBadges,
  generateCertificateId,
  parseCertificateId,
} from "./civic-honors";
import {
  computeHammingDistance,
  computeSha256Hex,
  evaluateDailyLimit,
  evaluateExifFraudFlags,
  evaluateLocationCooldown,
  haversineDistanceMeters,
  isDuplicateImageHash,
} from "./anti-spam";
import { DEMO_ISSUES, DEMO_PROFILES, DEMO_REFERENCE_DATE } from "./demo-data";
import {
  buildBeforeAfterVerificationPrompt,
  buildHinglishVoicePrompt,
  buildPhotoAuditPrompt,
  clampSocialImpactScore,
  convertHinglishToDemoReport,
  evaluateVerificationOutcome,
  generateDemoPhotoAudit,
  getPriorityTierFromScore,
  isSafeDisplayImageUrl,
  normalizeAiCategory,
  parseVerificationVerdict,
  validateSafeImageSourceUrl,
} from "./ai-civic-helpers";
import {
  BENGALURU_PILOT_WARDS,
  buildGoogleMapsUrl,
  detectHighPriorityZone,
  findNearestBengaluruWard,
  formatNominatimAddress,
  MANUAL_WARD_OPTION,
  matchBengaluruWardFromText,
  REPORT_WARD_DROPDOWN_OPTIONS,
} from "./location-helpers";
import {
  BENGALURU_FEED_ISSUES,
  buildCitizenStarsLeaderboard,
  CITIZEN_STARS_TOP_10,
  filterBengaluruFeed,
  generateQrMatrix,
  JUDGE_DEMO_VERIFICATIONS,
  WARD_WARS_STANDINGS,
} from "./bengaluru-feed-data";
import type { PublicIssueRecord } from "@/types/civic";

test("filterAndSortIssues filters by category, status, ward, and search query", () => {
  const result = filterAndSortIssues(DEMO_ISSUES, {
    search: "sidewalk",
    category: "waste",
    status: "in_progress",
    area: "Koramangala",
    sort: "newest",
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.id, "CS-DEMO-102");
});

test("filterAndSortIssues sorts oldest and newest correctly", () => {
  const newest = filterAndSortIssues(DEMO_ISSUES, {
    search: "",
    category: "all",
    status: "all",
    area: "all",
    sort: "newest",
  });
  const oldest = filterAndSortIssues(DEMO_ISSUES, {
    search: "",
    category: "all",
    status: "all",
    area: "all",
    sort: "oldest",
  });

  assert.equal(newest[0]?.id, "CS-DEMO-106");
  assert.equal(oldest[0]?.id, "CS-DEMO-105");
});

test("paginateIssues returns accurate slice and remaining counts", () => {
  const page = paginateIssues(DEMO_ISSUES, 4);
  assert.equal(page.items.length, 4);
  assert.equal(page.hasMore, true);
  assert.equal(page.remaining, DEMO_ISSUES.length - 4);
});

test("getPendingAgeLabel returns neutral age for pending/in-progress and null for resolved", () => {
  assert.equal(
    getPendingAgeLabel(
      "pending",
      "2026-11-18T09:15:00.000Z",
      DEMO_REFERENCE_DATE
    ),
    "Pending for 3 days"
  );
  assert.equal(
    getPendingAgeLabel(
      "resolved",
      "2026-11-05T10:20:00.000Z",
      DEMO_REFERENCE_DATE
    ),
    null
  );
});

test("computeDashboardMetrics returns zeros for empty input and exact aggregates for demo data", () => {
  const emptyMetrics = computeDashboardMetrics([]);
  assert.equal(emptyMetrics.total, 0);
  assert.equal(emptyMetrics.pending, 0);
  assert.equal(emptyMetrics.resolved, 0);

  const demoMetrics = computeDashboardMetrics(DEMO_ISSUES);
  assert.equal(demoMetrics.total, 6);
  assert.equal(demoMetrics.pending, 3);
  assert.equal(demoMetrics.inProgress, 1);
  assert.equal(demoMetrics.resolved, 2);
});

test("filterIssuesByDateRange filters to recent 7-day window accurately", () => {
  const last7 = filterIssuesByDateRange(DEMO_ISSUES, "7d", DEMO_REFERENCE_DATE);
  assert.equal(last7.length, 4);
  assert.deepEqual(
    last7.map((item) => item.id).sort(),
    ["CS-DEMO-101", "CS-DEMO-102", "CS-DEMO-103", "CS-DEMO-106"]
  );
});

test("deriveLeaderboard awards 0 pts on pending/accepted and +50 pts strictly on verified resolved reports while respecting opt-in", () => {
  const extraIssues: PublicIssueRecord[] = [
    ...DEMO_ISSUES,
    // Duplicate of an existing report ID should not double-count
    DEMO_ISSUES[0],
    // Unreviewed report should earn 0 points
    {
      ...DEMO_ISSUES[0],
      id: "CS-DEMO-901",
      reviewState: "unreviewed",
      reporterId: "demo-u2",
    },
    // Duplicate reviewState should earn 0 points
    {
      ...DEMO_ISSUES[0],
      id: "CS-DEMO-902",
      reviewState: "duplicate",
      duplicateOfId: "CS-DEMO-101",
      reporterId: "demo-u2",
    },
    // Rejected report should earn 0 points
    {
      ...DEMO_ISSUES[0],
      id: "CS-DEMO-903",
      reviewState: "rejected",
      reporterId: "demo-u3",
    },
  ];

  const board = deriveLeaderboard(extraIssues, DEMO_PROFILES);

  // demo-u4 opted out, so must NOT appear publicly
  assert.equal(
    board.some((entry) => entry.alias === "PrivateResident"),
    false
  );

  // demo-u3 (StreetWatch04) has 1 resolved accepted report => 50 pts (rank 1)
  assert.equal(board[0].alias, "StreetWatch04");
  assert.equal(board[0].resolvedReports, 1);
  assert.equal(board[0].points, 50);
  assert.equal(board[0].rank, 1);

  // demo-u1 only has pending/unverified reports => 0 pts, excluded from points rankings
  assert.equal(
    board.some((entry) => entry.alias === "CommuterNorth"),
    false
  );
});

test("computeReportCivicPoints & computeCivicPointsDelta award 0 on submit/accept and +50 strictly on Verified + Resolved + AI Confidence >= 90%", () => {
  assert.equal(computeReportCivicPoints("pending", "unreviewed"), 0);
  assert.equal(computeReportCivicPoints("pending", "accepted"), 0);
  assert.equal(computeReportCivicPoints("in_progress", "accepted"), 0);
  // Resolved without verified status => 0
  assert.equal(
    computeReportCivicPoints("resolved", "accepted", null, {
      verificationStatus: "pending",
      aiConfidenceScore: 95,
    }),
    0
  );
  // Resolved + verified but AI confidence < 90 => 0
  assert.equal(
    computeReportCivicPoints("resolved", "accepted", null, {
      verificationStatus: "verified",
      aiConfidenceScore: 85,
    }),
    0
  );
  // Resolved + verified + AI confidence >= 90 => 50
  assert.equal(
    computeReportCivicPoints("resolved", "accepted", null, {
      verificationStatus: "verified",
      aiConfidenceScore: 92,
    }),
    50
  );
  // Cooldown applied => 0
  assert.equal(
    computeReportCivicPoints("resolved", "accepted", null, {
      verificationStatus: "verified",
      aiConfidenceScore: 95,
      locationCooldownApplied: true,
    }),
    0
  );
  // Duplicate => 0
  assert.equal(
    computeReportCivicPoints("resolved", "duplicate", "CS-1", {
      verificationStatus: "verified",
      aiConfidenceScore: 98,
    }),
    0
  );

  // Transition unreviewed (0) -> accepted pending (0) => 0 delta
  assert.equal(computeCivicPointsDelta(0, "pending", "accepted"), 0);
  // Transition accepted (0) -> verified resolved >= 90% => +50
  assert.equal(
    computeCivicPointsDelta(0, "resolved", "accepted", null, {
      verificationStatus: "verified",
      aiConfidenceScore: 94,
    }),
    50
  );
  // Saving verified resolved again => 0 delta (idempotent)
  assert.equal(
    computeCivicPointsDelta(50, "resolved", "accepted", null, {
      verificationStatus: "verified",
      aiConfidenceScore: 94,
    }),
    0
  );
  // Reversing a verified resolved report to rejected => -50 delta
  assert.equal(computeCivicPointsDelta(50, "pending", "rejected"), -50);
});

test("getCivicLevelBadge maps 0-50 Bronze (Street Watcher), 51-200 Silver (Eco Warrior), and 200+ Gold (City Guardian)", () => {
  const b0 = getCivicLevelBadge(0);
  assert.equal(b0.tier, "bronze");
  assert.equal(b0.rankTitle, "Street Watcher");
  assert.equal(b0.nextTierPoints, 51);

  const b50 = getCivicLevelBadge(50);
  assert.equal(b50.tier, "bronze");
  assert.equal(b50.rankTitle, "Street Watcher");
  assert.equal(b50.pointsToNext, 1);

  const s51 = getCivicLevelBadge(51);
  assert.equal(s51.tier, "silver");
  assert.equal(s51.rankTitle, "Eco Warrior");
  assert.equal(s51.nextTierPoints, 201);

  const s200 = getCivicLevelBadge(200);
  assert.equal(s200.tier, "silver");
  assert.equal(s200.rankTitle, "Eco Warrior");
  assert.equal(s200.pointsToNext, 1);

  const g201 = getCivicLevelBadge(201);
  assert.equal(g201.tier, "gold");
  assert.equal(g201.rankTitle, "City Guardian");
  assert.equal(g201.nextTierLabel, null);
  assert.equal(g201.progressPercent, 100);
});

test("isAuthorizedAdminEmail respects NEXT_PUBLIC_ADMIN_EMAILS and falls back to bootstrap admins", () => {
  assert.equal(isAuthorizedAdminEmail("bipulmaurya42004@gmail.com", ""), true);
  assert.equal(isAuthorizedAdminEmail("VEDMINDSET@GMAIL.COM", ""), true);
  assert.equal(isAuthorizedAdminEmail("  vedmindset@gmail.com  ", ""), true);
  assert.equal(isAuthorizedAdminEmail("citizen@example.com", ""), false);
  assert.equal(isAuthorizedAdminEmail(null, ""), false);

  // Explicit NEXT_PUBLIC_ADMIN_EMAILS override
  const customEnv = "staff1@civicsnap.in,  LEAD.AUDIT@CIVICSNAP.IN ";
  assert.deepEqual(parseAdminEmailList(customEnv), [
    "staff1@civicsnap.in",
    "lead.audit@civicsnap.in",
  ]);
  assert.equal(isAuthorizedAdminEmail("lead.audit@civicsnap.in", customEnv), true);
  assert.equal(isAuthorizedAdminEmail("citizen@example.com", customEnv), false);
});

test("computeAdminReportStats calculates Total, Pending, In Progress, and Resolved counts", () => {
  const stats = computeAdminReportStats([
    { status: "pending" },
    { status: "pending" },
    { status: "in_progress" },
    { status: "resolved" },
  ]);
  assert.deepEqual(stats, {
    total: 4,
    pending: 2,
    inProgress: 1,
    resolved: 1,
  });
});

test("Bengaluru Civic Vanguard 2026 snapshot, 5-tier badges, SHA-256 tamper-evident IDs, verification parser, LinkedIn URLs, and compliant HTML export work deterministically", () => {
  assert.equal(ANNUAL_CM_SEASON_YEAR, 2026);
  assert.equal(
    ANNUAL_CM_SUMMIT_TITLE,
    "CivicSnap Independent Community Civic Audit Cycle 2026"
  );
  assert.equal(CM_ANNUAL_AWARD_PERKS.length, 4);

  // Guest / Demo sample ID strictly matches CS-BLR-2026-DEMO
  const demoId = generateCertificateId("Aarav Sharma", 1, 2026);
  assert.equal(demoId, "CS-BLR-2026-DEMO");

  // Signed-in user ID strictly matches CS-BLR-2026-${UID6}
  const uidCertL1 = generateCertificateId("Priya Nair", 1, 2026, "ab12cd99999");
  const uidCertL2 = generateCertificateId("Priya Nair", 2, 2026, "ab12cd99999");
  assert.equal(uidCertL1, "CS-BLR-2026-AB12CD");
  assert.equal(uidCertL2, "CS-BLR-2026-AB12CD-L2");

  // Tamper-evident parser and public verification URL builder
  assert.equal(
    buildCertificateVerifyUrl(uidCertL1),
    "https://civicsnap-ai.vercel.app/verify/CS-BLR-2026-AB12CD"
  );
  const parsedValid = parseCertificateId("cs-blr-2026-ab12cd-l2");
  assert.equal(parsedValid.valid, true);
  assert.equal(parsedValid.year, 2026);
  assert.equal(parsedValid.token, "AB12CD");
  assert.equal(parsedValid.milestoneLevel, 2);
  assert.equal(parsedValid.isDemo, false);

  const parsedDemo = parseCertificateId("CS-BLR-2026-DEMO");
  assert.equal(parsedDemo.valid, true);
  assert.equal(parsedDemo.isDemo, true);

  assert.equal(parseCertificateId("INVALID-CERT-999").valid, false);

  // 2026 Season Countdown
  const countdownBefore = computeSeasonCountdown2026(new Date("2026-11-23T12:00:00+05:30"));
  assert.equal(countdownBefore.isClosed, false);
  assert.ok(countdownBefore.days >= 38);

  const countdownAfter = computeSeasonCountdown2026(new Date("2027-01-02T00:00:00+05:30"));
  assert.equal(countdownAfter.isClosed, true);
  assert.equal(countdownAfter.days, 0);

  const snapshot = computeCitizenHonorsSnapshot({
    citizenName: "Aarav Sharma",
    ward: "Indiranagar",
    meritPoints: 750,
    verifiedFixes: 7,
    citywideRank: 12,
  });
  assert.equal(snapshot.meritPoints, 750);
  assert.equal(snapshot.citywideRank, 12);
  assert.equal(snapshot.pointsToTop5, 350);
  assert.equal(snapshot.isTop5Finalist, false);
  assert.equal(snapshot.currentBadge.title, "Bengaluru Urban Sentinel");
  assert.equal(snapshot.unlockedCertificateCount, 1);

  const badges = evaluateStateCivicBadges(7, 12);
  assert.equal(badges.length, 5);
  assert.equal(badges[0].unlocked, true); // Ward Scout
  assert.equal(badges[1].unlocked, true); // Bengaluru Urban Sentinel
  assert.equal(badges[2].unlocked, false); // Infrastructure Audit Guardian
  assert.equal(badges[2].fixesRemaining, 8);
  assert.equal(badges[4].unlocked, false); // Civic Vanguard Laureate (Top 5 only)

  const top5Badges = evaluateStateCivicBadges(28, 2);
  assert.equal(top5Badges[4].unlocked, true);

  const milestones = buildCertificateMilestones("Aarav Sharma", 7, 2026);
  assert.equal(milestones[0].unlocked, true);
  assert.equal(milestones[0].certificateId, "CS-BLR-2026-DEMO");
  assert.equal(milestones[1].unlocked, false);
  assert.equal(milestones[1].completedFixes, 7);

  const sampleCert = {
    recipientName: "Aarav Sharma",
    ward: "Indiranagar",
    verifiedFixes: 7,
    milestoneLevel: 1,
    milestoneTitle: "Civic Merit Certificate (Level 1: 5 Verified Fixes)",
    certificateId: demoId,
    issuedDate: "23 November 2026",
    meritPoints: 750,
  };
  const sha = computeCertificateSha256(sampleCert);
  assert.match(sha, /^[0-9a-f]{64}$/);
  assert.equal(sha, computeCertificateSha256(sampleCert));

  const linkedInUrl = buildLinkedInShareUrl(sampleCert);
  assert.match(linkedInUrl, /^https:\/\/www\.linkedin\.com\/feed\/\?shareActive=true&text=/);
  assert.ok(decodeURIComponent(linkedInUrl).includes(demoId));

  const addCertUrl = buildLinkedInAddCertificationUrl(sampleCert);
  assert.match(addCertUrl, /^https:\/\/www\.linkedin\.com\/profile\/add\?/);
  assert.ok(addCertUrl.includes("certId=CS-BLR-2026-DEMO"));
  assert.ok(addCertUrl.includes("issueYear=2026"));

  const html = buildCertificateHtmlDocument(sampleCert);
  assert.ok(html.includes(CERTIFICATE_HEADER_TITLE));
  assert.ok(html.includes(CERTIFICATE_RECORD_LABEL));
  assert.ok(html.includes(sha));
  assert.ok(html.includes("Aarav Sharma"));
  assert.ok(html.includes(demoId));
  // Strictly ensure zero fabricated government titles appear
  assert.equal(html.toLowerCase().includes("government of karnataka"), false);
  assert.equal(html.toLowerCase().includes("urban dev. directorate"), false);
});

test("validatePhotoFileMeta supports mobile MIME types, AVIF/JFIF/octet-stream, blocks SVG/PDF, and enforces size cap", () => {
  assert.equal(
    validatePhotoFileMeta({ type: "image/jpeg", size: 1024 * 500 }).valid,
    true
  );
  assert.equal(
    validatePhotoFileMeta({ type: "image/heic", size: 1024 * 800 }).valid,
    true
  );
  assert.equal(
    validatePhotoFileMeta({ type: "image/avif", size: 1024 * 600, name: "road.avif" }).valid,
    true
  );
  assert.equal(
    validatePhotoFileMeta({
      type: "application/octet-stream",
      size: 1024 * 450,
      name: "IMG_20261122.jfif",
    }).valid,
    true
  );
  assert.equal(
    validatePhotoFileMeta({
      type: "",
      size: 1024 * 400,
      name: "IMG_20261122.JPG",
    }).valid,
    true
  );
  assert.equal(
    validatePhotoFileMeta({ type: "image/svg+xml", size: 1024, name: "bad.svg" }).valid,
    false
  );
  assert.equal(
    validatePhotoFileMeta({ type: "application/pdf", size: 1024 }).valid,
    false
  );
  assert.equal(
    validatePhotoFileMeta({ type: "image/png", size: MAX_PHOTO_BYTES + 1 })
      .valid,
    false
  );
});

test("parseFirestoreSubmitError maps JSON FirestoreErrorInfo, verification, quota, and timeout errors clearly", () => {
  const unverifiedJson = JSON.stringify({
    error: "Missing or insufficient permissions.",
    operationType: "create",
    path: "reports/CS-1",
  });
  const unverified = parseFirestoreSubmitError(new Error(unverifiedJson), false);
  assert.equal(unverified.needsEmailVerification, true);
  assert.match(unverified.message, /not verified/i);

  const verifiedPerm = parseFirestoreSubmitError(new Error(unverifiedJson), true);
  assert.equal(verifiedPerm.needsEmailVerification, false);
  assert.match(verifiedPerm.message, /permission check rejected/i);

  const quota = parseFirestoreSubmitError(new Error("Quota exceeded."), true);
  assert.equal(quota.isQuotaExceeded, true);

  const timeout = parseFirestoreSubmitError(
    new Error("Firestore request timed out after 20 seconds."),
    true
  );
  assert.match(timeout.message, /network or timeout/i);
});

test("sanitizeRedirectPath blocks external URLs and protocol-relative paths", () => {
  assert.equal(sanitizeRedirectPath("/report"), "/report");
  assert.equal(sanitizeRedirectPath("https://evil.example"), "/profile");
  assert.equal(sanitizeRedirectPath("//evil.example/path"), "/profile");
  assert.equal(sanitizeRedirectPath(null), "/profile");
});

test("validateAuthInput enforces alias, email format, and password rules for signup and login", () => {
  assert.equal(
    validateAuthInput({
      mode: "signup",
      alias: "A",
      email: "user@example.com",
      password: "Password123",
    }).valid,
    false
  );
  assert.equal(
    validateAuthInput({
      mode: "signup",
      alias: "CivicWalker",
      email: "invalid-email",
      password: "Password123",
    }).valid,
    false
  );
  assert.equal(
    validateAuthInput({
      mode: "signup",
      alias: "CivicWalker",
      email: "user@example.com",
      password: "short",
    }).valid,
    false
  );
  assert.equal(
    validateAuthInput({
      mode: "signup",
      alias: "CivicWalker",
      email: "user@example.com",
      password: "Password123",
    }).valid,
    true
  );
  assert.equal(
    validateAuthInput({
      mode: "login",
      email: "user@example.com",
      password: "",
    }).valid,
    false
  );
  assert.equal(
    validateAuthInput({
      mode: "login",
      email: "user@example.com",
      password: "Password123",
    }).valid,
    true
  );
});

test("buildAuthHref preserves safe internal next paths and strips unsafe URLs", () => {
  assert.equal(buildAuthHref("login", "/report"), "/login?next=%2Freport");
  assert.equal(buildAuthHref("signup", "/report"), "/signup?next=%2Freport");
  assert.equal(buildAuthHref("login", "https://evil.example"), "/login");
  assert.equal(buildAuthHref("signup", null), "/signup");
});

test("Hinglish Voice-to-Report normalizes categories, builds exact prompt, and converts demo transcripts", () => {
  assert.equal(normalizeAiCategory("Pothole"), "pothole");
  assert.equal(normalizeAiCategory("Garbage"), "waste");
  assert.equal(normalizeAiCategory("Streetlight"), "streetlight");
  assert.equal(normalizeAiCategory("Drainage"), "other");

  const prompt = buildHinglishVoicePrompt("Sector 4 road par bada gaddha hai");
  assert.match(prompt, /The user said this in Hinglish/i);
  assert.match(prompt, /Pothole\/Garbage\/Streetlight/);

  const pothole = convertHinglishToDemoReport(
    "Sector 4 main road par bahut bada gaddha hai"
  );
  assert.equal(pothole.category, "pothole");
  assert.ok(pothole.title.length >= 5);
  assert.ok(pothole.description.length >= 20);

  const garbage = convertHinglishToDemoReport(
    "Bus stop ke paas kachra ka dher pada hai"
  );
  assert.equal(garbage.category, "waste");

  const light = convertHinglishToDemoReport(
    "Hamari gali ki batti aur streetlight band hai"
  );
  assert.equal(light.category, "streetlight");
});

test("Before-vs-After AI verification parses Verified/Flagged verdicts and maps status/reward outcomes", () => {
  const prompt = buildBeforeAfterVerificationPrompt({
    title: "Deep pothole",
    category: "Pothole",
  });
  assert.match(prompt, /Compare these two images of the same location/i);
  assert.match(prompt, /"Verified" or "Flagged"/);

  const verified = parseVerificationVerdict(
    "Verified",
    "The pothole has been patched with fresh asphalt."
  );
  assert.equal(verified.verdict, "Verified");
  assert.equal(verified.verificationStatus, "verified");
  assert.match(verified.reason, /patched/i);

  const flagged = parseVerificationVerdict(
    "Flagged",
    "The garbage pile is still visible beside the curb."
  );
  assert.equal(flagged.verdict, "Flagged");
  assert.equal(flagged.verificationStatus, "flagged");

  const verifiedOutcome = evaluateVerificationOutcome("Verified", "unreviewed");
  assert.equal(verifiedOutcome.status, "resolved");
  assert.equal(verifiedOutcome.reviewState, "accepted");
  assert.equal(verifiedOutcome.verificationStatus, "verified");
  assert.equal(verifiedOutcome.awardsResolutionBonus, true);

  const flaggedOutcome = evaluateVerificationOutcome("Flagged", "accepted");
  assert.equal(flaggedOutcome.status, "in_progress");
  assert.equal(flaggedOutcome.verificationStatus, "flagged");
  assert.equal(flaggedOutcome.awardsResolutionBonus, false);
});

test("validateSafeImageSourceUrl & isSafeDisplayImageUrl enforce SSRF/XSS allowlists", () => {
  assert.equal(validateSafeImageSourceUrl("/demo/pothole-fixed.jpg").valid, true);
  assert.equal(
    validateSafeImageSourceUrl(
      "https://firebasestorage.googleapis.com/v0/b/civic-snap-9a867.firebasestorage.app/o/after.jpg?alt=media"
    ).valid,
    true
  );

  // Block SSRF, traversal, and unsafe schemes
  assert.equal(validateSafeImageSourceUrl("http://127.0.0.1:3000/secret").valid, false);
  assert.equal(validateSafeImageSourceUrl("http://169.254.169.254/latest/meta-data").valid, false);
  assert.equal(validateSafeImageSourceUrl("https://evil.example/image.jpg").valid, false);
  assert.equal(validateSafeImageSourceUrl("/demo/../etc/passwd").valid, false);
  assert.equal(isSafeDisplayImageUrl("javascript:alert(1)"), false);
  assert.equal(isSafeDisplayImageUrl("data:image/svg+xml;base64,PHN2Zz4="), false);
  assert.equal(isSafeDisplayImageUrl("/demo/pothole-fixed.jpg"), true);
});

test("Engineering Auditing helpers clamp scores, map priority tiers, build audit prompt, and generate deterministic demo audits", () => {
  assert.equal(clampSocialImpactScore(88.6), 89);
  assert.equal(clampSocialImpactScore(150), 100);
  assert.equal(clampSocialImpactScore(-12), 1);
  assert.equal(clampSocialImpactScore("74"), 74);
  assert.equal(clampSocialImpactScore("invalid"), 50);

  assert.equal(getPriorityTierFromScore(86).label, "High Priority");
  assert.equal(getPriorityTierFromScore(60).label, "Medium Priority");
  assert.equal(getPriorityTierFromScore(30).label, "Standard Priority");

  const prompt = buildPhotoAuditPrompt("Sector 4 Market Road");
  assert.match(prompt, /surroundingLandmarks/i);
  assert.match(prompt, /materialEstimate/i);
  assert.match(prompt, /socialImpactScore/i);
  assert.match(prompt, /economicCostOfDelay/i);
  assert.match(prompt, /Sector 4 Market Road/);

  const potholeAudit = generateDemoPhotoAudit("pothole.jpg", "Sector 4");
  assert.equal(potholeAudit.category, "pothole");
  assert.ok(potholeAudit.socialImpactScore >= 1 && potholeAudit.socialImpactScore <= 100);
  assert.ok(potholeAudit.surroundingLandmarks.length > 5);
  assert.ok(potholeAudit.materialEstimate.length > 5);
  assert.ok(potholeAudit.economicCostOfDelay.length > 5);

  const wasteAudit = generateDemoPhotoAudit("garbage_dump.png", "Market");
  assert.equal(wasteAudit.category, "waste");

  const lightAudit = generateDemoPhotoAudit("dark_streetlight.jpg", "North Lane");
  assert.equal(lightAudit.category, "streetlight");
});

test("Bengaluru Pilot Wards, Google Maps URL builder, ward matching, and High Priority Zone detection work accurately", () => {
  assert.deepEqual(Array.from(BENGALURU_PILOT_WARDS), [
    "Indiranagar",
    "Koramangala",
    "HSR Layout",
    "Whitefield",
    "Jayanagar",
    "MG Road",
    "Malleshwaram",
  ]);
  assert.equal(
    REPORT_WARD_DROPDOWN_OPTIONS[REPORT_WARD_DROPDOWN_OPTIONS.length - 1],
    MANUAL_WARD_OPTION
  );
  assert.equal(MANUAL_WARD_OPTION, "Other (Type Manually)");

  // Exact Google Maps search URL format
  assert.equal(
    buildGoogleMapsUrl(12.9784, 77.6408),
    "https://www.google.com/maps/search/?api=1&query=12.9784,77.6408"
  );
  assert.equal(buildGoogleMapsUrl(null, 77.6408), null);
  assert.equal(buildGoogleMapsUrl(95, 77.6408), null);

  // Text and coordinate ward matching
  assert.equal(
    matchBengaluruWardFromText("12th Main Rd, Indiranagar, Bengaluru"),
    "Indiranagar"
  );
  assert.equal(
    matchBengaluruWardFromText("Mahatma Gandhi Rd near Metro"),
    "MG Road"
  );
  assert.equal(matchBengaluruWardFromText("Unknown Village"), null);

  const nearest = findNearestBengaluruWard(12.9784, 77.6408);
  assert.equal(nearest?.ward, "Indiranagar");

  // High Priority Zone detection via keywords AND via coordinates
  const byHospitalKeyword = detectHighPriorityZone({
    title: "Broken road near Manipal Hospital",
    locality: "Whitefield",
  });
  assert.equal(byHospitalKeyword.isHighPriority, true);
  assert.match(byHospitalKeyword.reason ?? "", /Hospital/i);

  const bySchoolKeyword = detectHighPriorityZone({
    description: "Unlit lane outside National Public School gate",
    locality: "Indiranagar",
  });
  assert.equal(bySchoolKeyword.isHighPriority, true);
  assert.match(bySchoolKeyword.reason ?? "", /School/i);

  const byCoordinates = detectHighPriorityZone({
    title: "Deep crater on main road",
    locality: "Indiranagar",
    lat: 12.9789,
    lng: 77.6447,
  });
  assert.equal(byCoordinates.isHighPriority, true);
  assert.match(byCoordinates.reason ?? "", /CMH/i);

  const ordinaryResidential = detectHighPriorityZone({
    title: "Small curb crack on residential lane",
    description: "Minor concrete chip next to park bench",
    locality: "Malleshwaram",
    lat: 13.015,
    lng: 77.55,
  });
  assert.equal(ordinaryResidential.isHighPriority, false);

  // Nominatim address formatting
  const formatted = formatNominatimAddress({
    display_name: "12th Main Road, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka",
    address: {
      road: "12th Main Rd",
      suburb: "Indiranagar",
      city: "Bengaluru",
    },
  });
  assert.equal(formatted.readableAddress, "12th Main Rd, Indiranagar");
  assert.equal(formatted.localityName, "Indiranagar");
  assert.equal(formatted.matchedWard, "Indiranagar");
});

test("Bengaluru Feed filters, upvote sorting, Ward Wars podium, Judge audits, and QR matrix work deterministically", () => {
  assert.equal(BENGALURU_FEED_ISSUES.length, 6);

  const indiranagarOnly = filterBengaluruFeed(BENGALURU_FEED_ISSUES, {
    search: "",
    category: "all",
    status: "all",
    ward: "Indiranagar",
    sort: "newest",
  });
  assert.equal(indiranagarOnly.length, 2);
  assert.equal(indiranagarOnly[0]?.id, "CS-BLR-101");

  const searchHospital = filterBengaluruFeed(BENGALURU_FEED_ISSUES, {
    search: "Chinmaya",
    category: "pothole",
    status: "pending",
    ward: "all",
    sort: "newest",
  });
  assert.equal(searchHospital.length, 1);
  assert.equal(searchHospital[0]?.highPriorityZone, true);

  const mostUpvoted = filterBengaluruFeed(
    BENGALURU_FEED_ISSUES,
    {
      search: "",
      category: "all",
      status: "all",
      ward: "all",
      sort: "most_upvoted",
    },
    { "CS-BLR-101": 40 }
  );
  // CS-BLR-101 has 64 + 40 = 104, beating CS-BLR-104 (87)
  assert.equal(mostUpvoted[0]?.id, "CS-BLR-101");

  // Ward Wars Top 3 podium
  assert.deepEqual(
    WARD_WARS_STANDINGS.slice(0, 3).map((w) => w.ward),
    ["Indiranagar", "HSR Layout", "Koramangala"]
  );

  // Judge Demo verification items include 94.8% verified case and flagged case
  assert.equal(JUDGE_DEMO_VERIFICATIONS[0]?.aiMatchPercent, 94.8);
  assert.ok(
    JUDGE_DEMO_VERIFICATIONS.some((item) => item.aiMatchPercent < 50)
  );

  // Resolved public feed items include Before/After photos and AI Confidence Score >= 90%
  const resolvedItems = BENGALURU_FEED_ISSUES.filter(
    (item) => item.status === "resolved"
  );
  assert.ok(resolvedItems.length >= 2);
  for (const resolved of resolvedItems) {
    assert.ok(resolved.beforeImageUrl);
    assert.ok(resolved.afterImageUrl);
    assert.ok((resolved.aiMatchPercent ?? 0) >= 90);
  }

  // Citizen Stars Top 10 leaderboard merges live opted-in profiles and respects opt-out
  assert.equal(CITIZEN_STARS_TOP_10.length, 10);
  const mergedStars = buildCitizenStarsLeaderboard([
    {
      alias: "BengaluruHeroLive",
      civicPoints: 1650,
      resolvedReportsCount: 33,
      acceptedReportsCount: 38,
      leaderboardOptIn: true,
    },
    {
      alias: "HiddenCitizen",
      civicPoints: 9999,
      leaderboardOptIn: false,
    },
  ]);
  assert.equal(mergedStars.length, 10);
  assert.equal(mergedStars[0]?.alias, "BengaluruHeroLive");
  assert.equal(mergedStars[0]?.rank, 1);
  assert.equal(
    mergedStars.some((entry) => entry.alias === "HiddenCitizen"),
    false
  );

  // Deterministic 9x9 QR grid
  const qrA = generateQrMatrix("CS-TWC20-ABCDEF");
  const qrB = generateQrMatrix("CS-TWC20-ABCDEF");
  assert.equal(qrA.length, 9);
  assert.equal(qrA[0]?.length, 9);
  assert.deepEqual(qrA, qrB);
});

test("Anti-spam layer: SHA-256 NIST vector, Haversine distance, EXIF GPS/24h flags, perceptual hash duplicate detection, daily limit, and 50m/30d cooldown", () => {
  // Standard NIST SHA-256 test vector for "abc"
  assert.equal(
    computeSha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  );

  // Haversine distance checks
  assert.equal(haversineDistanceMeters(12.9784, 77.6408, 12.9784, 77.6408), 0);
  const distFar = haversineDistanceMeters(12.9784, 77.6408, 12.9884, 77.6408);
  assert.ok(distFar > 1000);
  const distNear = haversineDistanceMeters(12.9784, 77.6408, 12.9785, 77.6409);
  assert.ok(distNear < 50);

  // EXIF GPS > 500m & Timestamp > 24h flagging
  const nowMs = new Date("2026-11-24T12:00:00.000Z").getTime();
  const cleanExif = evaluateExifFraudFlags({
    exifLat: 12.97845,
    exifLng: 77.64085,
    exifTimestampMs: new Date("2026-11-24T10:30:00.000Z").getTime(),
    reportedLat: 12.9784,
    reportedLng: 77.6408,
    nowMs,
  });
  assert.equal(cleanExif.needsReview, false);
  assert.equal(cleanExif.reasons.length, 0);

  const flaggedExif = evaluateExifFraudFlags({
    exifLat: 12.99,
    exifLng: 77.6408,
    exifTimestampMs: new Date("2026-11-22T06:00:00.000Z").getTime(),
    reportedLat: 12.9784,
    reportedLng: 77.6408,
    nowMs,
  });
  assert.equal(flaggedExif.needsReview, true);
  assert.equal(flaggedExif.reasons.length, 2);

  // Perceptual 64-bit hash Hamming distance & duplicate detection
  const hashA = "0011223344556677";
  const hashNear = "001122334455667f"; // 1 bit diff
  const hashDiff = "ffeeddccbbaa9988"; // very different
  assert.equal(computeHammingDistance(hashA, hashA), 0);
  assert.equal(computeHammingDistance(hashA, hashNear), 1);
  assert.equal(isDuplicateImageHash(hashA, hashNear), true);
  assert.equal(isDuplicateImageHash(hashA, hashDiff), false);

  // Daily submission cap (max 5/day)
  const todayIso = "2026-11-24T08:00:00.000Z";
  const yesterdayIso = "2026-11-23T08:00:00.000Z";
  assert.equal(
    evaluateDailyLimit([todayIso, todayIso, todayIso, todayIso, yesterdayIso], nowMs)
      .allowed,
    true
  );
  assert.equal(
    evaluateDailyLimit(
      [todayIso, todayIso, todayIso, todayIso, todayIso],
      nowMs
    ).allowed,
    false
  );

  // 50m / 30-day location cooldown
  const withinCooldown = evaluateLocationCooldown(
    [
      {
        id: "CS-OLD-1",
        privateLat: 12.9785,
        privateLng: 77.6409,
        createdAtIso: "2026-11-10T10:00:00.000Z",
      },
    ],
    12.9784,
    77.6408,
    nowMs
  );
  assert.equal(withinCooldown.onCooldown, true);
  assert.equal(withinCooldown.nearestReportId, "CS-OLD-1");

  const outsideCooldown = evaluateLocationCooldown(
    [
      {
        id: "CS-OLD-2",
        privateLat: 12.9785,
        privateLng: 77.6409,
        createdAtIso: "2026-09-01T10:00:00.000Z",
      },
    ],
    12.9784,
    77.6408,
    nowMs
  );
  assert.equal(outsideCooldown.onCooldown, false);

  // Duplicate & Daily Limit submit error parsing
  const dupErr = parseFirestoreSubmitError(
    new Error("This image was already submitted."),
    true
  );
  assert.match(dupErr.message, /already submitted/i);
});



