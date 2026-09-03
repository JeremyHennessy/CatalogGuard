# Current Handoff

This file is the current-state resume point. Update it after meaningful merges/releases/checkpoints.

## Exact state

```text
Date/time: 2026-09-03 11:21 ADT
Canonical repository: JeremyHennessy/CatalogGuard
Main SHA: 1a540cd3ea73b9b03e3830b8b9c14dc02cf0511f
Active branch: phase-1/shopify-scaffold
Branch SHA before this handoff update: 6ab1eef8cd8910c08ea8591eb3d8a17fb59a64f9
Open PR: #11 (draft) — Phase 1: scaffold read-only Shopify app foundation
Shopify API version: 2026-07 / ApiVersion.July26
Requested Shopify scopes: read_products only
DB migration: prisma/migrations/20240530213853_create_session_table/migration.sql
Development DB: Prisma + SQLite session storage
Deployment: none verified
Shopify app/config version: local shopify.app.toml is not linked to a real app; client_id remains empty
Shopify CLI reference checked: @shopify/cli 4.7.0; not executed in this workspace
CI run: 33765543815 — success on branch SHA 6ab1eef8cd8910c08ea8591eb3d8a17fb59a64f9
```

## Current phase

**Phase 1 — Shopify scaffold + development-store verification.**

Repository-side scaffold work is implemented and CI-verified. Live Shopify development-store acceptance is still open and Phase 1 must not be called complete until that evidence exists.

## What is confirmed working

Evidence-backed repository behavior on `phase-1/shopify-scaffold`:

- Shopify React Router app foundation exists.
- GraphQL Admin API is pinned to `2026-07` in application and codegen configuration.
- Local Shopify configuration requests only `read_products`.
- The authenticated app route contains a read-only product/variant GraphQL query and no product mutation.
- Shopify session storage uses Prisma with refresh-token fields and expiring offline-token support enabled through the official Shopify application package.
- Uninstall and app-scope-update webhook handlers are present.
- `.env.example` contains placeholders only.
- `package-lock.json` is committed and the permanent quality gate uses `npm ci`.
- Node is fixed to `22.12.0` in CI.
- React Router packages are aligned at `7.18.3` and Vite at `7.3.6` after direct non-major security fixes; the patched graph resolves without `--force` or `--legacy-peer-deps`.
- Quality Gate run `33765543815` completed successfully on SHA `6ab1eef8cd8910c08ea8591eb3d8a17fb59a64f9` with:
  - locked dependency install;
  - formatting;
  - lint;
  - TypeScript typecheck;
  - 4/4 Phase 1 contract tests;
  - Prisma generation/schema validation;
  - production React Router build.

## What is not verified

- No CatalogGuard app identity/client ID is linked in Shopify Dev Dashboard / Partner tooling.
- No Shopify development-store installation is verified.
- The embedded app has not been opened in a real Shopify admin from this workspace.
- The requested `read_products` grant has not been inspected after a real install.
- The product/variant GraphQL query has not yet been executed against real dev-store data.
- Session/token refresh behavior has not been exercised against Shopify.
- No production host, production PostgreSQL database, billing integration, or App Store submission is verified.
- A pre-update npm audit reported 30 advisories. Direct React Router and Vite findings with non-major fixes were addressed; a post-update audit count has not yet been recorded. Remaining Prisma/codegen/TypeScript-ESLint audit suggestions require separate compatibility analysis and must not be force-applied.

## Latest approved checkpoint

There is **no user-approved implementation checkpoint yet** for the Phase 1 app code. The immutable repository baseline remains `main` SHA `1a540cd3ea73b9b03e3830b8b9c14dc02cf0511f` until the user explicitly approves an implementation state or PR #11 is deliberately merged after acceptance evidence.

## Changes from the baseline

The Phase 1 branch adds the application scaffold and supporting configuration without changing `main`:

- React Router/Shopify application routes and authentication shell;
- read-only product/variant GraphQL probe;
- Prisma session schema/migration;
- Shopify TOML/web configuration;
- deterministic npm dependency lock;
- quality-gate workflow;
- Phase 1 contract tests;
- minimal entry page for local/development-store access.

No product writes, customer/order scopes, AI functionality, theme changes, full rule engine, or dashboard redesign were added.

## Current blockers

### B1 — Live Shopify acceptance requires an authenticated Shopify developer account/dev store

Evidence: this workspace has GitHub access but no connected Shopify account/tool. `shopify.app.toml` still has an empty `client_id`, and no live install/session evidence exists.

Smallest next external test:

1. install/use Shopify CLI on a local machine with Node `>=22.12.0`;
2. log into the intended Shopify developer account;
3. link/create CatalogGuard through Shopify CLI;
4. run `shopify app dev` and choose a dev store;
5. install/open the app;
6. verify requested scope is only `read_products`;
7. verify real products/variants appear on the CatalogGuard Phase 1 page;
8. record the app/config identity and evidence here.

### B2 — Dependency advisories beyond the direct React Router/Vite fixes need separate compatibility work

Do not run `npm audit fix --force`. The prior audit suggested major or backwards-moving changes for Prisma, Shopify codegen/session storage, and TypeScript-ESLint chains. Investigate those families independently after preserving the current green branch.

## Next engineering work

Issue #2 permits fixture-driven domain work while live Shopify acceptance is pending. Continue in a separate branch based on the verified Phase 1 head, not by expanding PR #11:

1. define versioned normalized Product/Variant evaluation models;
2. define explicit field-availability semantics and `UNKNOWN` behavior;
3. implement rule result/severity/blocking contracts;
4. implement stable rule registry/codes;
5. implement schema-validated configurations and constrained scope evaluation;
6. implement the store-wide SKU/barcode identifier-index abstraction;
7. add the first small rule batch with PASS/FAIL/NOT_APPLICABLE/UNKNOWN/boundary tests;
8. keep the domain layer independent of Shopify routes/UI;
9. do not add weight/inventory/cost rules until exact fields and scopes are verified.

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
- Active waivers change disposition but do not rewrite a failed evaluation as PASS.
- Policy revisions are immutable for historical evidence.
- Baseline debt remains distinct from later regressions.
- Preflight supports `PASS`, `PASS_WITH_WAIVERS`, `FAIL`, and `INDETERMINATE`.
- Webhook detection must be paired with reconciliation.

## Resume warning

Do not use conversation memory alone to determine current CatalogGuard state. Repository files, Git history, PRs, CI, Shopify dev-store behavior, and deployment evidence are authoritative for implementation status.
