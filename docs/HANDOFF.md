# Current Handoff

This file is the authoritative resume point for CatalogGuard. Repository state, CI, and live Shopify evidence take precedence over conversation memory.

## Exact state

```text
Date: 2026-09-04
Canonical repository: JeremyHennessy/CatalogGuard
Immutable main baseline SHA: 1a540cd3ea73b9b03e3830b8b9c14dc02cf0511f
Phase 1 branch: phase-1/shopify-scaffold
Phase 1 PR: #11 draft
Phase 1 issue: #1 CLOSED — live development-store acceptance verified
Phase 2 branch: phase-2/domain-rule-engine
Phase 2 PR: #12 draft, stacked on Phase 1
Phase 2 issue: #2 CLOSED — engineering scope complete
Phase 3 branch: phase-3/baseline-dashboard
Phase 3 PR: #14 draft, stacked on Phase 2
Phase 3 issue: #13 OPEN — baseline succeeded; reload/repeated-action acceptance and next UI slice remain
Phase 3 action-origin code checkpoint: 888d5fe053da1993113f0362044f22d03e4e6cbf
Phase 3 action-origin Quality Gate: 33802077280 — success
Phase 3 synchronized handoff before live success: 9d532d58e2efc32123a0b7be4511a1435b19b6d6
Shopify Admin API: 2026-07 / ApiVersion.July26
React Router: 7.18.3
Requested CatalogGuard scopes: read_products only
Shopify development store: catalogguard-dev-p8tpcpjw.myshopify.com
CatalogGuard installation handle: catalogguard-11
Observed CatalogGuard requested scopes: read_products
Observed CatalogGuard granted scopes: read_products
Embedded App Home: VERIFIED LIVE
Authenticated real catalog read: VERIFIED LIVE
Real Phase 3 baseline: VERIFIED LIVE 2026-09-04
Production deployment: none verified
```

There is **no user-approved merge/checkpoint yet**. Green CI, closed engineering issues, and live validation are implementation evidence, not permission to merge. `main` remains the immutable baseline until the user explicitly approves a later implementation state.

## Phase 1 live acceptance — complete

- CatalogGuard is installed on the development store.
- Shopify reports exactly `read_products` requested and granted.
- The embedded React Router App Home opens inside Shopify Admin.
- CatalogGuard executes authenticated Admin GraphQL against API `2026-07` and reads real development-store catalog records.
- No product-write, customer, or order scope was added.

## Phase 2 engineering scope — complete

Phase 2 provides the deterministic normalized catalog model, 15 built-in rules, immutable policy/evaluation semantics, findings lifecycle, exact exception semantics, preflight outcomes, evidence-preserving Prisma persistence, exhaustive Shopify product/variant pagination with completeness verification, normalization, and transactional scan orchestration.

Repository-green in-code path:

`authenticated Shopify Admin -> exhaustive product/variant read -> normalized complete catalog -> immutable policy evaluation -> transactional scan/finding persistence`

Rule status remains `PASS`, `FAIL`, `NOT_APPLICABLE`, `UNKNOWN`; enforcement remains separate as `COMPLIANT`, `VIOLATION`, `WAIVED`, `INDETERMINATE`, `NOT_APPLICABLE`.

## Phase 3 first slice — implemented and live baseline verified

### Overview / onboarding

- Authenticated Shopify `shop { id }` is persisted as the CatalogGuard tenant identity with GID/domain conflict protection.
- The old Phase 1 10-product demo is replaced by an evidence-backed Overview.
- Page load reads persisted evidence only and does not run a scan.
- Before baseline, Overview explicitly showed `No baseline yet`.

### Development validation policy

The current onboarding policy is explicitly development-only and contains exactly:

- `CG-SKU-001` SKU required — enabled, CRITICAL, blocking, ACTIVE products only.
- `CG-SKU-002` SKU unique — enabled, CRITICAL, blocking, ACTIVE products only, `EXACT` normalization.

This is not a merchant production default. The policy has deterministic per-shop identity, is stored as an immutable revision, and persisted-template drift is rejected.

### Baseline mutation path

- `Establish dev baseline` is an explicit user action.
- Existing COMPLETE baseline is checked before scanning.
- Exact persisted exceptions are loaded through a service boundary.
- The action invokes the verified Shopify reader and `runShopifyCatalogPolicyScanV1` with `baseline=true`.
- A deterministic baseline scan ID supports replay/idempotency evidence.
- Shopify products remain read-only; only CatalogGuard evidence is written.
- A dedicated `POST /app/baseline` route owns the baseline mutation path; the Overview index route is read-only.

### React Router action-origin root cause and fix

Repeated early baseline attempts failed with React Router `Bad Request` before CatalogGuard action execution. The decisive runtime evidence was that failed mutation requests emitted `singleFetchAction` 400s without the Shopify `authenticate.admin()` log that normal app requests produced.

CatalogGuard pins React Router `7.18.3`, whose mutation Origin/CSRF validation runs before route actions. Shopify CLI development places the public tunnel origin in front of a local React Router listener, so the browser public origin can differ from the origin represented by the proxied request URL.

CatalogGuard now uses `react-router.config.ts` to derive `allowedActionOrigins` from the **exact** Shopify public app host supplied by `SHOPIFY_APP_URL`/`HOST` compatibility fallback. Security constraints remain locked:

- no CSRF/origin validation disable;
- no `*.trycloudflare.com` wildcard;
- no hard-coded transient tunnel host;
- only the current configured Shopify app host is allowed;
- scaffold contract rejects wildcard tunnel origins.

Final root-cause code head: `888d5fe053da1993113f0362044f22d03e4e6cbf`.

Permanent Quality Gate `33802077280` passed locked install, formatting, lint, TypeScript, all tests, Prisma validation, clean migration deployment, and production build. Synchronized handoff head `9d532d58e2efc32123a0b7be4511a1435b19b6d6` also passed Quality Gate `33802280036`.

## Live Phase 3 baseline acceptance — verified 2026-09-04

The user pulled/restarted the action-origin checkpoint and established a real baseline successfully from the embedded App Home.

Observed persisted Overview evidence after the click:

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

The evaluation total is internally complete for the development policy: `6 + 21 + 0 + 25 = 52`, exactly `26 variants × 2 rules`.

The displayed open findings were `CG-SKU-001` failures classified as `BASELINE_DEBT`, `CRITICAL`, blocking, `VIOLATION`, with message `SKU is required.` This verifies the central lifecycle requirement: failures present at the explicit baseline are debt, not new regressions.

This live result confirms:

- React Router action-origin configuration allows the legitimate Shopify tunnel mutation;
- CatalogGuard action authentication executes;
- exhaustive catalog read completed for 17 products / 26 variants;
- immutable development policy evaluated all expected rule/resource combinations;
- transactional scan/evaluation/finding persistence completed;
- Overview reads and displays the persisted baseline/finding evidence;
- UNKNOWN remained distinct and was zero for this fixture scan;
- no Shopify product write scope or mutation was introduced.

## Phase 3 acceptance still open

Two behavioral checks remain before Issue #13 should be closed:

1. reload/refresh the Overview and verify the same persisted baseline/counts remain without a new scan;
2. exercise the repeated-baseline action guard and prove it cannot create a second baseline.

The repeated-baseline guard also needs a dedicated application-level test rather than relying only on persistence idempotency tests.

## Next bounded Phase 3 slice

1. extract/test baseline establishment orchestration so an existing COMPLETE baseline exits before policy/catalog scan execution;
2. add a full Findings page rather than truncating the Overview at 10 findings;
3. add per-finding detail/history using persisted `Finding`, latest `Evaluation`, and `FindingEvent` evidence;
4. enforce shop ownership on finding detail lookups;
5. keep the Overview concise and link to Findings;
6. continue to preserve raw immutable resource identities even when later adding merchant-friendly labels/Shopify links.

After this slice: immutable merchant policy editing through new revisions, exact exception create/revoke UI, preflight persistence/UI, webhook/incremental refresh paired with reconciliation, and evaluate Shopify Bulk Operations before production large-catalog scale.

## Repository-green checkpoints

These are evidence points, not user approvals:

- Phase 1 scaffold: `86a7deeee8076cc71a3dccde762697d1db6a2543` / `33774438006`
- Phase 2 completion handoff: `c65eb5dfc8b84f6dc190679ee56d50033d13b308` / `33793827908`
- Phase 3 first slice: `da9597471b166569e44a8ca8d35fd9dbd61791b4` / `33795979049`
- Phase 3 synchronized handoff: `c9bbae3feb85a0a2dacc82a93cb6e5a456c45476` / `33796199258`
- Phase 3 dedicated baseline route: `667de2a032433a6f5a0ae6226be7ac764c6ec86c` / `33798229165`
- Phase 3 React Router exact action-origin configuration: `888d5fe053da1993113f0362044f22d03e4e6cbf` / `33802077280`
- Phase 3 root-cause synchronized handoff: `9d532d58e2efc32123a0b7be4511a1435b19b6d6` / `33802280036`

## Other unresolved items

- No production host or PostgreSQL deployment is verified.
- No merchant-facing policy editor, finding-detail/history screen, waiver UI, or preflight UI exists yet.
- No webhook/incremental refresh runtime is wired to the scan service yet.
- The page reader is correct for current validation; Shopify Bulk Operations should be evaluated before production large-catalog scale.
- Weight/inventory/cost rules remain deliberately deferred.
- Locked install still reports 23 npm advisories (3 moderate, 20 high). Do not use `npm audit fix --force`; investigate dependency families separately.

## Locked product guardrails

CatalogGuard remains: **Shopify catalog policy + regression detection + exceptions + preflight QA.** It is not primarily a generic health score, SEO tool, AI copywriter, PIM, backup/revert tool, automatic bulk fixer, or workflow engine.

Rule status remains distinct from enforcement; policy revisions remain immutable for evidence; baseline debt remains distinct from later regressions; canonical evidence remains deterministic/replayable; UI/routes must not duplicate domain business logic.
