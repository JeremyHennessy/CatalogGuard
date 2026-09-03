# Current Handoff

This file is the authoritative resume point for CatalogGuard. Repository state, CI, and live Shopify evidence take precedence over conversation memory.

## Exact state

```text
Date: 2026-09-03
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
Phase 3 issue: #13 OPEN — live baseline acceptance in progress
Phase 3 action-origin code checkpoint: 888d5fe053da1993113f0362044f22d03e4e6cbf
Phase 3 action-origin Quality Gate: 33802077280 — success
Shopify Admin API: 2026-07 / ApiVersion.July26
React Router: 7.18.3
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

## Phase 3 first slice — implemented

### Overview / onboarding

- Authenticated Shopify `shop { id }` is persisted as the CatalogGuard tenant identity with GID/domain conflict protection.
- The old Phase 1 10-product demo is replaced by an evidence-backed Overview.
- Page load reads persisted evidence only and does not run a scan.
- Before baseline, Overview explicitly shows `No baseline yet`.

### Development validation policy

The current onboarding policy is explicitly development-only and contains exactly:

- `CG-SKU-001` SKU required — enabled, CRITICAL, blocking, ACTIVE products only.
- `CG-SKU-002` SKU unique — enabled, CRITICAL, blocking, ACTIVE products only, `EXACT` normalization.

This is not a merchant production default. The policy has deterministic per-shop identity, is stored as an immutable revision, and persisted-template drift is rejected.

### Baseline action

- `Establish dev baseline` is an explicit user action.
- Existing COMPLETE baseline is checked before scanning.
- Exact persisted exceptions are loaded through a service boundary.
- The action invokes the verified Shopify reader and `runShopifyCatalogPolicyScanV1` with `baseline=true`.
- A deterministic baseline scan ID supports replay/idempotency evidence.
- Shopify products remain read-only; only CatalogGuard evidence is written.
- A dedicated `POST /app/baseline` route now owns the baseline mutation path; the Overview index route is read-only.

### Persisted Overview after baseline

Overview is wired to show persisted products/variants evaluated, PASS/FAIL/UNKNOWN/NOT_APPLICABLE counts, open findings, baseline debt, regressions, blocking violations, blocking indeterminate results, waived failures, and current finding evidence summaries.

## Live Phase 3 baseline failure investigation — 2026-09-03

The pre-baseline embedded Overview is verified live and correctly shows `No baseline yet` plus the explicit development policy and action.

Repeated clicks of `Establish dev baseline` returned React Router `Error: Bad Request`. The critical runtime evidence is that the failing mutation did **not** produce the Shopify `authenticate.admin()` log that normal app requests produce. Therefore the 400 is emitted before CatalogGuard's route action begins. No baseline was persisted and no scan/finding evidence was modified.

Two earlier dispatch changes were useful negative experiments but did not solve the failure:

1. React Router `<Form>` + hidden `intent` + Shopify `s-button`;
2. `useSubmit({ intent })`;
3. dedicated `POST /app/baseline` with no request body.

The same pre-action 400 survived all three shapes. That rules the request body, index-route intent guard, Shopify scope, Prisma baseline logic, and scan engine out as primary causes. Do not resume button/form churn.

### Evidence-supported root cause: React Router 7.18 action-origin enforcement behind Shopify CLI proxy

CatalogGuard pins React Router `7.18.3`. In this version, `singleFetchAction()` performs the framework's mutation-origin/CSRF check before route action execution. The check compares the request `Origin` against the origin represented by `request.url`, unless the origin is explicitly included in `allowedActionOrigins`.

Shopify CLI development uses a public app URL/tunnel in front of the local React Router server. Runtime evidence showed both sides simultaneously:

- public App Home/tunnel URL: `https://<generated>.trycloudflare.com`;
- local React Router listener: `http://localhost:<port>`.

That is the reverse-proxy topology affected by React Router's stricter 7.18 mutation-origin behavior: the browser's public origin can differ from the origin React Router derives from the proxied request. The resulting rejection is a bare 400 from `singleFetchAction()` before CatalogGuard authentication or action code runs, matching all observed failures.

Live confirmation of this diagnosis is still required; it is not yet recorded as a successful baseline.

### Root-cause configuration

CatalogGuard now has `react-router.config.ts` that derives one allowed action host from Shopify's configured public app URL:

```ts
function configuredActionOrigins(): string[] {
  const appUrl = process.env.SHOPIFY_APP_URL || process.env.HOST;

  if (!appUrl) return [];

  const parsed = new URL(appUrl);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("SHOPIFY_APP_URL must use http or https");
  }

  return [parsed.host];
}

export default {
  allowedActionOrigins: configuredActionOrigins(),
};
```

Security boundary:

- no blanket CSRF disable;
- no `*.trycloudflare.com` wildcard;
- no hard-coded transient tunnel hostname;
- only the exact app host Shopify supplies for the running environment is trusted;
- production therefore remains bound to the configured production `SHOPIFY_APP_URL` rather than a development tunnel wildcard.

The scaffold contract now protects that boundary and explicitly rejects wildcard `trycloudflare.com` origins.

Final root-cause code head after removing the temporary exact-formatter workflow: `888d5fe053da1993113f0362044f22d03e4e6cbf`.

Permanent Quality Gate `33802077280` passed locked install, formatting, lint, TypeScript, all tests, Prisma validation, clean migration deployment, and production build.

## Repository-green checkpoints

These are evidence points, not user approvals:

- Phase 1 scaffold: `86a7deeee8076cc71a3dccde762697d1db6a2543` / `33774438006`
- Phase 2 completion handoff: `c65eb5dfc8b84f6dc190679ee56d50033d13b308` / `33793827908`
- Phase 3 first slice: `da9597471b166569e44a8ca8d35fd9dbd61791b4` / `33795979049`
- Phase 3 synchronized handoff: `c9bbae3feb85a0a2dacc82a93cb6e5a456c45476` / `33796199258`
- Phase 3 first submit-boundary experiment: `06be5203eb21afd9712c0f53f3ec7dd44a459302` / `33797199974`
- Phase 3 dedicated baseline route: `667de2a032433a6f5a0ae6226be7ac764c6ec86c` / `33798229165`
- Phase 3 React Router exact action-origin configuration: `888d5fe053da1993113f0362044f22d03e4e6cbf` / `33802077280`

## Phase 3 live acceptance still required

1. Pull the final Phase 3 action-origin checkpoint locally while preserving the linked Shopify development config.
2. Restart `shopify app dev` so `react-router.config.ts` is reloaded with the new Shopify-supplied public app URL.
3. Verify `No baseline yet` still renders.
4. Click `Establish dev baseline` once.
5. First diagnostic criterion: the POST must now reach CatalogGuard's action and emit Shopify `Authenticating admin request` logging. If it does not, stop and investigate config/environment visibility rather than changing the button/route again.
6. Verify one real COMPLETE baseline is persisted.
7. Verify current failures become `BASELINE_DEBT`, not regressions.
8. Verify product/variant/evaluation/finding counts appear on Overview.
9. Refresh and verify the persisted state remains without silently rerunning the scan.
10. Verify repeated baseline action cannot create a second baseline.
11. Preserve any UNKNOWN / INDETERMINATE evidence distinctly.

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
