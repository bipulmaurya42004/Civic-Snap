import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const RULES_PATH = path.resolve(process.cwd(), "firestore.rules");
const BLUEPRINT_PATH = path.resolve(process.cwd(), "firebase-blueprint.json");

const rulesSource = fs.readFileSync(RULES_PATH, "utf8");
const blueprint = JSON.parse(fs.readFileSync(BLUEPRINT_PATH, "utf8")) as {
  entities: Record<string, { properties: Record<string, { maxLength?: number; minLength?: number }> }>;
  firestore: Record<string, unknown>;
};

test("Phase 6 completeness: every collection in firebase-blueprint.json has a matching rules block", () => {
  const requiredMatchBlocks = [
    "match /users/{userId}",
    "match /public_profiles/{userId}",
    "match /admins/{userId}",
    "match /reports/{reportId}",
    "match /events/{eventId}",
    "match /public_reports/{reportId}",
  ];
  for (const block of requiredMatchBlocks) {
    assert.equal(
      rulesSource.includes(block),
      true,
      `Missing match block in firestore.rules: ${block}`
    );
  }
  assert.equal(Object.keys(blueprint.firestore).length, 6);
});

test("Eight Pillars invariants: default deny, email_verified, strict keys, and no blanket list reads", () => {
  assert.equal(
    rulesSource.includes("match /{document=**} {\n      allow read, write: if false;\n    }"),
    true
  );
  assert.equal(rulesSource.includes("request.auth.token.email_verified == true"), true);
  assert.equal(rulesSource.includes("hasAll("), true);
  assert.equal(rulesSource.includes("hasOnly("), true);
  assert.equal(rulesSource.includes("affectedKeys().hasOnly("), true);
  assert.equal(rulesSource.includes("existing().status != 'resolved'"), true);
  assert.equal(rulesSource.includes("existsAfter(/databases/$(database)/documents/reports/$(reportId))"), true);
  // Ensure no blanket `allow list: if isSignedIn();`
  assert.equal(/allow\s+list\s*:\s*if\s+isSignedIn\(\)\s*;/.test(rulesSource), false);
  // Ensure /admins cannot be written by clients
  assert.equal(rulesSource.includes("allow list, create, update, delete: if false;"), true);
});

test("Validation synchronicity: maxLength constraints match firebase-blueprint.json", () => {
  const reportProps = blueprint.entities.PrivateReport.properties;
  assert.equal(rulesSource.includes(`data.title.size() <= ${reportProps.title.maxLength}`), true);
  assert.equal(rulesSource.includes(`data.description.size() <= ${reportProps.description.maxLength}`), true);
  assert.equal(rulesSource.includes(`data.locality.size() <= ${reportProps.locality.maxLength}`), true);

  const userProps = blueprint.entities.UserPrivateProfile.properties;
  assert.equal(rulesSource.includes(`data.alias.size() <= ${userProps.alias.maxLength}`), true);
});
