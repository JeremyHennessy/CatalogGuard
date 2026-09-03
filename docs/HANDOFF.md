# Current Handoff

This file is the current-state resume point. Update it after meaningful merges/releases/checkpoints.

## Handoff timestamp

2026-09-03 — project baseline establishment.

## Current canonical repository

`JeremyHennessy/CatalogGuard`

## Starting repository commit observed

`74f7b4468da35bb9720d6843d50f0448479eb890` — `Initial commit`

This was the repository's initial README commit. The final SHA for the documentation baseline must be written here in a follow-up commit or issue/comment after the baseline commit is created, because a commit cannot contain its own SHA.

## Current phase

**Phase 0 — Baseline / repository foundation**

Implementation has **not** started.

## Confirmed current state

- Repository exists and is private.
- Initial repository content was only a two-line README.
- Product scope/architecture/rule semantics/data model/roadmap/quality/commercial/competitive documents are being established as the first substantive baseline.
- No Shopify application scaffold is verified in this repository.
- No Shopify Dev Dashboard/Partner app is verified.
- No Shopify development store installation is verified.
- No Shopify access token/session configuration is verified.
- No production host is verified.
- No production database is verified.
- No billing integration is verified.
- No Shopify App Store submission is verified.

## Current platform baseline

- Shopify GraphQL Admin API target: `2026-07`.
- Shopify recommended app direction: React Router template via Shopify CLI.
- Initial product direction: predominantly read-only.
- Initial permission direction: minimum catalog read scopes, starting with `read_products` where sufficient.
- V1 must avoid customer/order data.
- Public App Store version must implement mandatory compliance webhooks.
- Public app must use current expiring offline-token behavior.

Re-verify platform facts against official Shopify docs if resuming significantly later.

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

## Core differentiator hypothesis

```text
merchant-defined deterministic policy
+ immutable policy revisions
+ legacy debt vs new regression
+ documented / expiring waivers
+ reproducible preflight
+ change-to-policy evidence where supported
```

This remains a commercial hypothesis until pilot usage/payment evidence exists.

## Next engineering phase

**Phase 1 — Shopify scaffold + development-store verification.**

Required next steps:

1. confirm current `main` HEAD and that baseline docs are present;
2. inspect any issues created for the roadmap;
3. verify current Shopify CLI/template requirements;
4. create/verify Shopify Dev Dashboard app;
5. scaffold official React Router app;
6. pin API `2026-07` unless current evidence requires a deliberate change;
7. configure minimal scopes;
8. install on dev store;
9. execute authenticated GraphQL product query;
10. add CI and record exact versions;
11. stop and report any platform/credential blocker rather than mocking success.

## Next product implementation after scaffold

Do **not** start with a polished dashboard.

Recommended order:

1. normalized catalog model;
2. rule engine contracts/tests;
3. first deterministic rule fixtures;
4. store-wide identifier index abstraction;
5. full bulk scan;
6. findings persistence/UI;
7. policies;
8. baseline/regression lifecycle.

## Open implementation questions

These must be resolved with current Shopify API evidence/tests rather than guessed:

- exact GraphQL product/variant selections for all planned rules;
- exact access scopes required for cost/inventory/weight checks;
- best supported product-change webhook topics/payload strategy for `2026-07`;
- best production host/job topology after bulk-processing test;
- whether one base Finding should be shared across multiple policies or finding identity should include policy context;
- retention strategy for snapshots/evaluations at large catalog size;
- which first 15–20 rules create enough merchant value without unnecessary scopes;
- whether CSV preflight deserves post-MVP investment.

## Commercial questions still unverified

- willingness to pay $19/$49;
- whether regression detection is a recurring pain for enough merchants;
- preflight frequency;
- agency channel strength;
- acceptable free-tier limits;
- App Store search conversion.

## Required handoff format for future updates

When updating this file, include:

### Exact state

```text
Date/time:
Main SHA:
Active branch:
Open PR:
Shopify API version:
DB migration:
Deployment:
Shopify app/config version:
```

### What is confirmed working

Only evidence-backed behavior.

### What is not verified

Explicit list.

### Latest approved checkpoint

Exact SHA + what user approved.

### Changes since checkpoint

File/behavior/config/data differences.

### Blockers

Evidence and smallest next investigation.

### Next steps

Ordered, bounded tasks.

## Resume warning

Do not use conversation memory alone to determine current CatalogGuard state. Repository files, Git history, PRs, CI, Shopify dev-store behavior, and deployment evidence are authoritative for implementation status.
