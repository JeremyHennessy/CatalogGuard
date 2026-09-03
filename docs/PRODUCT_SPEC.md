# Product Specification

## 1. Product name

Working name: **CatalogGuard**

Tagline direction: **Catalog quality rules and regression protection for Shopify.**

## 2. Product promise

CatalogGuard gives Shopify teams a deterministic answer to:

> Is this catalog state compliant with our rules, what changed, what is newly broken, and is this launch safe to proceed?

The product should optimize for operational trust and explainability rather than opaque scoring.

## 3. Primary jobs to be done

### JTBD-1 — Establish catalog standards

As a catalog/operations manager, I want to define required product/variant data so the team has one repeatable standard.

### JTBD-2 — Separate debt from regression

As a merchant with an imperfect legacy catalog, I want to know what broke recently without being overwhelmed by years of existing issues.

### JTBD-3 — Triage findings

As an operator, I want every finding to explain the rule, affected resource, observed value, expected condition, severity, and enforcement state.

### JTBD-4 — Accept intentional exceptions

As a manager, I want to waive a known exception with a reason/expiry without hiding that the product technically violates the rule.

### JTBD-5 — Validate a launch

As a merchandiser, I want to run the exact current policy against a collection/product set and receive a reproducible pass/fail result.

### JTBD-6 — Detect new breakage quickly

As a team, I want Shopify changes to trigger incremental checks so new regressions appear without waiting for a manual full audit.

### JTBD-7 — Recover correctness after missed events

As an operator, I want periodic full reconciliation so CatalogGuard does not permanently trust webhook delivery or local state.

## 4. User roles

V1 may initially treat all authenticated merchant staff with app access similarly unless Shopify context gives a safe, useful distinction. Fine-grained CatalogGuard roles are not required for initial product validation.

Future role concepts:

- Owner/admin
- Policy manager
- Operator
- Read-only reviewer
- Agency reviewer

Do not build custom RBAC before a clear need exists.

## 5. Core navigation

Suggested initial embedded-app IA:

```text
Overview
Findings
Policies
Preflight
History
Settings
```

Candidate later sections:

```text
Imports
Agency
Integrations
```

## 6. Overview

Purpose: answer "what needs attention now?"

Required blocks:

- last complete catalog reconciliation and status
- product / variant evaluation coverage
- new regressions count
- blocking findings count
- warnings count
- accepted exceptions count
- recently resolved count
- policy status summary
- CTA to review regressions
- CTA to run preflight

Avoid an undifferentiated 0–100 health score as the primary product signal.

## 7. Findings

Each finding must expose:

- classification: existing debt / new regression / reopened regression / active failure / waived / resolved
- severity
- blocking state under the active policy
- rule name/code
- policy name/revision
- Shopify resource type + GID
- product title / variant descriptor as presentation metadata
- observed value (safe/redacted as appropriate)
- expected condition
- first seen
- last seen
- current evaluation status
- exception state
- direct Shopify Admin deep link when feasible

Filters:

- status/classification
- severity
- blocking
- policy
- rule/family
- product/variant
- vendor
- product type
- collection if the query model supports it reliably
- first-seen range
- exception state

V1 export: CSV of current filtered findings.

## 8. Policies

A Policy is a named, versioned set of enabled rule instances and configuration.

Example:

**Apparel Launch Ready**

- SKU required — critical/blocking
- SKU unique — critical/blocking
- barcode required — warning/blocking
- at least 3 media items — warning/non-blocking
- `custom.material` metafield required — warning/blocking
- option names must include Size and Color — critical/blocking

Policy operations:

- create from template
- create blank
- rename/describe
- enable/disable rule
- configure rule
- set severity
- set blocking disposition
- configure scope
- preview affected resource count
- save -> creates a new immutable revision
- inspect revision history

Editing a policy must not retroactively mutate historical preflight evidence.

## 9. Scope model

V1 should support a constrained, deterministic scope builder rather than arbitrary code.

Candidate scope fields:

- product status
- vendor
- product type
- tags
- collection membership
- category/taxonomy
- product/metafield equality/existence where practical

Logical model:

```text
ALL conditions must match
OR
ANY conditions may match
```

Nested boolean expressions are optional and should be deferred unless real merchant use requires them.

## 10. Initial built-in rules

Final GraphQL field availability must be verified during implementation.

### Identity

- SKU required
- SKU unique
- SKU matches configured regex
- Barcode required
- Barcode unique
- Barcode passes configured GTIN/UPC/EAN validation mode

### Pricing

- Price greater than configured minimum
- Compare-at price relationship valid
- Cost present if applicable and scope permits

### Product completeness

- Product description required / minimum text length
- SEO title required / configurable length
- SEO description required / configurable length
- Product category assigned
- Vendor required / allowed list
- Product type required / allowed list
- Required tag(s)

### Media

- Minimum product media count
- Variant image/media requirement where supported by selected Shopify data model

### Physical / inventory

- Weight greater than zero for configured physical/shippable scope
- Inventory tracking/configuration rule where permission/data model permits

### Variants/options

- Required option names
- Allowed option values
- Required metafield(s)

Target: approximately 15–20 high-confidence rules for first merchant validation, not dozens of low-value checks.

## 11. Rule detail UX

Every failure should be explainable in one sentence.

Example:

> Variant `Black / M` has no SKU. Policy `Warehouse Ready v3` requires every active variant to have a SKU.

For uniqueness:

> SKU `TSHIRT-001-M` is used by 2 variants. `Warehouse Ready v3` requires SKU uniqueness across the store.

For unknown:

> This rule could not be evaluated because the required inventory field was unavailable. CatalogGuard did not mark it as passing.

## 12. Baseline

First full successful scan can establish the initial baseline after explicit merchant confirmation/onboarding flow.

Do not classify findings as new regressions before a baseline is established.

Initial categories:

- `BASELINE_DEBT`
- `NEW_REGRESSION`
- `REOPENED_REGRESSION`

The UI should make legacy debt less noisy while keeping it discoverable.

## 13. Regression behavior

A regression is created when a previously compliant applicable rule/resource identity becomes failed, or when a resolved finding fails again.

A policy change may intentionally create new failures. These should be distinguishable from catalog-data regressions where feasible:

- `DATA_REGRESSION`
- `POLICY_CHANGE_FAILURE`

If causality cannot be established, classify conservatively and expose the evidence rather than inventing a cause.

## 14. Exceptions

Exception fields:

- rule/finding coverage
- resource coverage
- reason (required)
- notes
- created at
- created by / actor metadata if available
- expires at (optional)
- revoked at
- status

Disposition:

- underlying evaluation remains FAIL
- enforcement becomes WAIVED while exception is active
- expired/revoked exception restores normal enforcement

Preflight must list waivers used to achieve a pass.

## 15. Preflight

Target types for first release:

- product
- selected product set
- collection

Preflight modes:

- current stored state if fresh enough
- forced refresh/evaluation for higher-confidence runs

A production-ready preflight should prefer fresh source data and record source freshness.

Outcome:

- `PASS`
- `PASS_WITH_WAIVERS`
- `FAIL`
- `INDETERMINATE`

`INDETERMINATE` is required when blocking rules cannot be evaluated reliably.

## 16. CSV import preflight — candidate, not V1 requirement

Potential workflow:

1. merchant uploads Shopify-compatible CSV;
2. parser validates format;
3. records are normalized into a proposed catalog delta;
4. collisions with existing Shopify identifiers are checked;
5. policy rules are evaluated against proposed state where semantics allow;
6. report is generated;
7. CatalogGuard does **not** apply the import in the initial version.

This feature requires demand validation because Shopify CSV semantics and edge cases materially increase maintenance burden.

## 17. Change evidence

Minimum useful evidence:

- resource fingerprint before/after
- selected field snapshot before/after for fields CatalogGuard evaluates
- timestamp observed
- source: webhook/full reconciliation/preflight

Do not promise exact human/editor attribution unless Shopify provides reliable evidence for the relevant operation.

## 18. Admin UI extension

Candidate product detail block:

```text
CatalogGuard
--------------------------------
PASS  SKU
PASS  Price
PASS  Barcode
FAIL  Variant media
WARN  SEO description

Policy: Apparel Launch Ready v3
1 blocking issue
[View in CatalogGuard]
```

Business logic remains server-side/shared. Extension is a presentation/action surface.

## 19. Shopify Flow

Candidate trigger:

**CatalogGuard: blocking catalog regression detected**

Payload should be minimal but useful:

- shop
- resource GID
- rule code/name
- policy
- severity
- blocking
- finding URL/deep link

Additional triggers should be demand-driven.

## 20. Notifications

Do not build a full notification center initially.

Potential V1:

- optional daily email digest after core scan/regression reliability is proven
- Shopify Flow trigger so merchant can route to Slack/email/etc using existing automation

## 21. Onboarding

Suggested flow:

1. explain read-only permissions and data use;
2. select starter policy pack;
3. run first complete scan;
4. review counts;
5. establish baseline;
6. optionally tune rules;
7. show first preflight workflow.

Do not force merchants to fix legacy debt before receiving value.

## 22. Empty/error states

Required explicit states:

- no baseline yet
- scan queued/running
- scan failed
- partial/indeterminate scan
- missing/changed Shopify permission
- API throttled/transient failure
- no findings
- no regressions
- policy has no applicable resources
- preflight indeterminate

Never silently substitute stale success for a failed fresh scan.

## 23. Accessibility/usability

- keyboard-operable interfaces
- semantic status text, not color-only meaning
- accessible tables/filters
- responsive Shopify Admin embedded layout
- concise operational wording
- direct links to affected products

## 24. Analytics

Product analytics should focus on product value without collecting unnecessary merchant/customer data.

Key events:

- install completed
- first scan completed
- baseline established
- policy created/edited
- regression viewed
- exception created
- preflight run
- preflight failure fixed and rerun
- Flow trigger enabled/used if measurable safely
- uninstall

## 25. V1 acceptance product scenario

Using a Shopify dev store:

1. install app;
2. run initial scan;
3. establish baseline with all current findings classified as debt;
4. create/enable `SKU required` as blocking;
5. modify a previously passing variant so SKU becomes blank;
6. webhook/incremental evaluation creates new regression;
7. finding appears with correct rule/resource/value;
8. product preflight fails;
9. create exception with expiry -> preflight becomes `PASS_WITH_WAIVERS`;
10. revoke exception -> preflight fails again;
11. restore SKU -> finding resolves;
12. preflight passes;
13. full reconciliation produces the same current result.

If this scenario is not reliable, the core product is not ready for pilot merchants.
