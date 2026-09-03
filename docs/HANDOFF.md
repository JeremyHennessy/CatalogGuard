# Current Handoff

This file is the current-state resume point. Update it after meaningful merges/releases/checkpoints.

## Exact state

```text
Date/time: 2026-09-03 13:19 ADT
Canonical repository: JeremyHennessy/CatalogGuard
Immutable main baseline SHA: 1a540cd3ea73b9b03e3830b8b9c14dc02cf0511f
Phase 1 branch: phase-1/shopify-scaffold
Phase 1 SHA: 86a7deeee8076cc71a3dccde762697d1db6a2543
Phase 1 PR: #11 (draft)
Active Phase 2 branch: phase-2/domain-rule-engine
Phase 2 verified code/checkpoint SHA: 49dd4f6e49109cb5f3483238e17806df083a8950
Phase 2 PR: #12 (draft, stacked on Phase 1)
Shopify API version: 2026-07 / ApiVersion.July26
Requested CatalogGuard Shopify scopes: read_products only
Development DB: Prisma + SQLite session storage only; domain persistence is not implemented yet
Deployment: none verified
Shopify development store: catalogguard-dev-p8tpcpjw.myshopify.com
CatalogGuard installation handle: catalogguard-11
CatalogGuard granted scopes observed on dev store: []
Phase 1 CI: run 33774438006 — success on 86a7deeee8076cc71a3dccde762697d1db6a2543
Phase 2 policy/lifecycle CI: run 33777845329 — success on 49dd4f6e49109cb5f3483238e17806df083a8950
```

## Current phase

**Phase 2 — normalized catalog + deterministic rule engine + policy/lifecycle domain contracts**, stacked on an unmerged Phase 1 Shopify scaffold.

The domain layer now covers the first 15 deterministic catalog rules plus policy-revision validation, deterministic policy orchestration, enforcement dispositions, exact exceptions, finding identity/lifecycle, and preflight aggregation. The next dependency-safe engineering phase is persistence/schema work for those verified contracts.

Phase 1 repository work is CI-green but live Shopify acceptance is still incomplete. CatalogGuard is installed on the development store, but Shopify currently reports no granted scopes for the CatalogGuard installation. Do not call Phase 1 complete until CatalogGuard itself has `read_products` and its embedded React Router App Home is proven live.

## What is confirmed working

### Phase 1 repository foundation

Evidence-backed behavior on `phase-1/shopify-scaffold`:

- Shopify React Router app foundation exists.
- `shopify.web.toml` explicitly declares the React Router process as both `frontend` and `backend`; a scaffold regression test protects this descriptor.
- GraphQL Admin API is pinned to `2026-07` in application and codegen configuration.
- Local Shopify configuration requests only `read_products`.
- The authenticated app route contains a read-only product/variant GraphQL query and no product mutation.
- Shopify session storage uses Prisma with refresh-token fields and expiring offline-token support enabled through the official Shopify application package.
- Uninstall and app-scope-update webhook handlers are present.
- `.env.example` contains placeholders only.
- `package-lock.json` is committed and the permanent quality gate uses `npm ci`.
- Node is fixed to `22.12.0` in CI.
- React Router packages are aligned at `7.18.3` and Vite at `7.3.6` after direct non-major security fixes.
- Phase 1 Quality Gate run `33774438006` completed successfully on SHA `86a7deeee8076cc71a3dccde762697d1db6a2543`.

### Phase 2 normalized catalog and rule engine

- Versioned normalized Product/Variant evaluation model exists.
- Evidence-bearing fields use explicit `AVAILABLE`, `UNAVAILABLE`, `NOT_REQUESTED`, and `UNRELIABLE` states.
- Rule results retain `PASS`, `FAIL`, `NOT_APPLICABLE`, and `UNKNOWN`; `UNKNOWN` is never treated as PASS.
- Severity and blocking remain independent policy metadata.
- Product scope evaluation distinguishes `MATCH`, `NO_MATCH`, and `UNKNOWN`.
- SKU/barcode uniqueness uses an explicit store-wide identifier-index abstraction with `COMPLETE`/`PARTIAL` completeness.
- Identifier normalization is explicit (`EXACT` or `TRIM`) with no implicit case folding.
- Decimal price comparisons use deterministic string comparison rather than floating-point coercion.
- Rule implementation exceptions degrade to `UNKNOWN`, never false PASS/FAIL.
- Domain tests compile separately and run in the permanent `npm test` gate.

Deterministic rule catalog:

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

### Phase 2 policy, enforcement, lifecycle, and preflight contracts

Verified on Phase 2 SHA `49dd4f6e49109cb5f3483238e17806df083a8950`:

- `PolicyRevisionInputV1` and `ValidatedPolicyRevisionV1` provide versioned policy-revision contracts.
- Policy revision validation resolves registered rule definitions, validates every rule config/scope, rejects duplicate `ruleCode@version` entries, and freezes the validated revision/rule containers.
- `evaluatePolicyRevisionV1` evaluates products and variants in deterministic GID order against the exact revision ID.
- Enforcement remains separate from technical rule status:
  - PASS -> `COMPLIANT`
  - FAIL -> `VIOLATION`
  - FAIL + active exact exception -> `WAIVED`
  - UNKNOWN -> `INDETERMINATE`
  - NOT_APPLICABLE -> `NOT_APPLICABLE`
- Exact V1 exceptions match shop + rule + resource + exact subresource identity; expiration/revocation affects enforcement only and never rewrites technical FAIL to PASS.
- Stable finding identity excludes mutable titles/SKUs and is based on shop + rule + resource/subresource identity.
- Finding lifecycle supports `BASELINE_DEBT`, `NEW_REGRESSION`, `REOPENED_REGRESSION`, `POLICY_CHANGE_FAILURE`, and `UNKNOWN_CAUSE`.
- PASS resolves an open finding while preserving first-seen history; UNKNOWN does not falsely resolve debt; resolved failures can reopen with preserved history.
- `reconcileFindingsV1` provides deterministic batch reconciliation and tests equivalence with incremental application.
- Preflight aggregation implements the locked precedence: blocking violation -> `FAIL`; otherwise blocking indeterminate -> `INDETERMINATE`; otherwise blocking waiver -> `PASS_WITH_WAIVERS`; otherwise `PASS`.
- Non-blocking issues are counted but do not fail preflight.

Golden lifecycle/domain tests now cover baseline debt, new regression, resolution, reopened regression, active/expired/revoked exception behavior, policy-threshold change classification, UNKNOWN recovery, full-vs-incremental reconciliation equivalence, and preflight blocking semantics.

Permanent Quality Gate run `33777845329` completed successfully on final head `49dd4f6e49109cb5f3483238e17806df083a8950` with:

- locked dependency install;
- formatting;
- lint;
- TypeScript typecheck;
- combined scaffold + domain tests;
- Prisma generation/schema validation;
- production React Router build.

## Live Shopify evidence

Confirmed externally against `catalogguard-dev-p8tpcpjw.myshopify.com`:

- The development store exists and contains Shopify-generated catalog fixtures.
- The connected Shopify Admin integration can schema-validate and execute the `productVariants` query shape required by CatalogGuard and return real product variants, proving the store/schema/data are healthy.
- `appInstallations` shows a distinct installed CatalogGuard app with handle `catalogguard-11`.
- That CatalogGuard installation currently reports `accessScopes: []`.
- The earlier CatalogGuard CLI `app execute` failure (`ACCESS_DENIED` for `productVariants`) is therefore explained by missing granted scope on CatalogGuard itself, not by an invalid GraphQL shape or missing product data.
- The Shopify merchant Admin API can revoke scopes but does not provide a mechanism for one installed app to grant another app new scopes. CatalogGuard's `read_products` grant still has to pass through CatalogGuard's own Shopify CLI/OAuth/dev-preview installation flow.

## What is not verified

### Shopify live acceptance

- CatalogGuard itself has not yet been observed with `read_products` granted on the development store.
- The embedded React Router App Home has not yet been revalidated after the `shopify.web.toml` scaffold fix.
- CatalogGuard's own authenticated product/variant request has therefore not yet succeeded live.
- Session/offline-token refresh behavior has not been exercised against Shopify.
- Normalized Shopify adapter mappings beyond the existing Phase 1 source probe are not yet live-verified.

### Persistence/product runtime

- No production host or production PostgreSQL database is verified.
- Policy, PolicyRevision, PolicyRule, Evaluation, Finding, FindingEvent, Exception, Preflight, and normalized catalog state are not persisted yet.
- The policy/lifecycle contracts are domain-only at this checkpoint.
- No scan/reconciliation runtime has been wired to persistence or Shopify webhooks yet.
- No polished rule/policy dashboard is implemented.
- No billing integration or App Store submission is verified.

### Dependency advisories

A post-patch locked install reports `23` npm advisories (`3 moderate`, `20 high`), reduced from `30` before the direct React Router/Vite security updates. Remaining Prisma/codegen/TypeScript-ESLint/tooling audit suggestions require separate compatibility analysis and must not be force-applied with `npm audit fix --force`.

## Latest approved checkpoint

There is **no user-approved implementation checkpoint yet** for either Phase 1 or Phase 2 code.

The immutable repository baseline remains `main` SHA `1a540cd3ea73b9b03e3830b8b9c14dc02cf0511f` until the user explicitly approves an implementation state or the relevant PRs are deliberately merged after acceptance evidence.

Repository-green implementation checkpoints are evidence points, not user approvals:

- Phase 1 Shopify scaffold + web descriptor: `86a7deeee8076cc71a3dccde762697d1db6a2543`
- Phase 2 10-rule core: `1ff4ee9f559838e8e4d096c7f4cf984241bb1fc3`
- Phase 2 15-rule core: `a547661bdbb3f017b911f781cee2ba270c50fa8d`
- Phase 2 policy/lifecycle contracts: `49dd4f6e49109cb5f3483238e17806df083a8950`

## Current blockers

### B1 — CatalogGuard live permission/app-home acceptance

The Dev store and CatalogGuard installation now exist, but CatalogGuard currently has no granted scopes. The next external acceptance action remains:

```powershell
cd C:\Users\JeremyHennessy\CatalogGuard
git pull --ff-only
shopify app dev --config development --store catalogguard-dev-p8tpcpjw.myshopify.com
```

Keep the dev process running, accept the development URL/permission update, then verify through Shopify that CatalogGuard has `read_products` and that the embedded React Router App Home loads.

### B2 — Remaining dependency advisories need separate compatibility work

Do not run `npm audit fix --force`. Investigate remaining dependency families independently after preserving green checkpoints.

## Next engineering work

The domain contracts required before persistence are now green. Continue in bounded slices:

1. design Prisma persistence for Policy, immutable PolicyRevision/PolicyRule snapshots, Evaluation, Finding, FindingEvent, exact Exception, and PreflightRun/PreflightTarget while preserving the verified domain semantics;
2. make the migration reproducible from a clean database and test uniqueness/index constraints, especially stable finding identity and immutable policy revision numbering;
3. add repository/store abstractions so domain code remains free of Prisma calls and route/UI business logic;
4. persist evaluation/finding transitions transactionally, including reopen history and exception linkage;
5. add a deterministic full-reconciliation application service and verify replay/idempotency against persisted state;
6. only then add Shopify adapter mapping from Admin GraphQL into the normalized Product/Variant model and run it against the Dev-store fixture catalog;
7. wire a first useful merchant-facing scan/policy dashboard after persistence and live adapter behavior are verified;
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

## Resume warning

Do not use conversation memory alone to determine current CatalogGuard state. Repository files, Git history, PRs, CI, Shopify dev-store behavior, and deployment evidence are authoritative for implementation status.
