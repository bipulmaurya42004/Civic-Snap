import test from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_DEFAULT_REJECTION_NOTE,
  canAccessAdminDashboard,
  computeAdminIssuesKpis,
  extractMaterialMetrics,
  formatGpsCoordinates,
  normalizeAdminIssueStatus,
  shouldAwardPointsOnApprove,
} from "./admin-issues-logic";

test("canAccessAdminDashboard strictly requires authenticated email in NEXT_PUBLIC_ADMIN_EMAILS with zero URL bypass", () => {
  assert.equal(
    canAccessAdminDashboard({
      userEmail: "admin1@gmail.com",
      envAdminEmailsOverride: "admin1@gmail.com, admin2@gmail.com",
    }),
    true
  );

  assert.equal(
    canAccessAdminDashboard({
      userEmail: "ADMIN2@GMAIL.COM",
      envAdminEmailsOverride: "admin1@gmail.com,admin2@gmail.com",
    }),
    true
  );

  assert.equal(
    canAccessAdminDashboard({
      userEmail: null,
      envAdminEmailsOverride: "admin1@gmail.com",
    }),
    false
  );

  assert.equal(
    canAccessAdminDashboard({
      userEmail: "",
      envAdminEmailsOverride: "admin1@gmail.com",
    }),
    false
  );

  assert.equal(
    canAccessAdminDashboard({
      userEmail: "citizen@example.com",
      envAdminEmailsOverride: "admin1@gmail.com,admin2@gmail.com",
    }),
    false
  );
});

test("formatGpsCoordinates formats valid lat/lng and rejects invalid numbers", () => {
  assert.equal(formatGpsCoordinates(12.9716, 77.5946), "12.9716° N, 77.5946° E");
  assert.equal(formatGpsCoordinates(-33.8688, -151.2093), "33.8688° S, 151.2093° W");
  assert.equal(formatGpsCoordinates(null, 77.5946), null);
  assert.equal(formatGpsCoordinates(95, 77.5946), null);
});

test("ADMIN_DEFAULT_REJECTION_NOTE matches required municipal admin note", () => {
  assert.equal(
    ADMIN_DEFAULT_REJECTION_NOTE,
    "Marked as invalid or unverified by Admin"
  );
});

test("normalizeAdminIssueStatus maps raw Firestore statuses accurately", () => {
  assert.equal(normalizeAdminIssueStatus("Reported", false), "Reported");
  assert.equal(
    normalizeAdminIssueStatus("Under_AI_Verification", false),
    "Under_AI_Verification"
  );
  assert.equal(normalizeAdminIssueStatus("Resolved", true), "Resolved");
  assert.equal(normalizeAdminIssueStatus("Verified_Fixed", true), "Resolved");
  assert.equal(normalizeAdminIssueStatus("Rejected", false), "Rejected");
  assert.equal(normalizeAdminIssueStatus(undefined, true), "Resolved");
});

test("extractMaterialMetrics parses structured numbers and fallback text estimates", () => {
  const structured = extractMaterialMetrics({
    asphaltEstimateKg: 140,
    estimatedCostInr: 4500,
  });
  assert.equal(structured.asphaltEstimateKg, 140);
  assert.equal(structured.estimatedCostInr, 4500);
  assert.equal(structured.materialSummary, "140 kg Asphalt · ₹4,500");

  const parsedText = extractMaterialMetrics({
    materialEstimate: "~125 kg Asphalt required",
    economicCostOfDelay: "Est. ₹3,800 repair cost",
  });
  assert.equal(parsedText.asphaltEstimateKg, 125);
  assert.equal(parsedText.estimatedCostInr, 3800);
  assert.equal(parsedText.materialSummary, "125 kg Asphalt · ₹3,800");
});

test("shouldAwardPointsOnApprove prevents double-crediting already resolved verified issues", () => {
  assert.equal(shouldAwardPointsOnApprove("Reported", false), true);
  assert.equal(
    shouldAwardPointsOnApprove("Under_AI_Verification", false),
    true
  );
  assert.equal(shouldAwardPointsOnApprove("Rejected", false), true);
  assert.equal(shouldAwardPointsOnApprove("Resolved", true), false);
});

test("computeAdminIssuesKpis aggregates live counts accurately", () => {
  const kpis = computeAdminIssuesKpis([
    { status: "Reported" },
    { status: "Under_AI_Verification" },
    { status: "Resolved" },
    { status: "Rejected" },
    { status: "Resolved" },
  ]);
  assert.deepEqual(kpis, {
    total: 5,
    pending: 2,
    resolved: 2,
    rejected: 1,
  });
});
