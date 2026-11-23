# CivicSnap Firestore Security Specification (Phase 0)

## 1. Data Invariants

1. **Zero-Trust Default Deny**: Every unmatched path is denied (`allow read, write: if false;`).
2. **PII Isolation (Split Collection)**: Private account emails live strictly in `/users/{userId}` (readable only by owner or verified admin). Public contributor aliases live in `/public_profiles/{userId}` and can only be listed when `leaderboardOptIn == true`.
3. **No Self-Assigned Admin**: Users cannot create, update, or delete `/admins/{userId}`, nor attach `role` or `isAdmin` shadow keys to `/users/{userId}`.
4. **Report Ownership & Initial State**: Authenticated, email-verified users can create `/reports/{reportId}` only with `reporterId == request.auth.uid`, `status == 'pending'`, `reviewState == 'unreviewed'`, `publicApproved == false`, and server timestamps (`createdAt == request.time`, `updatedAt == request.time`).
5. **Admin-Only Moderation & Terminal State Locking**: Only verified admins may change `status`, `reviewState`, `publicApproved`, or `duplicateOfId`, or write to `/public_reports/{reportId}`. Reporters cannot modify a report once `status == 'resolved'` or inject non-whitelisted fields.
6. **Master Gate Subcollection & Immutable Audit Trail**: `/reports/{reportId}/events/{eventId}` verifies the parent report exists via `get()` and forbids `update` or `delete`.
7. **Secure List Queries**: Every `allow list` rule enforces explicit `resource.data` predicates (`resource.data.reporterId == request.auth.uid`, `resource.data.publicApproved == true`, `resource.data.leaderboardOptIn == true`) without `get()`/`exists()` cost explosions.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)

1. **Identity Spoofing on Report Create**: Authenticated user `u1` creates `/reports/r1` with `reporterId: "u2"`.
2. **Self-Approval Status Shortcutting**: User `u1` creates `/reports/r2` with `status: "resolved"`, `reviewState: "accepted"`, `publicApproved: true`.
3. **Shadow Field Injection (Ghost Field)**: User `u1` creates `/users/u1` including `isAdmin: true` or `points: 9999`.
4. **Privilege Escalation to `/admins`**: User `u1` attempts `setDoc('/admins/u1', { uid: 'u1', grantedAt: request.time })`.
5. **Cross-User PII Read**: Authenticated user `u2` reads `/users/u1` containing `u1`'s email.
6. **Opted-Out Public Profile Scraping**: Unauthenticated visitor queries `/public_profiles` without `where('leaderboardOptIn', '==', true)` or reads an opted-out profile.
7. **Unauthorized Status Mutation**: Reporter `u1` updates `/reports/r1` changing `status: "resolved"` or `reviewState: "accepted"`.
8. **Terminal State Violation**: Reporter `u1` attempts to edit `description` on an already `resolved` report.
9. **Value Poisoning on Whitelisted Key**: Reporter `u1` updates `/users/u1` with `alias` exceeding 40 characters or wrong type (`alias: 12345`).
10. **Path ID Poisoning**: User `u1` attempts to write `/reports/bad id with spaces and $$$` or an ID > 128 chars.
11. **Forged Timestamp Manipulation**: User `u1` creates `/reports/r3` with backdated client `createdAt` instead of `request.time`.
12. **Public Report Forgery / Audit Deletion**: User `u1` writes directly to `/public_reports/r1` or deletes `/reports/r1/events/e1`.
