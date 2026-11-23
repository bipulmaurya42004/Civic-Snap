import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAuthHref,
  canRedeemReward,
  computeAdminReportStats,
  computeCivicPointsDelta,
  computeDashboardMetrics,
  computeReportCivicPoints,
  deriveLeaderboard,
  filterAndSortIssues,
  filterIssuesByDateRange,
  formatCountdownSeconds,
  generateUniqueCouponCode,
  getCivicLevelBadge,
  getPendingAgeLabel,
  isAuthorizedAdminEmail,
  MAX_PHOTO_BYTES,
  paginateIssues,
  parseFirestoreSubmitError,
  REWARD_CATALOG,
  sanitizeRedirectPath,
  validateAuthInput,
  validatePhotoFileMeta,
} from "./civic-logic";
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

test("deriveLeaderboard awards 10 pts for accepted and 25 pts for resolved reports and respects opt-in", () => {
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

  // demo-u1 has 3 pending accepted reports => 30 pts (Bronze / Street Watcher)
  assert.equal(board[0].alias, "CommuterNorth");
  assert.equal(board[0].acceptedReports, 3);
  assert.equal(board[0].resolvedReports, 0);
  assert.equal(board[0].points, 30);
  assert.equal(board[0].levelBadge.tier, "bronze");
  assert.equal(board[0].levelBadge.rankTitle, "Street Watcher");
  assert.equal(board[0].rank, 1);

  // demo-u3 (StreetWatch04) has 1 resolved => 25 pts; demo-u2 (CivicWalker) has 1 in_progress => 10 pts
  assert.equal(board[1].alias, "StreetWatch04");
  assert.equal(board[1].resolvedReports, 1);
  assert.equal(board[1].points, 25);
  assert.equal(board[2].alias, "CivicWalker");
  assert.equal(board[2].points, 10);
});

test("computeReportCivicPoints & computeCivicPointsDelta award 10 for Accepted, 25 for Resolved, and never double-count", () => {
  assert.equal(computeReportCivicPoints("pending", "unreviewed"), 0);
  assert.equal(computeReportCivicPoints("pending", "accepted"), 10);
  assert.equal(computeReportCivicPoints("in_progress", "accepted"), 10);
  assert.equal(computeReportCivicPoints("resolved", "accepted"), 25);
  assert.equal(computeReportCivicPoints("resolved", "duplicate", "CS-1"), 0);

  // Transition unreviewed (0) -> accepted (10) => +10
  assert.equal(computeCivicPointsDelta(0, "pending", "accepted"), 10);
  // Transition accepted (10) -> resolved (25) => +15 (total 25)
  assert.equal(computeCivicPointsDelta(10, "resolved", "accepted"), 15);
  // Saving resolved again => 0 delta (idempotent)
  assert.equal(computeCivicPointsDelta(25, "resolved", "accepted"), 0);
  // Reversing an accepted report to rejected => -10 delta
  assert.equal(computeCivicPointsDelta(10, "pending", "rejected"), -10);
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

test("isAuthorizedAdminEmail allows only the two configured admin emails", () => {
  assert.equal(isAuthorizedAdminEmail("bipulmaurya42004@gmail.com"), true);
  assert.equal(isAuthorizedAdminEmail("VEDMINDSET@GMAIL.COM"), true);
  assert.equal(isAuthorizedAdminEmail("  vedmindset@gmail.com  "), true);
  assert.equal(isAuthorizedAdminEmail("citizen@example.com"), false);
  assert.equal(isAuthorizedAdminEmail(null), false);
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

test("Rewards Store catalog, eligibility, coupon generator, and 15-minute countdown formatter work deterministically", () => {
  assert.equal(REWARD_CATALOG.length, 3);
  assert.deepEqual(
    REWARD_CATALOG.map((r) => [r.title, r.pointsCost, r.terms]),
    [
      ["15% Gym Discount", 100, "Min bill ₹3000"],
      ["Free Cafe Coffee", 150, "Min bill ₹400"],
      ["10% Grocery Store OFF", 200, "Min bill ₹500"],
    ]
  );

  assert.deepEqual(canRedeemReward(80, REWARD_CATALOG[0]), {
    eligible: false,
    shortfall: 20,
  });
  assert.deepEqual(canRedeemReward(100, REWARD_CATALOG[0]), {
    eligible: true,
    shortfall: 0,
  });

  const code = generateUniqueCouponCode("GYM15");
  assert.match(code, /^CS-GYM15-[A-Z0-9]{6}$/);

  assert.equal(formatCountdownSeconds(900), "15:00");
  assert.equal(formatCountdownSeconds(59), "00:59");
  assert.equal(formatCountdownSeconds(0), "00:00");
  assert.equal(formatCountdownSeconds(-10), "00:00");
});

test("validatePhotoFileMeta supports mobile MIME types, extension fallback, and 10 MB size cap", () => {
  assert.equal(
    validatePhotoFileMeta({ type: "image/jpeg", size: 1024 * 500 }).valid,
    true
  );
  assert.equal(
    validatePhotoFileMeta({ type: "image/heic", size: 1024 * 800 }).valid,
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

