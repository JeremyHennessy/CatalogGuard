# Current Handoff

This file is the authoritative resume point for CatalogGuard. Repository state, CI, and live Shopify evidence take precedence over conversation memory.

## Exact state

```text
Date: 2026-09-03
Canonical repository: JeremyHennessy/CatalogGuard
Immutable main baseline SHA: 1a540cd3ea73b9b03e3830b8b9c14dc02cf0511f
Phase 1 branch: phase-1/shopify-scaffold
Phase 1 scaffold checkpoint: 86a7deeee8076cc71a3dccde762697d1db6a2543
Phase 1 PR: #11 draft
Phase 1 Issue #1: CLOSED — live Shopify acceptance verified
Phase 2 branch: phase-2/domain-rule-engine
Phase 2 final handoff SHA: c65eb5dfc8b84f6dc190679ee56d50033d13b308
Phase 2 PR: #12 draft, stacked on Phase 1
Phase 2 Issue #2: CLOSED — engineering scope complete
Phase 3 branch: phase-3/baseline-dashboard
Phase 3 code checkpoint before this handoff: da9597471b166569e44a8ca8d35fd9dbd61791b4
Phase 3 PR: #14 draft, stacked on Phase 2
Phase 3 Issue #13: OPEN
Phase 3 Quality Gate: 33795979049 — success
Shopify Admin API: 2026-07 / ApiVersion.July26
Requested scopes: read_products only
Development store: catalogguard-dev-p8tpcpjw.myshopify.com
CatalogGuard handle: catalogguard-11
Observed requested scopes: read_products
Observed granted scopes: read_products
Embedded App Home: VERIFIED LIVE
Authenticated real catalog read: VERIFIED LIVE
Live Phase 3 baseline scan: NOT YET VERIFIED
Production deployment: none verified
```

There is **no user-approved merge checkpoint yet**. Green CI, closed engineering issues, and live acceptance evidence are implementation evidence only. `main` remains untouched until the user explicitly approves a later stacked implementation state.

## Phase 1 — live acceptance complete

CatalogGuard is installed on the development store, requests and is granted exactly `read_products`, opens as an embedded React Router App Home, and executes authenticated read-only Admin GraphQL against real development-store products on API `2026-07`. No product write, customer, or order scopes were added.

Earlier development blockers were isolated and resolved:

- missing `shopify.web.toml` prevented Shopify CLI from identifying the React Router web process;
- the generated local `shopify.app.development.toml` initially omitted `read_products`;
- one generated Cloudflare quick-tunnel hostname failed DNS, while a fresh dev preview loaded correctly.

PR #11 remains draft/unmerged.

## Phase 2 — deterministic policy/runtime engineering complete

Phase 2 contains:

- normalized Product/Variant evidence with `AVAILABLE`, `UNAVAILABLE`, `NOT_REQUESTED`, `UNRELIABLE`;
- rule outcomes `PASS`, `FAIL`, `NOT_APPLICABLE`, `UNKNOWN` without coercion;
- explicit severity/blocking separation;
- complete/partial store-wide SKU/barcode identifier indexes;
- 15 built-in rules: SKU required/unique, barcode required/unique, minimum price, compare-at relationship, description, vendor, product type, media, SEO title/description, category, tags, and required option names;
- immutable validated policy revisions;
- enforcement `COMPLIANT`, `VIOLATION`, `WAIVED`, `INDETERMINATE`, `NOT_APPLICABLE`;
- exact exceptions that alter enforcement but never rewrite technical FAIL;
- finding classifications `BASELINE_DEBT`, `NEW_REGRESSION`, `REOPENED_REGRESSION`, `POLICY_CHANGE_FAILURE`, `UNKNOWN_CAUSE`;
- preflight `PASS`, `PASS_WITH_WAIVERS`, `FAIL`, `INDETERMINATE`;
- evidence-preserving Prisma persistence and committed migration `20260903132500_add_domain_persistence`;
- immutable policy repository boundary;
- transactional scan/evaluation/finding/event persistence with deterministic identities, immutable input fingerprints, and idempotent replay of an identical COMPLETE scan;
- independent global Shopify products and productVariants streams;
- deterministic Shopify normalization with duplicate/orphan rejection and `variantsCount` completeness reconciliation;
- exhaustive cursor pagination that refuses partial evidence;
- application/server composition from authenticated Shopify Admin read through policy evaluation to transactional persistence.

Connected Shopify source validation previously returned 17 fixture products and 26 variants with reconciled counts. That source validation is distinct from the later Phase 1 proof that CatalogGuard itself has `read_products`.

Phase 2 final handoff `c65eb5dfc8b84f6dc190679ee56d50033d13b308` is green. PR #12 remains draft/unmerged.

## Phase 3 — explicit baseline onboarding / Overview

The first Phase 3 slice is repository-green at `da9597471b166569e44a8ca8d35fd9dbd61791b4`, Quality Gate `33795979049`.

Permanent gate passed:

- locked `npm ci` install;
- Prettier check;
- ESLint;
- React Router type generation + TypeScript;
- scaffold contract tests;
- domain tests;
- persistence tests;
- Prisma validation;
- clean-database `prisma migrate deploy`;
- production build.

Temporary branch-only formatter workflows used during the mechanical formatting loop were removed. No temporary formatter workflow is part of the checkpoint.

### Implemented Phase 3 behavior

- The old Phase 1 ten-product demo route is replaced by an evidence-backed Overview.
- Authenticated Shopify `shop { id }` is used to establish CatalogGuard tenant identity; persisted domain/GID conflicts are rejected rather than silently reassigned.
- Page loading does **not** establish or rerun a baseline.
- Before a baseline, the UI explicitly shows `No baseline yet`.
- The only current baseline template is clearly labelled **CatalogGuard Dev validation** and is not represented as a merchant production default.
- The dev validation template contains exactly:
  - `CG-SKU-001` SKU required — enabled, CRITICAL, blocking, ACTIVE products only;
  - `CG-SKU-002` SKU unique — enabled, CRITICAL, blocking, ACTIVE products only, `EXACT` normalization.
- The dev template has deterministic per-shop policy/revision identity and a deterministic baseline scan ID.
- Policy creation/loading goes through the immutable Prisma policy repository and rejects template/revision drift.
- Exact persisted exceptions are loaded through a service boundary.
- The explicit `Establish dev baseline` action calls the already-verified Shopify catalog reader and `runShopifyCatalogPolicyScanV1` with `baseline=true`.
- An existing COMPLETE baseline causes the action to redirect without silently creating another baseline.
- The Overview reads persisted scan/finding evidence and shows latest scan counts, open findings, baseline debt, new/reopened regressions, blocking violations, blocking indeterminate results, and waivers.
- `UNKNOWN`/`INDETERMINATE` remain explicit rather than being presented as success.
- The scaffold contract now protects the actual read-only Shopify service boundary rather than requiring the obsolete Phase 1 demo query to remain in the UI.
- Tests lock the development policy identity and semantics so it cannot silently drift into a different merchant policy.

## Next live acceptance action

The next dependency is live Phase 3 validation on the existing development store. Do not simulate this with external Shopify-plugin data because the acceptance target is CatalogGuard's own local Prisma evidence.

On the developer machine:

```powershell
cd C:\Users\JeremyHennessy\CatalogGuard
git fetch origin
git switch phase-3/baseline-dashboard
git pull --ff-only
shopify app dev --config development --store catalogguard-dev-p8tpcpjw.myshopify.com
```

Preserve the local linked `shopify.app.development.toml`; it already contains the required `read_products` scope. Open the preview with `p`.

Expected pre-baseline state:

- CatalogGuard Overview loads;
- `No baseline yet` is visible;
- the dev-validation policy disclosure is visible;
- no baseline is created merely by loading/refreshing.

Then explicitly select `Establish dev baseline` once.

Acceptance evidence to capture:

1. the action completes through CatalogGuard's authenticated Shopify Admin client;
2. a COMPLETE BASELINE scan is persisted locally;
3. current technical failures are persisted as `BASELINE_DEBT` rather than `NEW_REGRESSION`;
4. scan product/variant/evaluation counts render from persisted Prisma evidence;
5. refreshing the page reads the same persisted state without running another scan;
6. attempting the baseline action again is guarded rather than creating a second baseline;
7. any UNKNOWN/INDETERMINATE evidence remains visible as such.

If the live action fails, inspect the first runtime error only and repair the first incorrect layer. Do not substitute mock records or external plugin results for the missing local persistence evidence.

## Follow-on engineering after live baseline acceptance

1. Findings drill-down with rule/resource/evidence history.
2. Immutable merchant policy creation/editing through new revisions rather than in-place updates.
3. Exact exception create/revoke workflow with reason, actor, timestamps, and optional expiry.
4. Preflight persistence and UI.
5. Incremental/webhook detection paired with periodic full reconciliation.
6. Evaluate Shopify Bulk Operations before treating page-by-page reads as the final large-catalog production architecture.
7. Production hosting/PostgreSQL, then billing/App Store readiness.

## Other unresolved items

- No production host/PostgreSQL deployment is verified.
- No live Phase 3 baseline is persisted yet.
- No merchant policy editor, full findings drill-down, waiver-management UI, or preflight UI exists yet.
- No webhook/incremental refresh runtime is wired to the scan service yet.
- Weight/inventory/cost rules remain deferred until exact fields/scopes are deliberately expanded.
- Locked install still reports 23 npm advisories (3 moderate, 20 high). Do not use `npm audit fix --force`; investigate dependency families independently.

## Locked product guardrails

CatalogGuard remains **Shopify catalog policy + regression detection + exceptions + preflight QA**. It is not primarily a generic health score, SEO tool, AI copywriter, PIM, backup/revert product, automatic bulk fixer, or workflow engine.

Rule status remains distinct from enforcement. Policy revisions remain immutable for evidence. Baseline debt remains distinct from later regressions. Canonical persisted evidence must remain deterministic and replayable. Routes/UI must not duplicate domain rule/lifecycle semantics.
