# Current Handoff

This file is the authoritative resume point for CatalogGuard. Repository state, CI, and live Shopify evidence take precedence over conversation memory.

## Exact state

```text
Date: 2026-09-03
Canonical repository: JeremyHennessy/CatalogGuard
Immutable main baseline SHA: 1a540cd3ea73b9b03e3830b8b9c14dc02cf0511f
Phase 1 branch: phase-1/shopify-scaffold
Phase 1 PR: #11 (draft)
Phase 1 issue: #1 CLOSED — live development-store acceptance verified
Phase 2 branch: phase-2/domain-rule-engine
Phase 2 PR: #12 (draft, stacked on Phase 1)
Phase 2 issue: #2 CLOSED — engineering scope complete
Phase 3 branch: phase-3/baseline-dashboard
Phase 3 PR: #14 (draft, stacked on Phase 2)
Phase 3 issue: #13 OPEN — live baseline acceptance in progress
Phase 3 submit-fix checkpoint: 06be5203eb21afd9712c0f53f3ec7dd44a459302
Phase 3 submit-fix Quality Gate: 33797199974 — success
Shopify Admin API: 2026-07 / ApiVersion.July26
Requested CatalogGuard scopes: read_products only
Shopify development store: catalogguard-dev-p8tpcpjw.myshopify.com
CatalogGuard installation handle: catalogguard-11
Observed CatalogGuard requested scopes: read_products
Observed CatalogGuard granted scopes: read_products
Embedded App Home: VERIFIED LIVE
Authenticated real catalog read: VERIFIED LIVE
Production deployment: none verified
```

There is **no user-approved merge/checkpoint yet**. Green CI and closed engineering issues are implementation evidence, not permission to merge. `main` remains the immutable baseline until the user explicitly approves a later implementation state.

## Phase 1 live acceptance — complete

- CatalogGuard is installed on `catalogguard-dev-p8tpcpjw.myshopify.com`.
- Shopify reports the app requests exactly `read_products` and the installation has exactly `read_products` granted.
- The embedded React Router App Home opens successfully inside Shopify Admin.
- The app executed authenticated Admin GraphQL against API `2026-07` and rendered real development-store products/variant counts.
- No product write, customer, or order scope was added.

## Phase 2 engineering scope — complete

Phase 2 provides the deterministic normalized catalog model, 15 built-in rules, immutable policy/evaluation semantics, findings lifecycle, exact exception semantics, preflight outcomes, evidence-preserving Prisma persistence, exhaustive Shopify product/variant pagination with completeness verification, normalization, and transactional scan orchestration.

The repository-green in-code path is:

`authenticated Shopify Admin -> exhaustive product/variant read -> normalized complete catalog -> immutable policy evaluation -> transactional scan/finding persistence`

Rule status remains `PASS`, `FAIL`, `NOT_APPLICABLE`, `UNKNOWN`; enforcement remains separate as `COMPLIANT`, `VIOLATION`, `WAIVED`, `INDETERMINATE`, `NOT_APPLICABLE`.

## Phase 3 first slice — implemented

The first Phase 3 slice turns the engine into the first merchant-facing workflow without silently inventing a production policy.

### Overview / onboarding

- Authenticated Shopify `shop { id }` is persisted as the CatalogGuard tenant identity with GID/domain conflict protection.
- The old Phase 1 10-product demo is replaced by an evidence-backed Overview.
- Page load reads persisted evidence only; it does not run a scan.
- Before baseline, Overview explicitly shows `No baseline yet`.

### Development validation policy

The only current onboarding policy is explicitly development-only and contains exactly:

- `CG-SKU-001` SKU required — enabled, CRITICAL, blocking, ACTIVE products only.
- `CG-SKU-002` SKU unique — enabled, CRITICAL, blocking, ACTIVE products only, `EXACT` normalization.

This is not a merchant production default. The policy has deterministic per-shop identity, is stored as an immutable revision, and persisted-template drift is rejected.

### Baseline action

- `Establish dev baseline` is an explicit user action.
- The server requires exact intent `establish-dev-baseline`; unknown actions receive HTTP 400.
- Existing COMPLETE baseline is checked before scanning.
- Exact persisted exceptions are loaded through a service boundary.
- The action invokes the verified Shopify reader and `runShopifyCatalogPolicyScanV1` with `baseline=true`.
- A deterministic baseline scan ID supports replay/idempotency evidence.
- Shopify products remain read-only; only CatalogGuard evidence is written.

### Persisted Overview after baseline

Overview is wired to show persisted:

- products/variants evaluated;
- PASS / FAIL / UNKNOWN / NOT_APPLICABLE counts;
- open findings;
- baseline debt;
- new/reopened regressions;
- blocking violations;
- blocking indeterminate results;
- waived failures;
- current open finding evidence summaries.

## Live Phase 3 acceptance attempt — 2026-09-03

The pre-baseline embedded Overview was verified live and correctly showed `No baseline yet` plus the explicit development policy and action.

The first click of `Establish dev baseline` returned React Router `Error: Bad Request` before Shopify catalog read/scan execution. The error matched CatalogGuard's own unsupported-intent 400 guard. No baseline was persisted and no evidence state was modified.

Root boundary: the client used React Router `<Form>` with a hidden intent input while the submit control was Shopify's `s-button` web component. Shopify documents `s-button type="submit"` as integrating with native HTML forms; relying on that through React Router's intercepted Form layer produced an ambiguous submit payload in the live App Home.

Fix checkpoint `06be5203eb21afd9712c0f53f3ec7dd44a459302` removes that interoperability assumption. The Shopify button now invokes React Router `useSubmit()` directly with an explicit URL-encoded `{ intent: "establish-dev-baseline" }` payload. The server-side intent guard is unchanged.

Permanent Quality Gate `33797199974` passed locked install, formatting, lint, TypeScript, all tests, Prisma validation, clean migration deployment, and production build.

The next live action is to pull this checkpoint locally and retry **once**. Do not reset the dev store or change Shopify scopes/configuration.

## Repository-green checkpoints

These are evidence points, not user approvals:

- Phase 1 scaffold: `86a7deeee8076cc71a3dccde762697d1db6a2543` / `33774438006`
- Phase 2 completion handoff: `c65eb5dfc8b84f6dc190679ee56d50033d13b308` / `33793827908`
- Phase 3 first slice: `da9597471b166569e44a8ca8d35fd9dbd61791b4` / `33795979049`
- Phase 3 synchronized handoff: `c9bbae3feb85a0a2dacc82a93cb6e5a456c45476` / `33796199258`
- Phase 3 baseline submit-boundary fix: `06be5203eb21afd9712c0f53f3ec7dd44a459302` / `33797199974`

## Phase 3 live acceptance still required

1. Pull `phase-3/baseline-dashboard` locally while preserving the linked development Shopify config.
2. Verify `No baseline yet` still renders before the retry.
3. Click `Establish dev baseline` once.
4. Verify one real COMPLETE baseline is persisted through CatalogGuard's own authenticated Admin client.
5. Verify current failures become `BASELINE_DEBT`, not regressions.
6. Verify products/variants/evaluation/finding counts appear on Overview.
7. Refresh and verify the persisted state remains without silently rerunning the scan.
8. Verify a repeated baseline action cannot create a second baseline.
9. Preserve any UNKNOWN / INDETERMINATE evidence distinctly.

After live baseline acceptance: add Findings drill-down/history, immutable merchant policy editing through new revisions, exact exception create/revoke UI, preflight persistence/UI, webhook/incremental refresh paired with reconciliation, and evaluate Shopify Bulk Operations before production large-catalog scale.

## Other unresolved items

- No production host or PostgreSQL deployment is verified.
- No live Phase 3 baseline has yet completed successfully.
- No merchant-facing policy editor, finding-detail/history screen, waiver UI, or preflight UI exists yet.
- No webhook/incremental refresh runtime is wired to the scan service yet.
- The page reader is correct for current validation; Shopify Bulk Operations should be evaluated before production large-catalog scale.
- Weight/inventory/cost rules remain deliberately deferred.
- Locked install still reports 23 npm advisories (3 moderate, 20 high). Do not use `npm audit fix --force`; investigate dependency families separately.

## Locked product guardrails

CatalogGuard remains: **Shopify catalog policy + regression detection + exceptions + preflight QA.** It is not primarily a generic health score, SEO tool, AI copywriter, PIM, backup/revert tool, automatic bulk fixer, or workflow engine.

Rule status remains distinct from enforcement; policy revisions remain immutable for evidence; baseline debt remains distinct from later regressions; canonical evidence remains deterministic/replayable; UI/routes must not duplicate domain business logic.
