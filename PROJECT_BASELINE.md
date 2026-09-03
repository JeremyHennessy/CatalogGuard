# PROJECT_BASELINE.md

## Baseline identity

- Project: CatalogGuard
- Repository: `JeremyHennessy/CatalogGuard`
- Baseline date: 2026-09-03
- Repository state at start of baseline work: initial README only
- Initial commit observed: `74f7b4468da35bb9720d6843d50f0448479eb890`
- Product status: planning / architecture baseline
- Production status: not implemented / not deployed / not submitted
- Shopify API baseline: GraphQL Admin API `2026-07`

This document establishes the canonical starting point for all future implementation work.

## 1. Problem definition

Shopify catalogs accumulate quality failures through manual edits, bulk imports, supplier feeds, app integrations, seasonal launches, and team workflows.

A generic audit can identify today's problems, but operational teams also need to know:

- whether a problem is old or newly introduced;
- which merchant-specific standard was violated;
- whether the violation is blocking or informational;
- whether the merchant has deliberately waived the violation;
- whether the waiver has expired;
- what changed between the last known-good state and the regression;
- whether a proposed launch/import passes the exact current policy.

CatalogGuard exists to provide that governance layer.

## 2. Product definition

CatalogGuard is a Shopify catalog policy and regression-protection application with five core capabilities:

1. **Policy** — deterministic rules define valid catalog state.
2. **Baseline** — existing debt is established without pretending it is newly introduced.
3. **Regression detection** — new/reopened failures are separated from legacy findings.
4. **Exceptions** — intentional violations are documented, reviewable, and optionally expiring.
5. **Preflight** — a target set can be evaluated against a fixed policy revision before a launch/import/change proceeds.

Continuous webhooks, periodic reconciliation, Admin UI extensions, and Shopify Flow are supporting capabilities.

## 3. Primary users

Initial target personas:

### Ecommerce operations / catalog manager

Needs to keep a medium/large catalog structurally correct across frequent updates.

### Merchandiser

Needs confidence that a product or collection launch meets required completeness and merchandising standards.

### Operations / warehouse / 3PL coordinator

Needs identifiers, weights, barcodes, inventory configuration, and required operational metadata to be complete.

### Shopify agency / consultant

Needs repeatable QA standards across multiple client stores and evidence that a catalog was checked before handoff.

### Founder/operator of a growing Shopify store

Needs guardrails without buying a full PIM/MDM platform.

## 4. V1 success condition

V1 is successful when a merchant can:

1. install CatalogGuard on a Shopify development/pilot store;
2. run a complete catalog scan;
3. see deterministic findings linked to affected products/variants;
4. configure a policy and rule thresholds/scopes;
5. establish a baseline;
6. change a Shopify product and have the affected rules re-evaluated;
7. see a newly introduced violation classified as a regression;
8. resolve the source data and see the regression resolve;
9. accept an exception with a reason and optional expiry;
10. run a preflight against a product set/collection and receive a reproducible pass/fail result;
11. operate without CatalogGuard requesting customer/order data;
12. uninstall and have app/shop data lifecycle handled according to Shopify requirements.

## 5. Explicit non-goals

V1 is not intended to:

- replace Shopify product editing;
- auto-edit every failure;
- become a PIM;
- become a feed manager;
- replace Shopify Flow;
- manage advertising;
- optimize conversion using opaque AI scores;
- ingest orders/customers for generic analytics;
- promise revenue improvement percentages;
- universally block native Shopify product saves/publishing without verified platform support.

## 6. Product differentiation baseline

As of 2026-09-03, current Shopify competitors already cover pieces of the problem:

- generic catalog audits / health scoring;
- duplicate/missing SKU and barcode scans;
- deterministic product-data checks and custom rules;
- read-only audit reports;
- product change history / one-click reversion;
- periodic SKU monitoring.

CatalogGuard therefore should **not** compete primarily on “more checks.”

The intended differentiation is the combined operating model:

```text
merchant-defined policy
+ immutable policy revision for evidence
+ baseline vs regression classification
+ documented/expiring exceptions
+ target-specific preflight
+ change-to-policy causality where evidence permits
+ reconciliation for correctness
```

See `docs/COMPETITIVE_BASELINE.md`.

## 7. Scope baseline

### Phase 1 scope

- Shopify public embedded app scaffold
- development-store installation
- minimal read scopes
- PostgreSQL-backed session/app data before production
- product/variant bulk ingestion
- 15–20 deterministic built-in rules
- full scan
- findings UI
- policy enable/disable/configuration
- baseline classification

### Phase 2 scope

- scoped policies
- finding lifecycle
- exceptions
- webhook-driven incremental evaluation
- scheduled/on-demand full reconciliation
- change fingerprints/snapshots sufficient to explain regressions

### Phase 3 scope

- product/collection preflight
- policy-version evidence
- Shopify Admin product block/action
- CSV export
- email/Flow notification path

### Phase 4 candidate scope

- Shopify CSV import preflight
- agency/multi-store features
- richer change evidence
- controlled remediation assistance

No candidate scope is automatically approved merely because it appears in the roadmap.

## 8. Architecture baseline

### Application

Use Shopify's currently recommended React Router template and official Shopify app package unless re-evaluation identifies a concrete blocker.

### API

Use GraphQL Admin API only for new public-app Admin API functionality.

Pin `2026-07` initially. Treat API upgrades as explicit changes with regression testing.

### Persistence

Use Prisma. Shopify's scaffold may begin with SQLite locally; production must use a durable database appropriate for multi-instance deployment. PostgreSQL is the preferred baseline.

### Background/reconciliation work

The host must support a reliable strategy for:

- bulk-operation orchestration;
- processing bulk results;
- scheduled reconciliation;
- retryable webhook-triggered work;
- idempotency;
- observable failures.

Do not choose a production host solely because it is convenient for request/response web apps if its background execution model makes catalog scans unreliable.

### Webhooks

Use app-configured webhooks where appropriate.

V1 is expected to need product/catalog-relevant change topics plus app uninstall and mandatory privacy compliance topics. Exact topic names and scopes must be verified during implementation against API `2026-07`.

### Shopify Admin extensions

Add only after the underlying policy/finding API is stable enough that the extension is a thin view/action surface, not a second source of business logic.

### Flow

CatalogGuard may expose domain-specific Flow triggers. It should not build a parallel generic automation system.

## 9. Security/privacy baseline

- no customer/order ingestion for V1;
- request minimum access scopes;
- no secrets in GitHub;
- verify webhook HMAC;
- use Shopify session-token requirements for embedded app operation;
- use expiring offline access tokens as required for public apps;
- implement mandatory compliance webhook handling before App Store submission;
- define store-data deletion behavior for uninstall/redaction;
- create privacy policy and support contact before submission;
- retain only catalog-derived fields needed for findings, change evidence, and historical explainability.

## 10. Rule semantics baseline

Rule evaluation result is one of:

- `PASS`
- `FAIL`
- `NOT_APPLICABLE`
- `UNKNOWN`

`UNKNOWN` must never be treated as `PASS` simply because data is absent due to permission/API/runtime failure.

Severity and blocking are separate concepts.

Example:

- severity: warning
- blocking in `Launch Ready` policy: yes
- blocking in `Basic Integrity` policy: no

Accepted exceptions do not alter the underlying rule evaluation; they alter enforcement disposition for the covered scope/time period.

See `docs/RULE_ENGINE.md`.

## 11. Finding lifecycle baseline

A stable finding identity must be deterministic for the same resource + rule + relevant subresource.

Lifecycle states/concepts must support:

- first seen in baseline -> existing debt
- first seen after baseline -> new regression
- currently passing after prior failure -> resolved
- fails again after resolution -> reopened regression
- active exception -> waived for enforcement but still failed
- expired/revoked exception -> active failure again

Never delete finding history merely because the current evaluation passes.

## 12. Preflight baseline

Every preflight result must record at minimum:

- store
- target definition
- exact policy revision
- rule-engine/schema version
- Shopify API version
- start/end timestamps
- evaluated resource identifiers
- result counts
- blocking findings
- applicable active exceptions
- final outcome

A rerun under a changed policy is a new preflight, not a mutation of old evidence.

## 13. Commercial baseline

Pricing is a hypothesis until tested.

Initial hypothesis:

- Free / pilot: small catalog or limited scan capability
- Guard: approximately $19/month
- Team: approximately $49/month
- Agency: approximately $99–149/month when multi-store functionality exists

Do not implement plan complexity before core product value is validated.

Primary commercialization gate is evidence of recurring operational use, not App Store submission itself.

See `docs/COMMERCIAL_PLAN.md`.

## 14. Quality baseline

A successful release requires evidence appropriate to the changed layer.

At minimum before any public pilot:

- typecheck/lint/tests green;
- deterministic rule fixture suite green;
- database migrations verified from clean and prior schema;
- HMAC/webhook idempotency verified;
- dev-store full scan verified;
- incremental regression lifecycle verified;
- exception expiry/revocation verified;
- preflight reproducibility verified;
- no unexpected access scopes;
- privacy/uninstall path verified;
- exact deployed SHA recorded.

See `docs/QUALITY_AND_RELEASE.md`.

## 15. Baseline facts vs hypotheses

### Confirmed as of 2026-09-03

- Shopify recommends the React Router template for most new apps.
- New public apps use GraphQL Admin API rather than legacy REST Admin API.
- `2026-07` is a stable supported Shopify API version.
- GraphQL bulk operations can retrieve large catalog connections asynchronously; API versions 2026-01+ allow up to five concurrent bulk query operations per shop per app.
- Shopify App Store apps must use Shopify-provided billing.
- Public App Store apps must implement mandatory privacy compliance webhooks.
- Public apps must use expiring offline access tokens for Admin API requests by 2027-01-01; newly scaffolded public apps already support the modern flow via current official tooling.

### Hypotheses requiring validation

- merchants will pay more for regression/preflight governance than for generic auditing;
- $19/$49 pricing is acceptable;
- collection preflight is a high-frequency workflow;
- supplier CSV preflight has enough demand to justify parser complexity;
- agencies are a useful early distribution channel;
- minimal catalog scopes can support the first commercially valuable rule set.

Do not convert hypotheses into “facts” without evidence.

## 16. Official platform references

- https://shopify.dev/docs/apps/build/scaffold-app
- https://shopify.dev/docs/api/shopify-app-react-router/latest
- https://shopify.dev/docs/api/usage/versioning
- https://shopify.dev/docs/api/usage/bulk-operations/queries
- https://shopify.dev/docs/apps/build/webhooks
- https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance
- https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens
- https://shopify.dev/docs/apps/launch/billing
- https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements
- https://shopify.dev/docs/api/admin-extensions/latest
- https://shopify.dev/docs/apps/build/flow/triggers

## 17. Baseline change procedure

If a future decision changes this baseline:

1. cite the reason/evidence;
2. update the affected detailed document;
3. add an entry to `docs/DECISION_LOG.md`;
4. update this baseline if the change is material;
5. record the commit SHA in `docs/HANDOFF.md` after merge;
6. preserve previous approved state in Git history.
