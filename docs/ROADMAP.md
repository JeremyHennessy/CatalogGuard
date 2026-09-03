# Roadmap and Delivery Plan

This roadmap is sequenced to prove the core product with the smallest reliable implementation surface. A later phase is not automatically approved because it appears here.

## Phase 0 — Baseline / repository foundation

**Status at 2026-09-03:** in progress through this baseline commit.

Deliverables:

- canonical README
- agent/handoff instructions
- product specification
- architecture baseline
- rule-engine semantics
- data-model baseline
- Shopify platform baseline
- quality/release gates
- commercial assumptions
- competitive baseline
- issue backlog

Acceptance:

- another chat can identify the objective, current state, non-goals, next phase, and exact baseline SHA without relying on conversation memory.

## Phase 1 — Shopify scaffold + development store

### Goal

Establish a real Shopify app skeleton and prove authenticated catalog access.

### Work

1. Create/verify Shopify Partner/Dev Dashboard app.
2. Scaffold using Shopify's recommended React Router template.
3. Pin GraphQL Admin API `2026-07`.
4. Configure minimal access scopes.
5. Install on a Shopify development store.
6. Confirm authenticated GraphQL product query.
7. Replace local-only session persistence with production-capable persistence plan.
8. Add baseline CI.
9. Add `.env.example` and secret-management documentation without real secrets.

### Tests/evidence

- dev server starts;
- app installs successfully;
- embedded navigation works;
- authenticated query returns development-store product data;
- no unexpected scopes requested;
- tests/typecheck/lint pass;
- exact app/template/library versions recorded.

### Stop condition

Do not proceed by pretending Shopify access works if no dev-store installation/query has been verified.

## Phase 2 — Normalization + deterministic rule engine

### Goal

Prove rule behavior on fixtures before building scanning orchestration.

### Work

- normalized Product/Variant model;
- data-availability metadata;
- rule registry;
- policy configuration schema;
- scope evaluator;
- initial 10 rules, then expand to ~15–20 after test quality is proven;
- global identifier index abstraction for SKU/barcode uniqueness;
- PASS/FAIL/NOT_APPLICABLE/UNKNOWN contract;
- explanation/evidence messages;
- rule versioning.

### Acceptance

Every rule has:

- PASS fixture;
- FAIL fixture;
- UNKNOWN fixture where meaningful;
- boundary/null tests;
- config validation tests.

No route/UI is allowed to contain duplicate business-rule implementations.

## Phase 3 — Full catalog scan

### Goal

Evaluate an entire development-store catalog reliably.

### Work

- Scan persistence;
- Shopify bulk query;
- bulk result processing;
- catalog normalization;
- identifier index build;
- rule execution;
- current finding persistence;
- scan summary/status;
- failures UI with Shopify deep links.

### Acceptance

Test on at least:

- small fixture/dev store;
- generated medium catalog sufficient to exercise bulk operations and duplicate identifiers;
- intentionally malformed products.

Verify:

- counts match source;
- known defects yield expected findings;
- failed/partial bulk operation is not labelled complete;
- rerun produces stable results.

## Phase 4 — Policies

### Goal

Move from hardcoded audit to merchant-defined governance.

### Work

- logical Policy;
- immutable PolicyRevision;
- PolicyRule configuration;
- starter policy packs;
- enable/disable rules;
- severity and blocking configuration;
- initial scope builder;
- policy revision history.

### Acceptance

- editing active policy creates new revision;
- historical scan/preflight can still resolve old revision;
- invalid rule config cannot be activated;
- scope UNKNOWN is not silently NOT_APPLICABLE.

## Phase 5 — Baseline + finding lifecycle

### Goal

Deliver the first major differentiator.

### Work

- explicit “establish baseline” workflow;
- finding stable identity;
- baseline debt classification;
- new regression classification;
- resolution;
- reopen;
- policy-change-failure classification where evidence is sufficient;
- lifecycle timeline.

### Golden scenario

1. scan existing defect -> baseline debt;
2. establish baseline;
3. compliant product becomes noncompliant -> new regression;
4. fix it -> resolved;
5. break it again -> reopened regression;
6. full scan agrees with incremental/current state.

All steps must have automated domain tests before merchant pilot.

## Phase 6 — Webhook incremental evaluation

### Goal

Detect changed products without waiting for full scan.

### Work

- verify relevant `products/*` topics against API baseline;
- webhook HMAC validation;
- idempotency persistence;
- prompt acknowledgement;
- affected-resource refresh;
- incremental normalization/index updates;
- incremental rule evaluation;
- retry/backoff;
- error visibility;
- reconciliation safety net.

### Acceptance

Dev-store tests for:

- normal update;
- duplicate delivery;
- replay;
- out-of-order-like state where later authoritative fetch protects current result;
- product deletion if in scope;
- transient Shopify API failure/retry;
- full reconciliation converges to same state.

## Phase 7 — Exceptions / waivers

### Goal

Support intentional non-compliance without falsifying rule results.

### Work

- exact-finding exception;
- required reason;
- optional expiry;
- revoke;
- enforcement disposition;
- lifecycle events;
- exception filters.

### Acceptance

- FAIL remains stored as FAIL;
- active waiver changes enforcement to WAIVED;
- expiry restores VIOLATION;
- revocation restores VIOLATION;
- resolved source data closes finding even if exception exists;
- history remains intact.

## Phase 8 — Preflight

### Goal

Turn CatalogGuard into a launch gate/evidence tool.

### Work

- product target;
- selected product set;
- collection target;
- target materialization;
- policy revision lock;
- fresh-evaluation option;
- outcomes PASS/PASS_WITH_WAIVERS/FAIL/INDETERMINATE;
- evidence detail/export.

### Acceptance

- blocking violation -> FAIL;
- blocking UNKNOWN -> INDETERMINATE;
- only waived blocking failures -> PASS_WITH_WAIVERS;
- no blocking issues -> PASS;
- historical preflight remains unchanged after catalog/policy changes.

## Phase 9 — Admin UI extension

### Goal

Surface policy state where merchants edit products.

### Work

- Shopify Admin product detail block/action using current supported extension targets;
- pass/fail summary;
- top blocking findings;
- link into CatalogGuard;
- unit tests using supported extension test tooling.

### Acceptance

- extension matches server-side finding state;
- no business-rule fork in extension;
- acceptable Shopify Admin performance;
- graceful unavailable state.

## Phase 10 — Shopify Flow trigger

### Goal

Let merchants route CatalogGuard events into existing automation.

Initial trigger candidate:

- blocking catalog regression detected

Potential additional trigger after validation:

- preflight failed
- exception expired

### Acceptance

- trigger extension deployed;
- test workflow receives expected payload;
- duplicate/replayed events do not create uncontrolled repeated triggers.

## Phase 11 — Production hosting / pilot readiness

Production hosting choice should occur only after measuring scan/job behavior.

Required capabilities:

- HTTPS;
- secrets;
- Node runtime compatible with Shopify template;
- PostgreSQL;
- durable migrations;
- reliable jobs/retries/scheduling;
- logs/error monitoring;
- acceptable cost at pilot scale.

### Pilot readiness checklist

- security/privacy review;
- mandatory compliance webhooks;
- uninstall/redaction test;
- expiring offline-token behavior confirmed;
- billing entitlement strategy implemented if charging pilot users;
- support/privacy URLs prepared;
- exact deployment SHA exposed/recorded;
- backups/DB recovery basics defined.

## Phase 12 — Merchant pilot

### Goal

Prove recurring value before broad feature expansion.

Target initial cohort:

- 5–10 stores with enough catalog complexity to experience imports/team edits/data-quality issues.

Capture:

- product count/variant count bands;
- scan duration;
- new regressions detected;
- regressions actually fixed;
- policies edited;
- preflights run;
- waived findings;
- requested missing rules;
- false-positive/UNKNOWN rate;
- willingness to pay;
- uninstall reasons.

### Go/no-go signal

Proceed to broader commercialization only if multiple pilot merchants repeatedly use regression/preflight workflows, not merely install and run one free audit.

## Phase 13 — Shopify App Store preparation

Work:

- current App Store requirements review;
- pricing page via Shopify App Pricing/Billing;
- listing copy/screenshots;
- privacy policy;
- support channel;
- uninstall/data deletion behavior;
- app-review test credentials/store state;
- performance/accessibility pass;
- all required webhooks;
- billing upgrade/downgrade/reinstall test;
- no unsupported marketing claims.

## Candidate post-MVP tracks

### A. CSV preflight

Only after merchant evidence supports demand.

### B. Agency multi-store

Only after at least one agency/power user validates the workflow.

### C. Rich change evidence

Expand snapshots/diffs after storage/merchant value is understood.

### D. Controlled remediation

Potentially add suggested/focused edits later. Broad automatic write access is not part of the baseline.

### E. Additional policy packs

Use actual vertical/customer demand.

## Delivery ordering rule

If a phase uncovers a correctness blocker in an earlier layer, stop and fix the earlier layer before adding downstream features.

Examples:

- incorrect normalization -> do not patch finding UI;
- unreliable identifier index -> do not add more uniqueness-dependent rules;
- webhook divergence -> do not add notifications claiming real-time accuracy;
- mutable historical policy evidence -> do not ship preflight.
