# Current Handoff

This file is the current-state resume point. Update it after meaningful merges/releases/checkpoints.

## Exact state

```text
Date/time: 2026-09-03 11:49 ADT
Canonical repository: JeremyHennessy/CatalogGuard
Main SHA: 1a540cd3ea73b9b03e3830b8b9c14dc02cf0511f
Phase 1 branch: phase-1/shopify-scaffold
Phase 1 SHA: 7c7172a91495ac0079381ca0ec5d3ad1a7434704
Phase 1 PR: #11 (draft) — Shopify scaffold + development-store verification
Active Phase 2 branch: phase-2/domain-rule-engine
Phase 2 verified SHA before this handoff update: 1ff4ee9f559838e8e4d096c7f4cf984241bb1fc3
Phase 2 PR: #12 (draft, stacked on Phase 1)
Shopify API version: 2026-07 / ApiVersion.July26
Requested Shopify scopes: read_products only
DB migration: prisma/migrations/20240530213853_create_session_table/migration.sql
Development DB: Prisma + SQLite session storage
Deployment: none verified
Shopify app/config: not linked to a real app; checked-in shopify.app.toml client_id remains empty
Phase 1 CI: run 33766588063 — success on 7c7172a91495ac0079381ca0ec5d3ad1a7434704
Phase 2 CI: run 33768984629 — success on 1ff4ee9f559838e8e4d096c7f4cf984241bb1fc3
```

## Current phase

**Phase 2 — normalized catalog + deterministic rule-engine core**, stacked on an unmerged but repository-green Phase 1 scaffold.

Phase 1 repository work is implemented and CI-verified. Live Shopify development-store acceptance is still open and Phase 1 must not be called complete until that evidence exists.

Phase 2 has progressed through a first normalized catalog/rule-engine foundation and an initial 10-rule deterministic catalog. It is not yet a complete policy/finding lifecycle.

## What is confirmed working

### Phase 1 repository foundation

Evidence-backed behavior on `phase-1/shopify-scaffold`:

- Shopify React Router app foundation exists.
- GraphQL Admin API is pinned to `2026-07` in application and codegen configuration.
- Local Shopify configuration requests only `read_products`.
- The authenticated app route contains a read-only product/variant GraphQL query and no product mutation.
- Shopify session storage uses Prisma with refresh-token fields and expiring offline-token support enabled through the official Shopify application package.
- Uninstall and app-scope-update webhook handlers are present.
- `.env.example` contains placeholders only.
- `package-lock.json` is committed and the permanent quality gate uses `npm ci`.
- Node is fixed to `22.12.0` in CI.
- React Router packages are aligned at `7.18.3` and Vite at `7.3.6` after direct non-major security fixes.
- Phase 1 Quality Gate run `33766588063` completed successfully on SHA `7c7172a91495ac0079381ca0ec5d3ad1a7434704`.

### Phase 2 normalized catalog and rule engine

Evidence-backed behavior on `phase-2/domain-rule-engine`:

- Versioned normalized Product/Variant evaluation model exists.
- Evidence-bearing fields use explicit availability states:
  - `AVAILABLE`
  - `UNAVAILABLE`
  - `NOT_REQUESTED`
  - `UNRELIABLE`
- Rule results retain the locked semantic contract:
  - `PASS`
  - `FAIL`
  - `NOT_APPLICABLE`
  - `UNKNOWN`
- Severity and blocking remain separate policy metadata.
- Product scope evaluation distinguishes `MATCH`, `NO_MATCH`, and `UNKNOWN`.
- SKU/barcode uniqueness uses an explicit store-wide identifier-index abstraction with `COMPLETE`/`PARTIAL` completeness.
- Identifier normalization is explicit (`EXACT` or `TRIM`); there is no implicit case folding.
- Decimal price comparisons are deterministic string-based comparisons rather than floating-point coercion.
- Rule implementation exceptions degrade to `UNKNOWN` rather than creating false PASS/FAIL states.
- Domain tests are compiled separately and integrated into the permanent `npm test` gate.

Initial deterministic rule catalog:

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

Permanent Quality Gate run `33768984629` completed successfully on SHA `1ff4ee9f559838e8e4d096c7f4cf984241bb1fc3` with:

- locked dependency install;
- formatting;
- lint;
- TypeScript typecheck;
- combined scaffold + domain tests;
- Prisma generation/schema validation;
- production React Router build.

## What is not verified

### Shopify live acceptance

- No CatalogGuard app identity/client ID is linked in Shopify Dev Dashboard / Partner tooling.
- No Shopify development-store installation is verified.
- The embedded app has not been opened in a real Shopify admin from this workspace.
- The requested `read_products` grant has not been inspected after a real install.
- The product/variant GraphQL query has not yet been executed against real dev-store data.
- Session/token refresh behavior has not been exercised against Shopify.
- Phase 2 normalized Shopify adapter mappings beyond the existing Phase 1 source probe have not been live-verified.

### Product lifecycle/persistence

- No production host or production PostgreSQL database is verified.
- Findings/policies/policy revisions/baselines/regressions/exceptions are not yet persisted in the application runtime.
- No preflight orchestration or final policy disposition layer is implemented yet.
- No polished rule/policy dashboard is implemented.
- No billing integration or App Store submission is verified.

### Dependency advisories

A post-patch locked install reports `23` npm advisories (`3 moderate`, `20 high`), reduced from `30` before the direct React Router/Vite security updates. Remaining Prisma/codegen/TypeScript-ESLint/tooling audit suggestions require separate compatibility analysis and must not be force-applied with `npm audit fix --force`.

## Latest approved checkpoint

There is **no user-approved implementation checkpoint yet** for either Phase 1 or Phase 2 code.

The immutable repository baseline remains `main` SHA `1a540cd3ea73b9b03e3830b8b9c14dc02cf0511f` until the user explicitly approves an implementation state or the relevant PRs are deliberately merged after acceptance evidence.

Repository-green implementation checkpoints are evidence points, not user approvals:

- Phase 1: `7c7172a91495ac0079381ca0ec5d3ad1a7434704`
- Phase 2 10-rule core: `1ff4ee9f559838e8e4d096c7f4cf984241bb1fc3`

## Current blockers

### B1 — Live Shopify acceptance requires an authenticated Shopify developer account/dev store

Evidence: this workspace has GitHub access but no connected Shopify account/tool. The checked-in `shopify.app.toml` still has an empty `client_id`, and no live install/session evidence exists.

Smallest next external test:

1. clone the repository locally and check out `phase-1/shopify-scaffold` for the simplest app-view test, or `phase-2/domain-rule-engine` for the latest code;
2. install/use current Shopify CLI with Node `>=22.12.0`;
3. create or select a Shopify development store;
4. run `shopify app config link` to create/link the real CatalogGuard development app configuration;
5. validate/select that configuration;
6. run `shopify app dev` and choose the dev store;
7. install/open the embedded app;
8. verify the requested scope is only `read_products`;
9. verify real products/variants appear on the CatalogGuard Phase 1 page;
10. record the linked app/config identity and live evidence here.

### B2 — Remaining dependency advisories need separate compatibility work

Do not run `npm audit fix --force`. Investigate the remaining dependency families independently after preserving the current green checkpoints.

## Next engineering work

Continue from the green Phase 2 checkpoint without redesigning the app shell:

1. define deterministic policy-evaluation orchestration over the rule registry;
2. define immutable PolicyRevision input/output contracts at the domain layer;
3. define Finding identity and lifecycle contracts, including baseline debt vs regression;
4. define waiver/exception disposition without rewriting technical FAIL to PASS;
5. define preflight aggregation to `PASS`, `PASS_WITH_WAIVERS`, `FAIL`, or `INDETERMINATE`;
6. add fixture-driven tests for policy blocking, UNKNOWN blocking behavior, waivers, baseline/regression transitions, and reproducibility;
7. only then design persistence/migrations for policies, findings, evaluations, baselines, and exceptions;
8. defer weight/inventory/cost rules until exact Shopify fields/scopes are verified against a real development store;
9. keep UI expansion behind verified domain and persistence contracts.

## Product definition locked at baseline

CatalogGuard is:

> Shopify catalog policy + regression detection + exceptions + preflight QA.

CatalogGuard is **not** primarily:

- a generic health score;
- an SEO tool;
- an AI copywriter;
- a PIM;
- a catalog backup/revert product;
- an automatic bulk fixer;
- a workflow engine.

## Core semantic guardrails

- Rule results remain `PASS`, `FAIL`, `NOT_APPLICABLE`, and `UNKNOWN`.
- `UNKNOWN` is never silently treated as PASS.
- Severity and policy blocking are separate concepts.
- Active waivers change disposition but do not rewrite a failed rule evaluation as PASS.
- Policy revisions are immutable for historical evidence.
- Baseline debt remains distinct from later regressions.
- Preflight supports `PASS`, `PASS_WITH_WAIVERS`, `FAIL`, and `INDETERMINATE`.
- Webhook detection must be paired with reconciliation.

## Resume warning

Do not use conversation memory alone to determine current CatalogGuard state. Repository files, Git history, PRs, CI, Shopify dev-store behavior, and deployment evidence are authoritative for implementation status.
