# Current Handoff

This file is the authoritative resume point for CatalogGuard. Repository state, CI, and live Shopify evidence take precedence over conversation memory.

## Exact state

```text
Date: 2026-09-03
Canonical repository: JeremyHennessy/CatalogGuard
Immutable main baseline SHA: 1a540cd3ea73b9b03e3830b8b9c14dc02cf0511f
Phase 1 branch: phase-1/shopify-scaffold
Phase 1 scaffold checkpoint: 86a7deeee8076cc71a3dccde762697d1db6a2543
Phase 1 PR: #11 (draft)
Phase 1 issue: #1 CLOSED — live development-store acceptance verified
Phase 2 branch: phase-2/domain-rule-engine
Phase 2 code/runtime head before this handoff: 3141e3ff5bd3e930d4f2004a81a4bb2f8c5b2195
Phase 2 PR: #12 (draft, stacked on Phase 1)
Phase 2 issue: #2 ready to close as engineering scope complete
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

Issue #1 is closed after direct development-store verification:

- CatalogGuard is installed on `catalogguard-dev-p8tpcpjw.myshopify.com`.
- Shopify reports the app requests exactly `read_products` and the installation has exactly `read_products` granted.
- The embedded React Router App Home opens successfully inside Shopify Admin.
- The app route executed authenticated Admin GraphQL against API `2026-07` and rendered real development-store products/variant counts.
- No product write, customer, or order scope was added.
- The earlier blank App Home was traced to a stale/unresolvable Cloudflare quick-tunnel hostname; a fresh dev preview loaded correctly.
- The earlier `ACCESS_DENIED` was traced to the generated local `shopify.app.development.toml` missing `read_products`; the local linked config was corrected and Shopify then granted the requested scope.

Phase 1 scaffold checkpoint `86a7deeee8076cc71a3dccde762697d1db6a2543` remains CI-green (`33774438006`). PR #11 remains draft/unmerged pending deliberate user approval of the stacked implementation.

## Phase 2 engineering scope — complete

Phase 2 now provides the framework-independent deterministic catalog policy engine plus the source/persistence boundaries needed for a real scan.

### Normalized catalog + 15 built-in rules

Normalized fields retain explicit evidence availability: `AVAILABLE`, `UNAVAILABLE`, `NOT_REQUESTED`, `UNRELIABLE`. Rule status remains `PASS`, `FAIL`, `NOT_APPLICABLE`, `UNKNOWN`; `UNKNOWN` is never coerced to PASS. Severity and blocking remain independent.

Implemented rules:

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

SKU/barcode uniqueness uses an explicit store-wide identifier index with `COMPLETE`/`PARTIAL` completeness, deterministic `EXACT`/`TRIM` normalization, and no implicit case folding.

### Policy, enforcement, lifecycle, exceptions, preflight

- immutable validated policy revisions;
- deterministic policy evaluation over registered rule versions;
- enforcement `COMPLIANT`, `VIOLATION`, `WAIVED`, `INDETERMINATE`, `NOT_APPLICABLE`;
- exact finding exceptions by shop + rule + resource/subresource;
- technical FAIL remains FAIL when enforcement is WAIVED;
- stable finding identity independent of mutable titles/SKUs;
- finding classifications `BASELINE_DEBT`, `NEW_REGRESSION`, `REOPENED_REGRESSION`, `POLICY_CHANGE_FAILURE`, `UNKNOWN_CAUSE`;
- PASS can resolve an open finding, UNKNOWN cannot falsely resolve one, and resolved failures can reopen without losing history;
- preflight `PASS`, `PASS_WITH_WAIVERS`, `FAIL`, `INDETERMINATE`.

### Evidence-preserving persistence

Prisma persistence covers `Shop`, `Policy`, immutable `PolicyRevision`, `PolicyRule`, `Scan`, `Evaluation`, `Finding`, `FindingEvent`, `RuleException`, `PreflightRun`, and `PreflightTarget`, while retaining Shopify `Session` storage.

Migration `20260903132500_add_domain_persistence` is committed. CI validates Prisma and deploys migrations onto a clean SQLite database. Canonical JSON evidence is deterministic. Policy revisions are append-only through the repository boundary. Scan/evaluation/finding/event persistence occurs transactionally with stable IDs and an immutable scan-input fingerprint; replay of an identical COMPLETE scan is idempotent and conflicting scan-ID reuse is rejected.

### Shopify source contract and verified reader

CatalogGuard uses two independent global `read_products` connections so uniqueness cannot silently operate on nested partial variants:

- product stream: identity/status/description/SEO/vendor/type/tags/category/media plus `variantsCount`;
- global variant stream: identity/SKU/barcode/price/compare-at/options plus parent product ID.

The normalizer rejects duplicate/orphan identities, sorts deterministically, reconciles every product `variantsCount`, and only marks catalog/index completeness `COMPLETE` when both streams reach their end and counts reconcile.

The exhaustive reader rejects GraphQL errors, malformed page info, missing/repeated cursors, page-limit exhaustion, and partial variant reconciliation. Connected Shopify source validation returned 17 fixture products and 26 variants with reconciled counts.

### End-to-end scan composition

The repository-green in-code path is now:

`authenticated Shopify Admin -> exhaustive product/variant read -> normalized complete catalog -> immutable policy evaluation -> transactional scan/finding persistence`

`runVerifiedCatalogPolicyScanV1` derives processed counts from the verified catalog and rejects partial evidence before persistence. `runShopifyCatalogPolicyScanV1` binds the authenticated Shopify Admin client to the transactional Prisma reconciliation repository.

## Verified permanent Quality Gate checkpoints

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
- prior Phase 2 handoff head: `3141e3ff5bd3e930d4f2004a81a4bb2f8c5b2195` / `33790944303`

All listed permanent gates passed locked install, formatting, lint, TypeScript, domain/scaffold tests, Prisma validation, clean migration deployment where applicable, and production build. Temporary branch-only formatter workflows were removed after mechanical formatting passes.

## Next phase — Phase 3 baseline onboarding + evidence dashboard

Do not auto-establish a baseline on page load. The product spec requires an explicit merchant/onboarding action before current failures become baseline debt.

Create a new branch stacked on the verified Phase 2 branch. First bounded Phase 3 slice:

1. replace the Phase 1 demo product list with a real Overview state;
2. ensure the authenticated Shopify shop is represented in the `Shop` table without inventing identity;
3. show explicit `No baseline yet` / scan state;
4. provide a clearly labelled development-validation policy path rather than silently inventing production merchant thresholds;
5. on explicit action, create/load the immutable policy revision and run `runShopifyCatalogPolicyScanV1` with `baseline=true`;
6. render persisted scan counts and current findings from Prisma evidence;
7. prove same-scan replay/idempotency and baseline finding/event persistence in tests before adding editing/waiver/preflight UI.

After this slice, add Findings drill-down, immutable policy editing, exact exception create/revoke, preflight persistence/UI, webhook/incremental refresh paired with full reconciliation, and evaluate Shopify Bulk Operations for large-catalog production scale.

## Other unresolved items

- No production host or PostgreSQL deployment is verified.
- No live baseline scan has yet been persisted from CatalogGuard itself.
- No merchant-facing policy editor, findings drill-down, waiver UI, or preflight UI exists yet.
- No webhook/incremental refresh runtime is wired to the scan service yet.
- The page reader is correct for validation; Shopify Bulk Operations should be evaluated before production large-catalog scale.
- Weight/inventory/cost rules remain deferred until exact fields/scopes are deliberately expanded.
- Locked install still reports 23 npm advisories (3 moderate, 20 high). Do not use `npm audit fix --force`; investigate dependency families separately.

## Locked product guardrails

CatalogGuard remains: **Shopify catalog policy + regression detection + exceptions + preflight QA.** It is not primarily a generic health score, SEO tool, AI copywriter, PIM, backup/revert tool, automatic bulk fixer, or workflow engine.

Rule status remains distinct from enforcement; policy revisions remain immutable for evidence; baseline debt remains distinct from later regressions; canonical evidence remains deterministic/replayable; UI/routes must not duplicate domain business logic.
