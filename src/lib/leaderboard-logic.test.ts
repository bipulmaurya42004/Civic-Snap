import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateLiveWardStandings,
  buildLiveCitizenLeaderboard,
  computeDynamicTop5Standing,
  isResolvedIssueStatus,
  normalizeWardName,
} from "./leaderboard-logic";

test("buildLiveCitizenLeaderboard returns empty list with zero mock entries when Firestore is empty", () => {
  const result = buildLiveCitizenLeaderboard([]);
  assert.equal(result.entries.length, 0);
  assert.equal(result.hasAnyVerifiedFixes, false);
});

test("buildLiveCitizenLeaderboard shows logged-in 0-point user as Unranked with zero mock fallback", () => {
  const result = buildLiveCitizenLeaderboard([], {
    uid: "uid-real-1",
    displayName: "Bipul Maurya",
    alias: "Bipul",
    photoURL: "https://lh3.googleusercontent.com/avatar.png",
    points: 0,
    resolvedCount: 0,
    reportsCount: 0,
  });

  assert.equal(result.entries.length, 1);
  assert.equal(result.hasAnyVerifiedFixes, false);
  assert.equal(result.entries[0]?.isRanked, false);
  assert.equal(result.entries[0]?.rankLabel, "Unranked");
  assert.equal(result.entries[0]?.displayName, "Bipul Maurya");
  assert.equal(result.entries[0]?.points, 0);
  assert.equal(result.entries[0]?.verifiedFixes, 0);
  assert.equal(result.entries[0]?.isCurrentUser, true);
  assert.equal(result.entries[0]?.isShortlistEligible, false);
});

test("buildLiveCitizenLeaderboard sorts real citizens by points desc and labels 0-point users Unranked", () => {
  const result = buildLiveCitizenLeaderboard(
    [
      { uid: "u1", displayName: "Citizen A", points: 50, resolvedCount: 1 },
      { uid: "u2", displayName: "Citizen B", civicPoints: 250, resolvedReportsCount: 5 },
      { uid: "u3", displayName: "Citizen C", points: 0, resolvedCount: 0 },
    ],
    {
      uid: "u1",
      displayName: "Citizen A",
      photoURL: "https://example.com/a.jpg",
      points: 50,
      resolvedCount: 1,
    }
  );

  assert.equal(result.hasAnyVerifiedFixes, true);
  assert.deepEqual(
    result.entries.map((e) => [e.uid, e.rankLabel, e.points]),
    [
      ["u2", "#1", 250],
      ["u1", "#2", 50],
      ["u3", "Unranked", 0],
    ]
  );
  assert.equal(result.entries[1]?.photoURL, "https://example.com/a.jpg");
  assert.equal(result.entries[1]?.isCurrentUser, true);
  assert.equal(result.entries[2]?.isShortlistEligible, false);
});

test("computeDynamicTop5Standing returns Pioneer Verifier Zone, 0 cutoff, and Unranked for 0-point user", () => {
  const standing = computeDynamicTop5Standing([], {
    uid: "uid-new",
    displayName: "New Citizen",
    points: 0,
    resolvedCount: 0,
  });

  assert.equal(standing.top5CutoffPoints, 0);
  assert.equal(standing.userRank, null);
  assert.equal(standing.userRankLabel, "Unranked");
  assert.equal(standing.isPioneerZone, true);
  assert.equal(standing.isTop5Finalist, false);
  assert.equal(standing.pointsToTop5, 0);
});

test("computeDynamicTop5Standing computes exact 5th-place cutoff and dynamic rank when >= 5 users have points", () => {
  const profiles = [
    { uid: "u1", displayName: "One", points: 500 },
    { uid: "u2", displayName: "Two", points: 400 },
    { uid: "u3", displayName: "Three", points: 350 },
    { uid: "u4", displayName: "Four", points: 300 },
    { uid: "u5", displayName: "Five", points: 250 },
    { uid: "u6", displayName: "Six", points: 100 },
  ];

  const standing = computeDynamicTop5Standing(profiles, {
    uid: "u6",
    displayName: "Six",
    points: 100,
  });

  assert.equal(standing.top5CutoffPoints, 250);
  assert.equal(standing.userRank, 6);
  assert.equal(standing.userRankLabel, "Rank #6");
  assert.equal(standing.isPioneerZone, false);
  assert.equal(standing.isTop5Finalist, false);
  assert.equal(standing.pointsToTop5, 150);
});

test("aggregateLiveWardStandings returns real zeros across all wards when Firestore issues are empty", () => {
  const standings = aggregateLiveWardStandings([]);
  assert.ok(standings.length >= 7);
  for (const row of standings) {
    assert.equal(row.totalReports, 0);
    assert.equal(row.verifiedFixes, 0);
    assert.equal(row.wardPoints, 0);
    assert.equal(row.resolutionRate, 0);
  }
});

test("aggregateLiveWardStandings computes Total Reports, Verified Fixes, and Ward Points (Verified Fixes * 50) dynamically", () => {
  const standings = aggregateLiveWardStandings([
    { id: "i1", ward: "Indiranagar", status: "Resolved" },
    { id: "i2", ward: "100ft Road, Indiranagar", status: "Reported" },
    { id: "i3", ward: "HSR Layout", status: "Verified_Fixed" },
    { id: "i4", locality: "HSR Layout", status: "resolved" },
    // Duplicate id should not double-count
    { id: "i4", locality: "HSR Layout", status: "resolved" },
    { id: "i5", ward: "Bellandur", status: "Reported" },
  ]);

  const hsr = standings.find((w) => w.ward === "HSR Layout");
  const indiranagar = standings.find((w) => w.ward === "Indiranagar");
  const bellandur = standings.find((w) => w.ward === "Bellandur");
  const koramangala = standings.find((w) => w.ward === "Koramangala");

  assert.equal(standings[0]?.ward, "HSR Layout");
  assert.equal(hsr?.totalReports, 2);
  assert.equal(hsr?.verifiedFixes, 2);
  assert.equal(hsr?.wardPoints, 100);
  assert.equal(hsr?.resolutionRate, 100);

  assert.equal(indiranagar?.totalReports, 2);
  assert.equal(indiranagar?.verifiedFixes, 1);
  assert.equal(indiranagar?.wardPoints, 50);
  assert.equal(indiranagar?.resolutionRate, 50);

  assert.equal(bellandur?.totalReports, 1);
  assert.equal(bellandur?.verifiedFixes, 0);
  assert.equal(bellandur?.wardPoints, 0);

  assert.equal(koramangala?.totalReports, 0);
  assert.equal(koramangala?.verifiedFixes, 0);
  assert.equal(koramangala?.wardPoints, 0);
});

test("isResolvedIssueStatus and normalizeWardName handle real Firestore statuses and localities", () => {
  assert.equal(isResolvedIssueStatus("Resolved"), true);
  assert.equal(isResolvedIssueStatus("resolved"), true);
  assert.equal(isResolvedIssueStatus("Verified_Fixed"), true);
  assert.equal(isResolvedIssueStatus("Reported"), false);
  assert.equal(isResolvedIssueStatus("pending"), false);

  assert.equal(normalizeWardName("HAL 2nd Stage Indiranagar"), "Indiranagar");
  assert.equal(normalizeWardName("HSR Layout Sector 2"), "HSR Layout");
  assert.equal(normalizeWardName("Bellandur"), "Bellandur");
  assert.equal(normalizeWardName(""), null);
});
