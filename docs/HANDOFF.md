# Current Handoff

This file is the authoritative resume point for CatalogGuard. Repository state, CI, live Shopify evidence, and current official Shopify framework guidance take precedence over conversation memory.

## Exact state

```text
Date: 2026-09-04
Canonical repository: JeremyHennessy/CatalogGuard
Immutable main baseline SHA: 1a540cd3ea73b9b03e3830b8b9c14dc02cf0511f
Phase 1: issue #1 CLOSED / PR #11 draft
Phase 2: issue #2 CLOSED / PR #12 draft stacked on Phase 1
Phase 3: issue #13 CLOSED / PR #14 draft stacked on Phase 2
Phase 4 branch: phase-4/policies-exceptions
Phase 4 issue: #15 OPEN
Phase 4 PR: #16 draft stacked on Phase 3
Phase 4 combined green code head: d25be542ef26439026ca4288ffd2105434df2610
Phase 4 combined Quality Gate: 33876152592 — success
Shopify Admin API: 2026-07 / ApiVersion.July26
React Router: 7.18.3
Requested/granted Shopify scopes: read_products only
Shopify development store: catalogguard-dev-p8tpcpjw.myshopify.com
Embedded App Home: VERIFIED LIVE
Authenticated real catalog read: VERIFIED LIVE
Real persisted baseline: VERIFIED LIVE 2026-09-04
Findings list/detail/history: VERIFIED LIVE
Phase 4 immutable policy + exact waiver first slice: VERIFIED LIVE
Production deployment: none verified
```

There is **no user-approved merge/checkpoint yet**. Green CI, closed engineering issues, and live validation are implementation evidence, not permission to merge. `main` remains the immutable baseline until the user explicitly approves a later implementation state.

## Product invariants

CatalogGuard remains **Shopify catalog policy + regression detection + exceptions + preflight QA**.

- Rule status: `PASS`, `FAIL`, `NOT_APPLICABLE`, `UNKNOWN`.
- Enforcement is separate: `COMPLIANT`, `VIOLATION`, `WAIVED`, `INDETERMINATE`, `NOT_APPLICABLE`.
- `UNKNOWN` is never coerced to `PASS`.
- Severity and blocking are independent.
- Policy revisions are immutable evidence.
- Baseline debt remains distinct from later regressions.
- Exact waivers do not change the underlying technical `FAIL`.
- No merchant-supplied arbitrary code.
- Shopify products remain read-only; no scope beyond `read_products` has been added.

## Phase 1 — complete with live Shopify acceptance

CatalogGuard is installed on the development store, requests and receives exactly `read_products`, opens as an embedded React Router App Home, and performs authenticated Admin GraphQL reads against API `2026-07`.

## Phase 2 — engineering scope complete

Phase 2 provides the normalized catalog model, 15 deterministic built-in rules, immutable policy/evaluation semantics, findings lifecycle, exact exception semantics, preflight outcome logic, Prisma persistence, exhaustive Shopify product/variant pagination with completeness verification, normalization, and transactional scan reconciliation.

Repository-green pipeline:

`authenticated Shopify Admin -> exhaustive product/variant read -> normalized complete catalog -> immutable policy evaluation -> transactional scan/finding persistence`

## Phase 3 — complete with live acceptance

### React Router mutation-origin fix

React Router `7.18.3` initially rejected Shopify CLI tunnel mutations before route actions because its Origin/CSRF validation saw the public embedded origin behind a local reverse proxy. CatalogGuard now derives `allowedActionOrigins` from the **exact** Shopify public app host supplied by `SHOPIFY_APP_URL`/`HOST` compatibility fallback. No wildcard tunnel host and no CSRF disable are used.

Root-cause code head `888d5fe053da1993113f0362044f22d03e4e6cbf` passed Quality Gate `33802077280` and was verified by a successful live mutation.

### Real baseline evidence

The explicit baseline completed at `2026-09-04 07:53:27` local display time and remains persisted across restart/refresh:

```text
Products evaluated: 17
Variants evaluated: 26
PASS: 6
FAIL: 21
UNKNOWN: 0
NOT_APPLICABLE: 25
Open findings: 21
BASELINE_DEBT: 21
New/reopened regressions: 0
Blocking violations: 21
Blocking indeterminate: 0
Waived failures at baseline: 0
```

`6 + 21 + 0 + 25 = 52 = 26 variants × 2 development-policy rules`.

Findings list/detail/history and embedded navigation are live verified. Internal navigation uses Shopify `<s-link>` rather than raw HTML anchors.

## Phase 4 — first slice live accepted

Branch: `phase-4/policies-exceptions`
Issue: #15 OPEN
Draft PR: #16 stacked on Phase 3

### Immutable policy revisions

Merchant policy edits use append-only revisions:

- saving an edit creates deterministic revision `N+1`;
- prior `PolicyRevision` and `PolicyRule` rows are never updated;
- `baseRevisionId` provides an optimistic stale-editor guard;
- append + active-revision switch happen in one Prisma transaction;
- historical scans keep the exact revision that produced them.

The first live test created revision 2, left revision 1 intact in history, and activated revision 2 without changing the original baseline evidence.

### Exact finding waivers

Exact waiver create/revoke is live verified:

- only an OPEN technical `FAIL` can be waived;
- exact rule/resource/subresource identity comes from the finding, not merchant input;
- reason required; notes/expiry optional;
- duplicate active exact waiver rejected;
- expiry must be after creation;
- revoke is scoped by shop + finding + exception;
- revoke records reason/timestamp and never deletes history;
- `FindingEvent` records exception create/revoke evidence.

Live result verified:

```text
technical result: FAIL
persisted scan enforcement: VIOLATION
current effective enforcement while active: WAIVED
current effective enforcement after revoke: VIOLATION
```

The historical evaluation row was not rewritten.

First-slice code checkpoint `05649b5bc70927caa3ad74dee1710a6d3cb49178` passed Quality Gate `33871872927`; synchronized handoff head `48cfe6da409f290b9d7cc474a91abf1f51918421` passed Quality Gate `33872057595`.

## Phase 4 follow-on — repository green, live acceptance pending

Combined clean code head:

`d25be542ef26439026ca4288ffd2105434df2610`

Permanent Quality Gate `33876152592` — **success**. Locked install, formatting, lint, TypeScript, all tests, Prisma validation, clean migration deployment, and production build passed. Temporary formatter workflows were removed before this checkpoint.

### 1. Current-enforcement overlay and Overview counts

Current enforcement is centralized in `currentEnforcementForRuleStatusV1` and is derived from **current technical status + whether an exact waiver is active**:

```text
PASS -> COMPLIANT
FAIL + active waiver -> WAIVED
FAIL + no active waiver -> VIOLATION
UNKNOWN -> INDETERMINATE
NOT_APPLICABLE -> NOT_APPLICABLE
```

This deliberately does not trust an old persisted enforcement value for current-state display. If a scan once persisted `WAIVED` while a waiver was active, later expiry/revocation still makes the current state `VIOLATION` while the technical result remains `FAIL`.

Overview is now active-exception-overlay-aware without mutating Evaluation rows:

- `Waived failures` counts current OPEN technical FAIL findings with an active exact waiver;
- `Blocking violations` excludes active waived blocking FAILs;
- blocking indeterminate counts current blocking UNKNOWN results;
- recent-finding enforcement uses the same centralized current-enforcement function;
- active waiver uses server time and requires created <= now, not revoked, and not expired.

Overlay checkpoint `4bcecd95ed082c96dc9cb0eb2587c76cf9e48471` passed Quality Gate `33874708162`.

### 2. Deterministic rule config/scope editor

The policy workspace now exposes typed, constrained controls for all 15 built-in rules. There is no raw JSON/code editor for merchants.

Editor field types are limited to deterministic controls such as:

- enums (`EXACT` / `TRIM`, `ALL` / `ANY`);
- decimal minimums;
- positive integers;
- exact string lists.

Common V1 scope controls are explicit:

- product status: `ACTIVE`, `ARCHIVED`, `DRAFT`, `UNLISTED`;
- vendor exact list;
- product type exact list;
- any-tag exact list;
- all-tags exact list.

No selected statuses means all statuses. Empty optional lists are omitted rather than persisted as accidental constraints.

The server remains authoritative: every saved config and scope is revalidated through the existing built-in rule registry and scope parser before the next immutable revision can activate. Invalid configuration produces no write.

Tests guard editor-schema coverage for all 15 built-in rules and verify invalid config never activates.

Clean editor checkpoint `c46a1333ca17be0b2b86ee0d8991d21aca9fee36` passed Quality Gate `33875437504`.

### 3. Explicit full policy reconciliation with POLICY_CHANGE cause

Policy save still does **not** silently run a catalog scan.

A separate explicit flow now exists:

`Policies -> Run reconciliation -> confirmation page -> Run full policy reconciliation`

The reconciliation page shows the exact active policy revision before execution. The action includes an `expectedRevisionId` guard; if the active revision changed after the page was loaded, the run is rejected rather than silently evaluating a different policy.

The explicit run performs the same verified exhaustive Shopify read and transactional persistence path with:

```text
scanType: RECONCILIATION
baseline: false
changeCause: POLICY_CHANGE
```

Therefore a newly-created failure caused by the newly active policy is classified `POLICY_CHANGE_FAILURE`, not `NEW_REGRESSION`. Existing findings retain their prior identity/classification unless the normal lifecycle transition requires otherwise.

The run remains read-only to Shopify products and uses the current exact-waiver set during evaluation.

Tests prove exact active-revision capture, stale-revision rejection before scan execution, and `POLICY_CHANGE` cause propagation.

## Next live acceptance

Preserve the existing `dev.sqlite` and Shopify development config. Do **not** create another baseline.

1. Pull/restart the latest `phase-4/policies-exceptions` branch. Wait for the React Router `Local: http://localhost:<port>/` line before judging a blank embedded page; Shopify CLI can expose the preview before the local web target is listening.
2. Confirm the original 07:53:27 baseline is still unchanged.
3. In Manage Policies, edit `CG-SKU-001` scope from ACTIVE-only to include `DRAFT` as well, enter a change summary, and save as the next immutable revision. Revision 2 already exists from the prior live acceptance, so the next revision will normally be revision 3 unless additional revisions were created locally.
4. Verify earlier revisions remain unchanged and the new revision is active; the baseline timestamp/counts must still be unchanged immediately after save.
5. From Policies, open **Run reconciliation**, verify the exact active revision shown, then explicitly run the full policy reconciliation.
6. After return to Overview, confirm the baseline timestamp remains 07:53:27 while **Latest complete scan** reflects the new reconciliation.
7. Any newly failing DRAFT resources introduced solely by the widened policy scope should be `POLICY_CHANGE_FAILURE`, not `NEW_REGRESSION`. Do not predict the count before the live store is evaluated.
8. Optionally create an exact waiver on one blocking technical FAIL after the reconciliation: Overview `Waived failures` should increase and `Blocking violations` should decrease while technical FAIL remains unchanged. Revoke it and those current-state counts/enforcement should restore without another scan or Evaluation mutation.

## Next engineering work after this live acceptance

1. Preflight persistence and merchant UI.
2. Webhook/incremental detection paired with periodic full reconciliation.
3. Evaluate Shopify Bulk Operations before production-scale large-catalog use.
4. Production hosting/PostgreSQL planning only after the evidence workflow is accepted.
5. Weight/inventory/cost rules remain deliberately deferred until field/scope requirements are verified.

## Repository-green checkpoints

- Phase 1 scaffold: `86a7deeee8076cc71a3dccde762697d1db6a2543` / `33774438006`
- Phase 2 completion: `c65eb5dfc8b84f6dc190679ee56d50033d13b308` / `33793827908`
- Phase 3 action-origin fix: `888d5fe053da1993113f0362044f22d03e4e6cbf` / `33802077280`
- Phase 3 final handoff: `6b367e0a25b0adb72a43f46387217641ee461a94` / `33869579945`
- Phase 4 first slice: `05649b5bc70927caa3ad74dee1710a6d3cb49178` / `33871872927`
- Phase 4 overlay-aware enforcement/Overview: `4bcecd95ed082c96dc9cb0eb2587c76cf9e48471` / `33874708162`
- Phase 4 deterministic config/scope editor: `c46a1333ca17be0b2b86ee0d8991d21aca9fee36` / `33875437504`
- Phase 4 combined policy-control/reconciliation checkpoint: `d25be542ef26439026ca4288ffd2105434df2610` / `33876152592`

## Other unresolved items

- No production host or PostgreSQL deployment is verified.
- No preflight merchant UI exists yet.
- No webhook/incremental refresh runtime is wired yet.
- Shopify Bulk Operations has not yet been evaluated for production-scale catalogs.
- Locked install still reports 23 npm advisories (3 moderate, 20 high). Do not use `npm audit fix --force`; investigate dependency families separately.
