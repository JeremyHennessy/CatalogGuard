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
Phase 4 first-slice green code head: 05649b5bc70927caa3ad74dee1710a6d3cb49178
Phase 4 first-slice Quality Gate: 33871872927 — success
Shopify Admin API: 2026-07 / ApiVersion.July26
React Router: 7.18.3
Requested/granted Shopify scopes: read_products only
Shopify development store: catalogguard-dev-p8tpcpjw.myshopify.com
CatalogGuard installation handle: catalogguard-11
Embedded App Home: VERIFIED LIVE
Authenticated real catalog read: VERIFIED LIVE
Real Phase 3 baseline: VERIFIED LIVE 2026-09-04
Persisted baseline after restart/refresh: VERIFIED LIVE 2026-09-04
Findings list/detail embedded navigation: VERIFIED LIVE 2026-09-04
Production deployment: none verified
```

There is **no user-approved merge/checkpoint yet**. Green CI, closed engineering issues, and live validation are implementation evidence, not permission to merge. `main` remains the immutable baseline until the user explicitly approves a later implementation state.

## Phase 1 — live acceptance complete

- CatalogGuard is installed on the development store.
- Shopify reports exactly `read_products` requested and granted.
- The embedded React Router App Home opens inside Shopify Admin.
- CatalogGuard executes authenticated Admin GraphQL against API `2026-07` and reads real development-store catalog records.
- No product-write, customer, or order scope was added.

## Phase 2 — engineering scope complete

Phase 2 provides the normalized catalog model, 15 deterministic rules, immutable policy/evaluation semantics, findings lifecycle, exact exception semantics, preflight outcomes, Prisma persistence, exhaustive Shopify product/variant pagination with completeness verification, normalization, and transactional scan reconciliation.

Repository-green in-code path:

`authenticated Shopify Admin -> exhaustive product/variant read -> normalized complete catalog -> immutable policy evaluation -> transactional scan/finding persistence`

Rule status remains `PASS`, `FAIL`, `NOT_APPLICABLE`, `UNKNOWN`; enforcement remains separate as `COMPLIANT`, `VIOLATION`, `WAIVED`, `INDETERMINATE`, `NOT_APPLICABLE`.

## Phase 3 — live acceptance complete

### React Router action-origin blocker

React Router `7.18.3` rejected Shopify CLI tunnel mutations before route action execution because its mutation Origin/CSRF check saw the public embedded origin behind a local reverse proxy. CatalogGuard now derives `allowedActionOrigins` from the **exact** Shopify public app host supplied by `SHOPIFY_APP_URL`/`HOST` compatibility fallback.

Security remains strict: no origin-check disable, no `*.trycloudflare.com` wildcard, no transient tunnel hostname hard-coded. Root-cause code head `888d5fe053da1993113f0362044f22d03e4e6cbf` passed Quality Gate `33802077280` and the fix was verified by the successful live baseline mutation.

### Real baseline evidence

Observed persisted Overview evidence:

```text
Baseline completed: 2026-09-04 07:53:27 local display time
Products evaluated: 17
Variants evaluated: 26
PASS evaluations: 6
FAIL evaluations: 21
UNKNOWN evaluations: 0
NOT_APPLICABLE evaluations: 25
Open findings: 21
Baseline debt: 21
New/reopened regressions: 0
Blocking violations: 21
Blocking indeterminate: 0
Waived failures: 0
```

`6 + 21 + 0 + 25 = 52 = 26 variants × 2 development rules`. The observed `CG-SKU-001` failures are technical `FAIL`, `CRITICAL`, blocking, enforcement `VIOLATION`, classification `BASELINE_DEBT`. Failures present at the explicit baseline were therefore correctly classified as debt rather than regressions.

The user later restarted/pulled and the Overview retained the same timestamp/counts. This verifies persisted reads and no silent rescan.

### Repeated baseline protection

`establishDevBaselineV1` is directly tested. When a COMPLETE baseline exists, it returns `ALREADY_ESTABLISHED` before policy loading, exception loading, or Shopify scan execution. When no baseline exists, it executes exactly one deterministic baseline scan.

### Findings surface and embedded navigation

- `/app/findings` reads persisted OPEN findings without rescanning Shopify.
- `/app/finding/:findingId` is shop-scoped and exposes latest Evaluation plus FindingEvent history.
- Internal embedded navigation uses Shopify `<s-link>` instead of raw HTML anchors.
- User live-tested Overview -> Findings -> finding detail/history -> back and confirmed it works.

Phase 3 Issue #13 is CLOSED. PR #14 remains draft/unmerged.

## Phase 4 — immutable merchant policies + exact waivers

Branch: `phase-4/policies-exceptions`
Issue: #15 OPEN
Draft PR: #16, stacked on Phase 3

### Locked policy invariants

- Historical `PolicyRevision` and `PolicyRule` rows are immutable evidence.
- Saving an edit appends revision N+1; it never updates a prior revision.
- Revision activation uses optimistic `baseRevisionId` checking so stale editors cannot silently overwrite a newer active revision.
- The first merchant editor changes only controlled metadata: policy name/description and per-rule enabled/severity/blocking.
- Existing rule config and scope are preserved byte-for-logical-value via the immutable revision mapper; arbitrary merchant code is not supported.
- Historical scans/preflights keep their original `policyRevisionId`.

### Policy first slice — repository green

New application boundaries:

- `buildNextPolicyRevisionInputV1` clones the active revision, increments the revision number deterministically, preserves config/scope, rejects duplicate or unknown rule edits, and changes only enabled/severity/blocking.
- `saveMerchantPolicyRevisionV1` trims/validates merchant metadata, rejects stale `baseRevisionId`, rejects no-op edits, validates the next revision against the built-in registry, then calls one append+activate persistence operation.
- `PrismaPolicyRepository.appendAndActivateRevision` performs shop ownership check, active-revision concurrency check, next-revision-number check, immutable revision/rule insert, and logical policy activation in one transaction.

New merchant surfaces:

- `/app/policies` — shop-scoped policy list with revision count/latest revision.
- `/app/policy/:policyId` — current revision controls plus immutable revision history.
- first editor supports policy name, description, required change summary, enabled/disabled, severity, and blocking.
- config/scope are shown read-only and deliberately deferred to a later deterministic builder.
- Overview links to **Manage policies** using embedded-safe Shopify navigation.

### Exact waiver invariants

- Waiver applies only to an OPEN technical `FAIL` finding.
- Waiver identity is exact to shop + finding + rule + resource + optional subresource.
- Reason is required; notes and expiry are optional.
- Expiry must be later than creation.
- A second currently-active exact waiver is rejected.
- Revocation is scoped by shop + finding + exception identity.
- Revocation sets timestamps/actor/reason; it never deletes historical exception evidence.
- `FindingEvent` records `EXCEPTION_CREATED` and `EXCEPTION_REVOKED` evidence.

### Technical FAIL vs current effective enforcement

The original persisted `Evaluation` row remains immutable. Creating a waiver does **not** rewrite its technical status or historical enforcement. `loadFindingExceptionStateV1` overlays current exception state for the detail UI:

- technical status remains `FAIL`;
- persisted scan enforcement remains the original value (normally `VIOLATION`);
- current effective enforcement becomes `WAIVED` while an exact exception is active;
- expiry or revocation removes the overlay and current effective enforcement returns to the persisted enforcement until a later scan writes new evaluation evidence.

Finding detail now exposes:

- technical result;
- persisted scan enforcement;
- current effective enforcement;
- Create exact waiver form;
- Revoke waiver form;
- waiver history;
- existing immutable resource/evaluation/finding history.

### Phase 4 automated verification

First-slice code head:

`05649b5bc70927caa3ad74dee1710a6d3cb49178`

Permanent Quality Gate `33871872927` — **success**:

- locked install
- formatting
- lint
- TypeScript
- all scaffold/domain/persistence tests
- Prisma validation
- clean migration deployment
- production build

Temporary formatter workflow was removed before the clean checkpoints. No Shopify scope or product mutation was added.

## Phase 4 live acceptance required next

Preserve the existing `dev.sqlite` and linked `shopify.app.development.toml`. Do not create a new baseline.

1. switch local checkout to `phase-4/policies-exceptions` and restart `shopify app dev`;
2. verify existing 07:53:27 baseline still renders unchanged;
3. open **Manage policies** and verify the development policy + revision 1 history;
4. make a controlled metadata/rule-control edit and save it as revision 2;
5. verify revision 1 remains in history unchanged and revision 2 becomes active;
6. verify the old baseline still references/represents its original evidence and is not rewritten;
7. open an existing technical FAIL finding and create an exact waiver with a reason;
8. verify technical result remains `FAIL`, persisted scan enforcement remains `VIOLATION`, and current effective enforcement becomes `WAIVED`;
9. verify waiver history and `EXCEPTION_CREATED` evidence render;
10. revoke the waiver with a reason;
11. verify technical result still remains `FAIL`, current effective enforcement returns to `VIOLATION`, and revocation history/evidence render.

Do not automatically run a post-policy scan yet. The first live objective is to prove immutable revisioning and waiver lifecycle independently.

## Known next Phase 4 work after live acceptance

1. update Overview/current finding summaries to count active exception overlays without mutating historical Evaluation rows;
2. add deterministic rule-specific config/scope builder/editor;
3. add a controlled post-policy scan/reconciliation path using `POLICY_CHANGE` cause so newly introduced failures classify as `POLICY_CHANGE_FAILURE` rather than data regressions;
4. preflight persistence/UI;
5. webhook/incremental detection paired with periodic full reconciliation;
6. evaluate Shopify Bulk Operations before production-scale large-catalog use;
7. production hosting/PostgreSQL only after the evidence workflow is accepted.

## Repository-green checkpoints

- Phase 1 scaffold: `86a7deeee8076cc71a3dccde762697d1db6a2543` / `33774438006`
- Phase 2 completion handoff: `c65eb5dfc8b84f6dc190679ee56d50033d13b308` / `33793827908`
- Phase 3 action-origin configuration: `888d5fe053da1993113f0362044f22d03e4e6cbf` / `33802077280`
- Phase 3 embedded-safe Findings navigation: `68a69539e0304bb20de9435f54393f5054a1e00c` / `33868940433`
- Phase 3 final handoff: `6b367e0a25b0adb72a43f46387217641ee461a94` / `33869579945`
- Phase 4 immutable policy + exact waiver first slice: `05649b5bc70927caa3ad74dee1710a6d3cb49178` / `33871872927`

## Other unresolved items

- No production host or PostgreSQL deployment is verified.
- Current Overview `waived` count is based on persisted latest Evaluation enforcement and therefore will not immediately reflect a newly-created waiver overlay until this Phase 4 follow-on is implemented. Do not mutate historical evaluations merely to make that count change.
- No automatic post-policy scan is wired yet; policy revisions affect future scans only.
- No preflight UI exists yet.
- No webhook/incremental refresh runtime is wired to the scan service yet.
- The page reader is correct for current validation; Shopify Bulk Operations should be evaluated before production large-catalog scale.
- Weight/inventory/cost rules remain deliberately deferred.
- Locked install still reports 23 npm advisories (3 moderate, 20 high). Do not use `npm audit fix --force`; investigate dependency families separately.

## Locked product guardrails

CatalogGuard remains: **Shopify catalog policy + regression detection + exceptions + preflight QA.** It is not primarily a generic health score, SEO tool, AI copywriter, PIM, backup/revert tool, automatic bulk fixer, or workflow engine.

Rule status remains distinct from enforcement; policy revisions remain immutable for evidence; baseline debt remains distinct from later regressions; canonical evidence remains deterministic/replayable; UI/routes must not duplicate domain business logic.
