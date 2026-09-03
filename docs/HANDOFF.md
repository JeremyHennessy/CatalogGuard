# Current Handoff

This file is the authoritative resume point for CatalogGuard. Repository state, CI, and live Shopify evidence take precedence over conversation memory.

## Exact state

```text
Date: 2026-09-03
Canonical repository: JeremyHennessy/CatalogGuard
Immutable main baseline SHA: 1a540cd3ea73b9b03e3830b8b9c14dc02cf0511f
Phase 1 branch: phase-1/shopify-scaffold
Phase 1 SHA: 86a7deeee8076cc71a3dccde762697d1db6a2543
Phase 1 PR: #11 (draft)
Phase 2 branch: phase-2/domain-rule-engine
Phase 2 runtime checkpoint SHA before this handoff: 839d39e80e5be140fe3b2cd61f9d6eae0799ff2d
Phase 2 PR: #12 (draft, stacked on Phase 1)
Shopify Admin API: 2026-07 / ApiVersion.July26
Requested CatalogGuard scopes: read_products only
Shopify development store: catalogguard-dev-p8tpcpjw.myshopify.com
CatalogGuard installation handle: catalogguard-11
Last observed CatalogGuard granted scopes: []
Production deployment: none verified
```

There is **no user-approved implementation checkpoint yet**. Green CI checkpoints are implementation evidence only. `main` remains the immutable baseline until the user explicitly approves a later state or the draft PRs are deliberately merged after acceptance.

## Current phase

Phase 2 now contains the deterministic rule engine, immutable policy/lifecycle model, persistence/reconciliation layer, a Shopify `read_products` normalization adapter, an exhaustive cursor-paginated catalog reader with completeness checks, and server composition for Shopify read -> normalize -> policy evaluate -> transactional persistence.

The principal remaining blocker is live application authorization: CatalogGuard itself has not yet been observed with `read_products` granted. The connected Shopify Admin integration can validate and execute the same queries against the development store, but that is source/schema evidence only and must not be represented as proof that CatalogGuard's own installation can execute them.

## Confirmed implementation

### Phase 1 Shopify scaffold

- Shopify React Router app foundation with `shopify.web.toml` declaring frontend/backend roles.
- Admin GraphQL pinned to `2026-07`.
- Requested scope is `read_products` only; no product writes, customer scopes, or order scopes.
- Prisma Shopify session storage with refresh-token fields and expiring offline-token support.
- Uninstall and scope-update webhook handlers.
- Locked install with Node `22.12.0` in CI.
- Phase 1 Quality Gate: `33774438006` green on `86a7deeee8076cc71a3dccde762697d1db6a2543`.

### Deterministic normalized catalog and 15-rule engine

Normalized fields retain explicit evidence availability: `AVAILABLE`, `UNAVAILABLE`, `NOT_REQUESTED`, `UNRELIABLE`. Rule status remains `PASS`, `FAIL`, `NOT_APPLICABLE`, `UNKNOWN`; `UNKNOWN` is never coerced to PASS. Severity and blocking remain independent. SKU/barcode uniqueness uses an explicit `COMPLETE`/`PARTIAL` store-wide identifier index with `EXACT` or `TRIM` normalization and no implicit case folding.

Implemented rule catalog:

1. `CG-SKU-001` SKU required
2. `CG-SKU-002` SKU unique
3. `CG-BARCODE-001` barcode required
4. `CG-BARCODE-002` barcode unique
5. `CG-PRICE-001` minimum price
6. `CG-PRICE-002` compare-at relationship
7. `CG-DESC-001` normalized description minimum
8. `CG-VENDOR-001` vendor required/allow-list
9. `CG-TYPE-001` product type required/allow-list
10. `CG-MEDIA-001` minimum media count
11. `CG-SEO-001` SEO title requirement
12. `CG-SEO-002` SEO description requirement
13. `CG-CAT-001` Shopify category requirement
14. `CG-TAG-001` required tags with exact ALL/ANY semantics
15. `CG-OPT-001` required variant option names

No extra Shopify scope was added for this rule catalog.

### Policy, enforcement, findings, exceptions, and preflight

- Immutable validated policy revisions.
- Deterministic policy evaluation over registered rule versions.
- Enforcement dispositions: `COMPLIANT`, `VIOLATION`, `WAIVED`, `INDETERMINATE`, `NOT_APPLICABLE`.
- Exact V1 exceptions by shop + rule + resource/subresource and recorded create/expiry/revoke time.
- A technical FAIL remains FAIL when enforcement is WAIVED.
- Stable finding identity excludes mutable titles/SKUs.
- Finding classifications: `BASELINE_DEBT`, `NEW_REGRESSION`, `REOPENED_REGRESSION`, `POLICY_CHANGE_FAILURE`, `UNKNOWN_CAUSE`.
- PASS can resolve an open finding; UNKNOWN cannot falsely resolve one; resolved failures can reopen without erasing history.
- Preflight outcomes: `PASS`, `PASS_WITH_WAIVERS`, `FAIL`, `INDETERMINATE`.

Golden domain tests cover baseline debt, new regression, resolution, reopen, exception create/expiry/revocation, policy-change failure, UNKNOWN recovery, reconciliation equivalence, and blocking preflight precedence.

### Persistence and transactional reconciliation

Prisma persistence covers `Shop`, `Policy`, immutable `PolicyRevision`, `PolicyRule`, `Scan`, `Evaluation`, `Finding`, `FindingEvent`, `RuleException`, `PreflightRun`, and `PreflightTarget` while retaining Shopify `Session` storage.

Migration `20260903132500_add_domain_persistence` is committed. CI deletes the development SQLite database and runs `prisma migrate deploy` from a clean database, so schema validation alone is not treated as migration proof.

The immutable policy repository supports create/append/activate/read only and stores canonical deterministic JSON evidence. The scan reconciliation repository persists scan creation, evaluations, findings, finding events, exact exception linkage, aggregate counts, and completion inside one Prisma transaction. Replaying a COMPLETE scan with the same immutable fingerprint is idempotent; a conflicting reused scan ID is rejected.

### Shopify catalog source contract and normalization adapter

Two independent global connections are used so completeness is not hidden behind nested per-product variant limits:

- `CatalogGuardProducts`: product identity/status/description/SEO/vendor/type/tags/category/media count plus `variantsCount` and cursor `pageInfo`.
- `CatalogGuardVariants`: global variant identity/SKU/barcode/price/compare-at/options plus parent product ID and cursor `pageInfo`.

Both exact queries were schema-validated against Shopify and require only `read_products`.

The pure normalizer:

- rejects duplicate product/variant GIDs;
- rejects an orphan variant when the product stream is complete;
- sorts products/variants deterministically by GID;
- maps the Shopify response into the existing normalized evidence model;
- reconciles each product's `variantsCount` against the global variant stream;
- marks the identifier index `COMPLETE` only when both connections reached the end and every product variant count reconciles;
- otherwise returns `PARTIAL`, never a false complete catalog.

Live source validation through the connected Shopify Admin integration returned 17 fixture products and 26 variants with `hasNextPage=false` and reconciled product variant counts. This proves the field shapes and fixture data, **not** CatalogGuard's own authorization.

Adapter checkpoint: `91250ae2046674f494ca728b66875cf15eba1d5c`, permanent Quality Gate `33789213953` green.

### Verified cursor-paginated Shopify reader

`readVerifiedShopifyCatalogV1` pages the product and global variant connections independently to completion. It rejects GraphQL errors, missing data/pageInfo, `hasNextPage=true` without a cursor, repeated cursor loops, max-page exhaustion, and any catalog whose `variantsCount` reconciliation remains partial. A successful return therefore means the current page-based reader has proven catalog completeness for that run.

A thin Shopify server adapter wraps `admin.graphql()` without putting Shopify client calls in domain rule code.

Reader checkpoint: `7f55310637c9c351d730d5d7df619856e7ceeac1`, permanent Quality Gate `33789863128` green.

### Verified scan orchestration and server composition

`runVerifiedCatalogPolicyScanV1` now composes a verified normalized catalog with the exact immutable policy revision, the catalog's identifier index, explicit recorded scan/evaluation times, exact exceptions, and the transactional scan repository. Product/variant processed counts are derived from the verified catalog rather than caller guesses. Partial catalog evidence is rejected before persistence.

`runShopifyCatalogPolicyScanV1` is the thin server composition binding the Shopify Admin catalog reader to `PrismaScanReconciliationRepository`. This creates the in-code path:

`Shopify Admin read -> complete pagination -> normalize -> evaluate immutable policy -> transactional scan/finding persistence`.

Application orchestration checkpoint: `3dc27fa035ce8659f58942ef6ae4bf8bd61e5b4b`, Quality Gate `33790470091` green.
Server composition checkpoint: `839d39e80e5be140fe3b2cd61f9d6eae0799ff2d`, Quality Gate `33790689737` green.

All permanent gates above include locked install, formatting, lint, TypeScript typecheck, tests, Prisma validation, clean migration deployment where applicable, and production build. Temporary branch-only formatter workflows were removed after each mechanical formatting pass.

## Live Shopify acceptance blocker

CatalogGuard is installed on `catalogguard-dev-p8tpcpjw.myshopify.com` as `catalogguard-11`, but the last inspected installation state reported `accessScopes: []`. Therefore no claim may be made that CatalogGuard itself has executed the new reader or full scan live.

Next external acceptance action:

```powershell
cd C:\Users\JeremyHennessy\CatalogGuard
git pull --ff-only
shopify app dev --config development --store catalogguard-dev-p8tpcpjw.myshopify.com
```

Keep the dev process running and accept the development app/permission update. Then verify that CatalogGuard itself has `read_products`, open the embedded App Home, and execute the same product/variant field shapes through CatalogGuard's authenticated Admin client.

## Other unresolved items

- No production host or PostgreSQL deployment is verified.
- No live baseline scan has been persisted from CatalogGuard's own Shopify installation.
- No merchant-facing policy creation/editor, scan dashboard, findings drill-down, waiver UI, or preflight UI exists yet.
- No webhook/incremental refresh runtime is wired to the new scan service yet; webhook detection must eventually be paired with full reconciliation.
- The current exhaustive cursor reader is appropriate for correctness/dev validation; production large-catalog scale should still evaluate Shopify Bulk Operations rather than assuming page-by-page reads are the final architecture.
- Weight/inventory/cost rules remain deferred until exact fields/scopes are verified for CatalogGuard itself.
- A locked install still reports 23 npm advisories (3 moderate, 20 high). Do not use `npm audit fix --force`; investigate dependency families independently.

## Repository-green evidence checkpoints

These are evidence points, not user approvals:

- Phase 1 scaffold: `86a7deeee8076cc71a3dccde762697d1db6a2543` / `33774438006`
- Phase 2 15-rule core: `a547661bdbb3f017b911f781cee2ba270c50fa8d` / `33769657000`
- policy/lifecycle: `49dd4f6e49109cb5f3483238e17806df083a8950` / `33777845329`
- persistence schema: `22b8104c9a191c4b69c6edca4556500461d058ed` / `33779041352`
- immutable policy repository: `ea0f31f4f555c65aa1b045582ecef1b96fda8acf` / `33780093645`
- transactional reconciliation: `8c7f0485e483f42d1e35591431eb3ef0042e8b03` / `33780961563`
- Shopify normalization adapter: `91250ae2046674f494ca728b66875cf15eba1d5c` / `33789213953`
- verified Shopify reader: `7f55310637c9c351d730d5d7df619856e7ceeac1` / `33789863128`
- scan orchestration: `3dc27fa035ce8659f58942ef6ae4bf8bd61e5b4b` / `33790470091`
- server runtime composition: `839d39e80e5be140fe3b2cd61f9d6eae0799ff2d` / `33790689737`

## Next engineering work

After live `read_products` acceptance, use the existing runtime to perform a real CatalogGuard-authenticated source read and prove the normalized counts/completeness. Then:

1. create/load an initial persisted policy revision and exact active exceptions through the repository boundary;
2. run and persist the first live baseline scan through `runShopifyCatalogPolicyScanV1`;
3. verify replay/idempotency and persisted finding/event evidence against the live fixture catalog;
4. build the first merchant dashboard from persisted scan/finding data: scan summary, blocking violations, baseline debt/regressions, UNKNOWN state, waivers, and evidence drill-down;
5. add policy editing as immutable new revisions rather than in-place mutation;
6. add exact exception create/revoke UI and preflight persistence/UI;
7. add webhook/incremental refresh with periodic reconciliation;
8. evaluate Shopify Bulk Operations before treating the page reader as the production large-catalog strategy.

## Locked product guardrails

CatalogGuard remains: **Shopify catalog policy + regression detection + exceptions + preflight QA.** It is not primarily a generic health score, SEO tool, AI copywriter, PIM, backup/revert tool, automatic bulk fixer, or workflow engine.

Rule status remains distinct from enforcement; policy revisions remain immutable for evidence; baseline debt remains distinct from later regressions; canonical persisted evidence remains deterministic/replayable; UI/routes must not duplicate domain business logic.
