# Current Handoff

This file is the authoritative resume point for CatalogGuard. Repository state, CI, live Shopify evidence, and current official Shopify framework guidance take precedence over conversation memory.

## Exact state

```text
Date: 2026-09-04
Canonical repository: JeremyHennessy/CatalogGuard
Immutable main baseline SHA: 1a540cd3ea73b9b03e3830b8b9c14dc02cf0511f
Phase 1: issue #1 CLOSED / PR #11 draft
Phase 2: issue #2 CLOSED / PR #12 draft stacked on Phase 1
Phase 3 branch: phase-3/baseline-dashboard
Phase 3 issue: #13 OPEN
Phase 3 PR: #14 draft stacked on Phase 2
Phase 3 embedded-navigation green code head: 68a69539e0304bb20de9435f54393f5054a1e00c
Phase 3 embedded-navigation Quality Gate: 33868940433 — success
Phase 3 current synchronized head: 09783e3426f00760d54912f892b504fc6b2742d2
Shopify Admin API: 2026-07 / ApiVersion.July26
React Router: 7.18.3
Requested/granted Shopify scopes: read_products only
Shopify development store: catalogguard-dev-p8tpcpjw.myshopify.com
CatalogGuard installation handle: catalogguard-11
Embedded App Home: VERIFIED LIVE
Authenticated real catalog read: VERIFIED LIVE
Real Phase 3 baseline: VERIFIED LIVE 2026-09-04
Persisted baseline after restart/refresh: VERIFIED LIVE 2026-09-04
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

## React Router mutation-origin root cause — resolved live

Repeated early baseline attempts failed with React Router `Bad Request` before CatalogGuard action execution. The same pre-action 400 survived three dispatch shapes, including a bodyless dedicated action route. Normal App Home requests emitted Shopify `authenticate.admin()` logging while failed mutations did not.

CatalogGuard pins React Router `7.18.3`, whose mutation Origin/CSRF validation runs before route actions. Shopify CLI development places the public tunnel origin in front of a local React Router listener, so the browser public origin can differ from the origin represented by the proxied request URL.

CatalogGuard derives `allowedActionOrigins` from the **exact** Shopify public app host supplied by `SHOPIFY_APP_URL`/`HOST` compatibility fallback. Security constraints remain locked:

- no CSRF/origin validation disable;
- no `*.trycloudflare.com` wildcard;
- no hard-coded transient tunnel host;
- only the current configured Shopify app host is allowed;
- scaffold contract rejects wildcard tunnel origins.

Root-cause code head `888d5fe053da1993113f0362044f22d03e4e6cbf` passed Quality Gate `33802077280`. The fix was verified by the successful live baseline mutation.

## Live Phase 3 baseline — verified 2026-09-04

The user established a real baseline from the embedded App Home after the action-origin fix.

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

The evaluation total reconciles exactly: `6 + 21 + 0 + 25 = 52 = 26 variants × 2 development rules`.

The observed open findings are `CG-SKU-001` technical FAILs classified `BASELINE_DEBT`, `CRITICAL`, blocking, `VIOLATION`, message `SKU is required.` This verifies that failures present at the explicit baseline are debt rather than regressions.

The user subsequently pulled/restarted the next Phase 3 build and the Overview still showed the **same baseline timestamp and exact 17/26/6/21/0/25 plus 21-debt counts**. This verifies that Overview reload/restart reads persisted evidence rather than silently creating another scan.

## Repeated-baseline guard — repository verified

Baseline establishment is extracted into `establishDevBaselineV1` so the route remains a thin authenticated adapter.

The application service proves two paths:

1. when a COMPLETE baseline already exists, it returns `ALREADY_ESTABLISHED` **before** policy creation/loading, exception loading, or Shopify scan execution;
2. when no baseline exists, it creates/loads the dev policy, loads exact exceptions, uses the deterministic baseline scan identity, and executes exactly one baseline scan.

Dedicated tests cover both paths.

## Findings evidence surface — repository verified

The first proper Findings surface is implemented:

- `/app/findings` reads persisted open findings without rescanning Shopify;
- list query is shop-scoped, ordered deterministically, capped at 250, and explicitly reports truncation;
- `/app/finding/:findingId` uses `id + shopId` lookup to prevent cross-shop evidence access;
- detail exposes current finding state, immutable resource identity, latest evaluation, scan/policy/rule identity, observed/expected/evidence JSON when present, and ordered `FindingEvent` history;
- related exception evidence is shown when present;
- Overview labels its ten records **Recent open findings** and links to the full Findings list and evidence detail;
- Shopify products remain read-only and no scope beyond `read_products` was added.

The original Findings code checkpoint `5b93c555fb981f6ab7d244f760bbecd01654a66e` passed Quality Gate `33866964811`.

## Embedded Findings navigation defect — root cause identified and fixed

Live acceptance of the first Findings build exposed a navigation-only defect: Overview persisted and rendered correctly, but clicking **View all open findings** or **View evidence history** produced a blank embedded page.

The routes/loaders were not changed for this fix. Repository review found all internal Findings navigation used raw HTML `<a>` anchors. Shopify's current React Router template explicitly warns that embedded apps must preserve the session through embedded-aware navigation: use React Router/Polaris navigation and **do not use `<a>`**. The same current template demonstrates internal navigation with `<s-link href="/app/additional">`.

CatalogGuard changed only the embedded navigation boundary:

- Overview `/app/findings` link: raw `<a>` -> Shopify `<s-link>`;
- Overview finding-detail links: raw `<a>` -> Shopify `<s-link>`;
- Findings back-to-Overview link: raw `<a>` -> Shopify `<s-link>`;
- Findings detail links: raw `<a>` -> Shopify `<s-link>`;
- Finding-detail back link: raw `<a>` -> Shopify `<s-link>`;
- scaffold contract rejects raw `<a>` elements across these internal Findings routes and asserts the required Shopify links.

No loader, Prisma query, shop-scope guard, finding/evaluation/event model, Shopify scope, or write behavior changed.

Final clean embedded-navigation code head after removing temporary formatters:

`68a69539e0304bb20de9435f54393f5054a1e00c`

Permanent Quality Gate `33868940433` — **success**. Locked install, formatting, lint, TypeScript, all scaffold/domain/persistence tests, Prisma validation, clean migration deployment, and production build passed.

## Phase 3 live acceptance still open

One live UI pass remains before Issue #13 should be closed:

1. pull/restart the synchronized head `09783e3426f00760d54912f892b504fc6b2742d2` or later;
2. verify Overview still shows the persisted 2026-09-04 07:53:27 baseline and 17 products / 26 variants / 21 baseline-debt findings;
3. open **View all open findings** and verify the Findings page renders 21 of 21 current findings;
4. open at least one **View evidence history** link and verify finding status, latest Evaluation, immutable identifiers, and FindingEvent history render;
5. verify Shopify-link navigation back to Findings and Overview works.

If those pass, close Issue #13 and proceed to merchant-facing immutable policy revisions and exact exception/waiver management.

## Next bounded Phase 3 work after live Findings acceptance

1. merchant-facing policy creation/editing through immutable new revisions;
2. exact exception create/revoke UI while preserving technical FAIL separately from WAIVED enforcement;
3. preflight persistence/UI;
4. webhook/incremental detection paired with periodic full reconciliation;
5. evaluate Shopify Bulk Operations before production-scale large-catalog use;
6. production hosting/PostgreSQL only after the current evidence workflow is accepted.

## Repository-green checkpoints

These are evidence points, not user approvals:

- Phase 1 scaffold: `86a7deeee8076cc71a3dccde762697d1db6a2543` / `33774438006`
- Phase 2 completion handoff: `c65eb5dfc8b84f6dc190679ee56d50033d13b308` / `33793827908`
- Phase 3 first slice: `da9597471b166569e44a8ca8d35fd9dbd61791b4` / `33795979049`
- Phase 3 React Router exact action-origin configuration: `888d5fe053da1993113f0362044f22d03e4e6cbf` / `33802077280`
- Phase 3 root-cause synchronized handoff: `9d532d58e2efc32123a0b7be4511a1435b19b6d6` / `33802280036`
- Phase 3 repeated guard + Findings evidence surface: `5b93c555fb981f6ab7d244f760bbecd01654a66e` / `33866964811`
- Phase 3 embedded-safe Findings navigation: `68a69539e0304bb20de9435f54393f5054a1e00c` / `33868940433`

## Other unresolved items

- No production host or PostgreSQL deployment is verified.
- No merchant-facing policy editor, exception UI, or preflight UI exists yet.
- No webhook/incremental refresh runtime is wired to the scan service yet.
- The page reader is correct for current validation; Shopify Bulk Operations should be evaluated before production large-catalog scale.
- Weight/inventory/cost rules remain deliberately deferred.
- Locked install still reports 23 npm advisories (3 moderate, 20 high). Do not use `npm audit fix --force`; investigate dependency families separately.

## Locked product guardrails

CatalogGuard remains: **Shopify catalog policy + regression detection + exceptions + preflight QA.** It is not primarily a generic health score, SEO tool, AI copywriter, PIM, backup/revert tool, automatic bulk fixer, or workflow engine.

Rule status remains distinct from enforcement; policy revisions remain immutable for evidence; baseline debt remains distinct from later regressions; canonical evidence remains deterministic/replayable; UI/routes must not duplicate domain business logic.
