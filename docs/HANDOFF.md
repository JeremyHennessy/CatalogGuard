# Current Handoff

This file is the current-state resume point. Update it after meaningful merges/releases/checkpoints.

## Exact state

```text
Date/time: 2026-09-03 13:50 ADT
Canonical repository: JeremyHennessy/CatalogGuard
Immutable main baseline SHA: 1a540cd3ea73b9b03e3830b8b9c14dc02cf0511f
Phase 1 branch: phase-1/shopify-scaffold
Phase 1 SHA: 86a7deeee8076cc71a3dccde762697d1db6a2543
Phase 1 PR: #11 (draft)
Active Phase 2 branch: phase-2/domain-rule-engine
Phase 2 verified code/checkpoint SHA: 8c7f0485e483f42d1e35591431eb3ef0042e8b03
Phase 2 PR: #12 (draft, stacked on Phase 1)
Shopify API version: 2026-07 / ApiVersion.July26
Requested CatalogGuard Shopify scopes: read_products only
Development DB: Prisma + SQLite with session storage and domain persistence schema
Deployment: none verified
Shopify development store: catalogguard-dev-p8tpcpjw.myshopify.com
CatalogGuard installation handle: catalogguard-11
CatalogGuard granted scopes observed on dev store: []
Phase 1 CI: run 33774438006 — success on 86a7deeee8076cc71a3dccde762697d1db6a2543
Phase 2 policy/lifecycle CI: run 33777845329 — success on 49dd4f6e49109cb5f3483238e17806df083a8950
Phase 2 persistence-schema CI: run 33779041352 — success on 22b8104c9a191c4b69c6edca4556500461d058ed
Phase 2 policy-repository CI: run 33780093645 — success on ea0f31f4f555c65aa1b045582ecef1b96fda8acf
Phase 2 reconciliation-persistence CI: run 33780961563 — success on 8c7f0485e483f42d1e35591431eb3ef0042e8b03
```

## Current phase

**Phase 2 — deterministic catalog policy engine with evidence-preserving persistence and reconciliation**, stacked on an unmerged Phase 1 Shopify scaffold.

The repository now contains the 15-rule normalized catalog engine, immutable policy revision contracts, enforcement/exception semantics, finding lifecycle, preflight aggregation, a reproducible Prisma persistence schema, immutable policy repository boundaries, and a transactional scan/evaluation/finding reconciliation repository.

The next dependency-safe engineering phase is the Shopify Admin GraphQL -> normalized catalog adapter and fixture-backed source validation. Merchant-facing UI should follow verified adapter behavior rather than duplicate Shopify mapping logic in routes.

Phase 1 repository work is CI-green but live Shopify acceptance is still incomplete. CatalogGuard is installed on the development store, but Shopify currently reports no granted scopes for the CatalogGuard installation. Do not call Phase 1 complete until CatalogGuard itself has `read_products` and its embedded React Router App Home is proven live.

## What is confirmed working

### Phase 1 Shopify scaffold

- Shopify React Router app foundation exists.
- `shopify.web.toml` explicitly declares the React Router process as both `frontend` and `backend`; a scaffold regression test protects this descriptor.
- GraphQL Admin API is pinned to `2026-07` in application and codegen configuration.
- Local Shopify configuration requests only `read_products`.
- The authenticated app route contains a read-only product/variant GraphQL query and no product mutation.
- Shopify session storage uses Prisma with refresh-token fields and expiring offline-token support enabled through the official Shopify application package.
- Uninstall and app-scope-update webhook handlers are present.
- `.env.example` contains placeholders only.
- `package-lock.json` is committed and CI uses `npm ci` with Node `22.12.0`.
- React Router packages are aligned at `7.18.3` and Vite at `7.3.6` after direct non-major security fixes.
- Phase 1 Quality Gate run `33774438006` completed successfully on SHA `86a7deeee8076cc71a3dccde762697d1db6a2543`.

### Phase 2 normalized catalog and 15-rule engine

- Versioned normalized Product/Variant evaluation model exists.
- Evidence-bearing fields use explicit `AVAILABLE`, `UNAVAILABLE`, `NOT_REQUESTED`, and `UNRELIABLE` states.
- Rule results retain `PASS`, `FAIL`, `NOT_APPLICABLE`, and `UNKNOWN`; `UNKNOWN` is never treated as PASS.
- Severity and blocking remain independent policy metadata.
- Product scope evaluation distinguishes `MATCH`, `NO_MATCH`, and `UNKNOWN`.
- SKU/barcode uniqueness uses an explicit store-wide identifier index with `COMPLETE`/`PARTIAL` completeness.
- Identifier normalization is explicit (`EXACT` or `TRIM`) with no implicit case folding.
- Decimal price comparisons use deterministic string comparison rather than floating-point coercion.
- Rule implementation exceptions degrade to `UNKNOWN`, never false PASS/FAIL.

Rule catalog:

1. `CG-SKU-001` — SKU required
2. `CG-SKU-002` — SKU unique
3. `CG-BARCODE-001` — barcode required
4. `CG-BARCODE-002` — barcode unique
5. `CG-PRICE-001` — minimum price
6. `CG-PRICE-002` — compare-at relationship
7. `CG-DESC-001` — normalized description minimum length
8. `CG-VENDOR-001` — vendor required + optional exact allow-list
9. `CG-TYPE-001` — product type required + optional exact allow-list
10. `CG-MEDIA-001` — minimum media count
11. `CG-SEO-001` — SEO title required/minimum length
12. `CG-SEO-002` — SEO description required/minimum length
13. `CG-CAT-001` — Shopify category required
14. `CG-TAG-001` — exact required-tag policy with explicit ALL/ANY matching
15. `CG-OPT-001` — required variant option names

No additional Shopify scope was introduced for the 10→15 rule expansion.

### Policy, enforcement, lifecycle, and preflight contracts

Verified on policy/lifecycle checkpoint `49dd4f6e49109cb5f3483238e17806df083a8950`:

- Versioned, validated immutable policy-revision domain contracts.
- Deterministic policy orchestration over the rule registry.
- Enforcement remains separate from technical rule status:
  - PASS -> `COMPLIANT`
  - FAIL -> `VIOLATION`
  - FAIL + active exact exception -> `WAIVED`
  - UNKNOWN -> `INDETERMINATE`
  - NOT_APPLICABLE -> `NOT_APPLICABLE`
- Exact exceptions match shop + rule + resource + exact subresource; expiration/revocation affects enforcement only.
- Stable finding identity excludes mutable titles/SKUs.
- Finding lifecycle supports `BASELINE_DEBT`, `NEW_REGRESSION`, `REOPENED_REGRESSION`, `POLICY_CHANGE_FAILURE`, and `UNKNOWN_CAUSE`.
- PASS resolves an open finding while preserving first-seen history; UNKNOWN does not falsely resolve debt; resolved failures can reopen.
- Full reconciliation is deterministic and tested for equivalence with incremental application.
- Preflight precedence is blocking violation -> `FAIL`; otherwise blocking indeterminate -> `INDETERMINATE`; otherwise blocking waiver -> `PASS_WITH_WAIVERS`; otherwise `PASS`.

### Persistence schema and migration reproducibility

Verified on persistence checkpoint `22b8104c9a191c4b69c6edca4556500461d058ed`:

- Prisma models now exist for `Shop`, `Policy`, immutable `PolicyRevision`, `PolicyRule`, `Scan`, `Evaluation`, `Finding`, `FindingEvent`, `RuleException`, `PreflightRun`, and `PreflightTarget`, while preserving Shopify `Session` storage.
- Evidence-oriented relations use restrictive deletion semantics rather than broad cascades.
- Key constraints include:
  - unique `(policyId, revisionNumber)`;
  - unique `(policyRevisionId, ruleCode, ruleVersion)`;
  - unique `(shopId, findingKey)`;
  - unique preflight scan and target identities.
- Migration `20260903132500_add_domain_persistence` is committed with SQLite migration lock.
- Permanent CI now deletes the development SQLite database and runs `prisma migrate deploy` from a clean database before build.
- Quality Gate run `33779041352` passed locked install, formatting, lint, TypeScript, tests, Prisma validation, clean migration deployment, and build.

### Immutable policy repository boundary

Verified on checkpoint `ea0f31f4f555c65aa1b045582ecef1b96fda8acf`:

- Canonical JSON serialization recursively sorts object keys, preserves array order, rejects non-JSON/non-finite/circular values, and validates canonical persisted JSON on read.
- Validated policy revisions map to deterministic persistence snapshots and reconstruct back into `PolicyRevisionInputV1` for revalidation.
- `PolicyRepository` exposes create, append, activate, and read operations only; there is no revision update/delete API.
- `PrismaPolicyRepository` creates the initial revision transactionally, enforces revision 1 for policy creation, requires strict next-revision numbering on append, and validates that an activated revision belongs to the target policy.
- Rule config/scope evidence is stored canonically with explicit deterministic position.
- Quality Gate run `33780093645` passed all permanent checks including clean migration deployment.

### Transactional scan/evaluation/finding reconciliation persistence

Verified on current checkpoint `8c7f0485e483f42d1e35591431eb3ef0042e8b03`:

- `buildScanPersistencePlanV1` deterministically sorts evaluation input and produces stable scan fingerprints, evaluation IDs, finding IDs, and finding-event IDs.
- Persistence planning calls the already-tested `reconcileFindingsV1`; lifecycle semantics are not duplicated in SQL or routes.
- Scan fingerprints include immutable scan metadata, evaluation evidence, baseline mode, and change-cause inputs so reuse of the same scan ID with different immutable input is rejected.
- `PrismaScanReconciliationRepository` executes scan creation, evaluation evidence, finding transitions, finding events, exact exception linkage, counters, and scan completion in one Prisma transaction.
- Existing COMPLETE scans with the same immutable fingerprint are treated as already persisted; conflicting or incomplete reused scan IDs are rejected rather than silently overwritten.
- Every evaluation must resolve to a rule in the exact persisted policy revision.
- Persisted exception IDs are checked for exact shop/rule/resource/subresource identity before linkage.
- Existing findings must retain deterministic IDs; unexpected identity drift is treated as corruption rather than rewritten.
- Tests verify plan determinism independent of evaluation input order, fingerprint sensitivity, resolution planning, and policy-revision mismatch rejection.
- Quality Gate run `33780961563` passed formatting, lint, TypeScript, tests, Prisma validation, clean migration deployment, and production build.

## Live Shopify evidence

Confirmed externally against `catalogguard-dev-p8tpcpjw.myshopify.com`:

- The development store exists and contains Shopify-generated catalog fixtures.
- The connected Shopify Admin integration can schema-validate and execute the `productVariants` query shape required by CatalogGuard and return real product variants, proving the store/schema/data are healthy.
- `appInstallations` shows a distinct installed CatalogGuard app with handle `catalogguard-11`.
- That CatalogGuard installation currently reports `accessScopes: []`.
- The earlier CatalogGuard CLI `app execute` failure (`ACCESS_DENIED` for `productVariants`) is explained by missing granted scope on CatalogGuard itself, not by an invalid GraphQL shape or missing product data.
- The merchant Admin API cannot grant another app new scopes; CatalogGuard's `read_products` grant still has to pass through CatalogGuard's own CLI/OAuth/dev-preview installation flow.

## What is not verified / not implemented

### Shopify live acceptance

- CatalogGuard itself has not yet been observed with `read_products` granted on the development store.
- The embedded React Router App Home has not yet been revalidated after the `shopify.web.toml` scaffold fix.
- CatalogGuard's own authenticated product/variant request has not yet succeeded live.
- Session/offline-token refresh behavior has not been exercised live.
- The full Shopify Admin GraphQL -> normalized `Product`/`Variant` adapter is not yet implemented or validated against the fixture catalog.

### Product runtime/UI

- No production host or production PostgreSQL database is verified.
- No production scan trigger/reconciliation scheduler/webhook runtime is wired yet.
- Exact exception create/revoke application services and preflight persistence services are not yet wired.
- No merchant-facing policy/rule/findings dashboard is implemented yet.
- No billing integration or App Store submission is verified.

### Dependency advisories

A locked install reports `23` npm advisories (`3 moderate`, `20 high`), reduced from `30` before the direct React Router/Vite security updates. Remaining Prisma/codegen/TypeScript-ESLint/tooling audit suggestions require separate compatibility analysis and must not be force-applied with `npm audit fix --force`.

## Latest approved checkpoint

There is **no user-approved implementation checkpoint yet** for either Phase 1 or Phase 2 code.

The immutable repository baseline remains `main` SHA `1a540cd3ea73b9b03e3830b8b9c14dc02cf0511f` until the user explicitly approves an implementation state or the relevant PRs are deliberately merged after acceptance evidence.

Repository-green implementation checkpoints are evidence points, not user approvals:

- Phase 1 Shopify scaffold + web descriptor: `86a7deeee8076cc71a3dccde762697d1db6a2543`
- Phase 2 15-rule core: `a547661bdbb3f017b911f781cee2ba270c50fa8d`
- Phase 2 policy/lifecycle contracts: `49dd4f6e49109cb5f3483238e17806df083a8950`
- Phase 2 persistence schema: `22b8104c9a191c4b69c6edca4556500461d058ed`
- Phase 2 immutable policy repository: `ea0f31f4f555c65aa1b045582ecef1b96fda8acf`
- Phase 2 transactional reconciliation persistence: `8c7f0485e483f42d1e35591431eb3ef0042e8b03`

## Current blockers

### B1 — CatalogGuard live permission/app-home acceptance

The Dev store and CatalogGuard installation exist, but CatalogGuard currently has no granted scopes. The next external acceptance action remains:

```powershell
cd C:\Users\JeremyHennessy\CatalogGuard
git pull --ff-only
shopify app dev --config development --store catalogguard-dev-p8tpcpjw.myshopify.com
```

Keep the dev process running, accept the development URL/permission update, then verify through Shopify that CatalogGuard has `read_products` and the embedded React Router App Home loads.

### B2 — Remaining dependency advisories need separate compatibility work

Do not run `npm audit fix --force`. Investigate remaining dependency families independently after preserving green checkpoints.

## Next engineering work

Continue in bounded slices from the current green checkpoint:

1. define the Shopify Admin GraphQL catalog query needed by the 15-rule normalized model using only fields justified by `read_products`;
2. build a pure Shopify response -> `NormalizedProductV1`/`NormalizedVariantV1` adapter that represents absent/unavailable data explicitly rather than inventing values;
3. schema-validate the query and run the same field shape against the connected Dev-store fixture catalog, while clearly distinguishing Shopify-plugin evidence from CatalogGuard's still-ungranted scope;
4. add store-wide pagination/identifier-index construction with completeness tracking so uniqueness rules cannot claim PASS on partial catalogs;
5. wire a bounded full-scan application service: Shopify fetch -> normalized catalog -> policy evaluation -> transactional persistence;
6. then build the first merchant-facing dashboard for scan summary, blocking violations, baseline debt/regressions, UNKNOWN state, waivers, and evidence drill-down;
7. wire exception create/revoke and preflight persistence only after the dashboard reads the persisted model correctly;
8. defer weight/inventory/cost rules until exact fields/scopes are verified for CatalogGuard itself;
9. keep PR #12 draft and do not merge ahead of Phase 1/live acceptance.

## Product definition locked at baseline

CatalogGuard is:

> Shopify catalog policy + regression detection + exceptions + preflight QA.

CatalogGuard is **not** primarily a generic health score, SEO tool, AI copywriter, PIM, catalog backup/revert product, automatic bulk fixer, or workflow engine.

## Core semantic guardrails

- Rule results remain `PASS`, `FAIL`, `NOT_APPLICABLE`, and `UNKNOWN`.
- `UNKNOWN` is never silently treated as PASS.
- Severity and policy blocking are separate concepts.
- Active waivers change enforcement disposition but do not rewrite a failed rule evaluation as PASS.
- Policy revisions are immutable for historical evidence.
- Baseline debt remains distinct from later regressions.
- Policy-created failures remain distinct from data regressions where evidence allows.
- Preflight supports `PASS`, `PASS_WITH_WAIVERS`, `FAIL`, and `INDETERMINATE`.
- Webhook detection must be paired with reconciliation.
- Persistence adapters must not leak into framework-independent domain rule logic.
- Canonical persisted evidence must be deterministic and replayable.

## Resume warning

Do not use conversation memory alone to determine current CatalogGuard state. Repository files, Git history, PRs, CI, Shopify dev-store behavior, and deployment evidence are authoritative for implementation status.
