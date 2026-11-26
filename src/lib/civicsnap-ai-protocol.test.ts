import test from "node:test";
import assert from "node:assert/strict";
import {
  AUDIT_DISCLAIMER_TEXT,
  BEFORE_AFTER_MIN_CONFIDENCE,
  CIVICSNAP_AI_SYSTEM_PROMPT,
  extractAsphaltKgFromMaterial,
  mapProtocolCategoryToIssueCategory,
  normalizeBeforeAfterVerification,
  normalizeCivicAuditResponse,
} from "./civicsnap-ai-protocol";

test("CIVICSNAP_AI_SYSTEM_PROMPT encodes compliance mandate and all 4 tasks", () => {
  assert.match(CIVICSNAP_AI_SYSTEM_PROMPT, /CivicSnap AI/);
  assert.match(CIVICSNAP_AI_SYSTEM_PROMPT, /Independent Civic Audit & Ward Triage Protocol/);
  assert.match(CIVICSNAP_AI_SYSTEM_PROMPT, /NOT a government body, BBMP employee/i);
  assert.match(CIVICSNAP_AI_SYSTEM_PROMPT, /Task 1: ANTI-SPAM & IMAGE VALIDITY CHECK/);
  assert.match(CIVICSNAP_AI_SYSTEM_PROMPT, /Task 2: HINGLISH TO FORMAL CIVIC TRANSLATION/);
  assert.match(CIVICSNAP_AI_SYSTEM_PROMPT, /Task 3: CIVIL ENGINEERING & COST ESTIMATION/);
  assert.match(CIVICSNAP_AI_SYSTEM_PROMPT, /Task 4: BEFORE-VS-AFTER VERIFICATION/);
  assert.match(CIVICSNAP_AI_SYSTEM_PROMPT, /confidence >= 85%/);
});

test("normalizeCivicAuditResponse strictly nulls all metrics when is_civic_issue is false", () => {
  const rejected = normalizeCivicAuditResponse({
    is_civic_issue: false,
    rejection_reason: "Indoor laptop screen detected rather than an outdoor civic hazard.",
    category: "Pothole / Road Damage",
    severity_score: 9,
    engineering_estimates: {
      estimated_dimensions: "1m x 1m",
      required_material: "100 kg",
      estimated_repair_cost_inr: 3500,
      labor_requirement: "2 workers",
    },
  });

  assert.equal(rejected.is_civic_issue, false);
  assert.match(rejected.rejection_reason ?? "", /Indoor laptop screen/i);
  assert.equal(rejected.category, null);
  assert.equal(rejected.ticket_title, null);
  assert.equal(rejected.ticket_description, null);
  assert.equal(rejected.severity_score, null);
  assert.equal(rejected.sla_priority, null);
  assert.equal(rejected.engineering_estimates, null);
  assert.equal(rejected.hazard_risk_summary, null);
  assert.equal(rejected.audit_disclaimer, AUDIT_DISCLAIMER_TEXT);
});

test("normalizeCivicAuditResponse returns complete Bengaluru engineering audit for valid issues", () => {
  const valid = normalizeCivicAuditResponse(
    {
      is_civic_issue: true,
      rejection_reason: null,
      category: "Pothole / Road Damage",
      ticket_title: "Deep Asphalt Pothole on HSR Layout 27th Main",
      ticket_description:
        "Severe carriageway depression posing immediate two-wheeler skidding risk on HSR Layout 27th Main Road.",
      severity_score: 8,
      sla_priority: "P1 - Critical (<24h)",
      engineering_estimates: {
        estimated_dimensions: "Approx 1.4m x 0.8m, depth ~9cm",
        required_material: "Approx 120-150 kg Cold-Mix Bituminous Asphalt",
        estimated_repair_cost_inr: 3800,
        labor_requirement: "2 workers with hand compactor (approx 45 mins)",
      },
      hazard_risk_summary: "High risk of two-wheeler skid during monsoon/night hours",
    },
    "HSR Layout"
  );

  assert.equal(valid.is_civic_issue, true);
  assert.equal(valid.rejection_reason, null);
  assert.equal(valid.category, "Pothole / Road Damage");
  assert.equal(valid.severity_score, 8);
  assert.equal(valid.sla_priority, "P1 - Critical (<24h)");
  assert.equal(valid.engineering_estimates?.estimated_repair_cost_inr, 3800);
  assert.equal(valid.audit_disclaimer, AUDIT_DISCLAIMER_TEXT);
  assert.equal(
    extractAsphaltKgFromMaterial(valid.engineering_estimates?.required_material),
    135
  );
  assert.equal(mapProtocolCategoryToIssueCategory(valid.category), "pothole");
  assert.equal(mapProtocolCategoryToIssueCategory("Garbage Blackspot"), "waste");
  assert.equal(mapProtocolCategoryToIssueCategory("Open Manhole"), "other");
});

test("normalizeBeforeAfterVerification strictly enforces >= 85% match confidence threshold", () => {
  assert.equal(BEFORE_AFTER_MIN_CONFIDENCE, 85);

  const belowThreshold = normalizeBeforeAfterVerification({
    fix_verified: true,
    match_confidence_score: 84,
    reason: "Partial patch visible but edges remain unsealed.",
  });
  assert.equal(belowThreshold.fix_verified, false);
  assert.equal(belowThreshold.verdict, "Flagged");
  assert.equal(belowThreshold.verificationStatus, "flagged");
  assert.equal(belowThreshold.match_confidence_score, 84);

  const passesThreshold = normalizeBeforeAfterVerification({
    fix_verified: true,
    match_confidence_score: 91,
    reason: "Cavity completely paved and compacted with fresh bituminous mix.",
  });
  assert.equal(passesThreshold.fix_verified, true);
  assert.equal(passesThreshold.verdict, "Verified");
  assert.equal(passesThreshold.verificationStatus, "verified");
  assert.equal(passesThreshold.match_confidence_score, 91);
  assert.equal(passesThreshold.audit_disclaimer, AUDIT_DISCLAIMER_TEXT);
});
