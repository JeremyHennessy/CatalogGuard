# Rule Engine Specification

## 1. Objective

The rule engine is the core CatalogGuard domain component. It must be deterministic, explainable, versionable, testable, and independent of UI concerns.

The engine evaluates normalized Shopify catalog resources against a specific immutable policy revision.

## 2. Evaluation result

Every rule evaluation returns exactly one of:

```text
PASS
FAIL
NOT_APPLICABLE
UNKNOWN
```

Meaning:

- `PASS`: required data was available and the rule condition was satisfied.
- `FAIL`: required data was available and the rule condition was violated.
- `NOT_APPLICABLE`: the rule scope intentionally excludes this resource.
- `UNKNOWN`: the rule should apply or might apply, but required evidence was unavailable/unreliable.

`UNKNOWN` must not be coerced to `PASS`.

## 3. Enforcement disposition

Rule evaluation and enforcement are different.

Suggested enforcement outcomes:

```text
COMPLIANT
VIOLATION
WAIVED
INDETERMINATE
NOT_APPLICABLE
```

Mapping concept:

- PASS -> COMPLIANT
- FAIL + no active exception -> VIOLATION
- FAIL + applicable active exception -> WAIVED
- UNKNOWN -> INDETERMINATE
- NOT_APPLICABLE -> NOT_APPLICABLE

## 4. Severity vs blocking

Keep these independent.

Severity:

```text
INFO
WARNING
ERROR
CRITICAL
```

Blocking:

```text
true | false
```

A warning may block a launch policy. A critical issue may be non-blocking in an informational audit policy. Do not conflate visual severity with enforcement semantics.

## 5. Rule identity

Every built-in rule requires a stable code.

Example convention:

```text
CG-SKU-001
CG-SKU-002
CG-BARCODE-001
CG-PRICE-001
CG-MEDIA-001
CG-META-001
```

Never recycle a rule code for materially different semantics.

Material semantic changes require either:

- rule definition version increment; or
- a new rule code if behavior would make historical evidence ambiguous.

## 6. Rule definition contract

Conceptual interface:

```ts
type RuleResult = {
  status: 'PASS' | 'FAIL' | 'NOT_APPLICABLE' | 'UNKNOWN';
  ruleCode: string;
  ruleVersion: number;
  resourceGid: string;
  subresourceGid?: string;
  observed?: unknown;
  expected?: unknown;
  message: string;
  evidence?: Record<string, unknown>;
  reasonCode?: string;
};

type RuleDefinition<TConfig, TResource> = {
  code: string;
  version: number;
  family: string;
  configSchema: unknown;
  evaluate(resource: TResource, config: TConfig, context: EvaluationContext): RuleResult[];
};
```

Exact implementation may differ, but output must retain equivalent evidence.

## 7. Rule configuration

Each PolicyRule instance contains:

- built-in rule code/version;
- enabled flag;
- configuration object validated against a schema;
- severity;
- blocking flag;
- scope definition;
- optional merchant-facing label/notes.

Configuration must be validated before a policy revision can become active.

## 8. Scope evaluation

Scope is evaluated before rule condition.

V1 scope predicates may include:

- product status
- vendor
- product type
- tag contains
- collection membership
- Shopify category/taxonomy
- selected metafield existence/equality where supported

Result of scope evaluation:

```text
MATCH
NO_MATCH
UNKNOWN
```

- NO_MATCH -> rule result NOT_APPLICABLE
- MATCH -> evaluate rule
- UNKNOWN -> rule result UNKNOWN when scope uncertainty could change applicability

Do not hide scope-data failures as NOT_APPLICABLE.

## 9. Policy revision

Policies are mutable from the merchant's perspective but immutable for evidence.

Model:

```text
Policy (logical identity)
  -> Revision 1
  -> Revision 2
  -> Revision 3 (active)
```

Saving a material policy edit creates a new revision.

Historical scans/preflights point to the exact revision used.

## 10. Initial rule catalog

The exact list is subject to implementation/API verification, but this is the planned baseline.

### SKU

#### CG-SKU-001 — SKU required

Applies to configured variants.

FAIL when SKU is null/empty/whitespace.

#### CG-SKU-002 — SKU unique

FAIL when a normalized non-empty SKU maps to more than one relevant variant in the store-level identifier index.

Normalization must be explicitly defined. Do not silently case-fold or trim in a way that contradicts merchant expectations; if normalization is configurable, record configuration.

#### CG-SKU-003 — SKU pattern

Config: regex/pattern and optional examples.

Reject invalid configuration before policy activation.

### Barcode

#### CG-BARCODE-001 — Barcode required

FAIL when required and absent.

#### CG-BARCODE-002 — Barcode unique

Similar global-index semantics to SKU uniqueness.

#### CG-BARCODE-003 — Barcode format/check-digit

Configurable validation mode, for example GTIN-8/12/13/14 where appropriate.

Do not assume every Shopify barcode is a GTIN. The merchant explicitly enables the validation mode.

### Pricing

#### CG-PRICE-001 — Minimum price

Config: numeric minimum/currency-aware assumptions as applicable.

#### CG-PRICE-002 — Compare-at relationship

Configurable semantics, e.g. compare-at price must be greater than selling price when present.

#### CG-COST-001 — Cost required

Only available if Shopify data/scopes support the configured field. Missing permission/data -> UNKNOWN, not FAIL.

### Completeness

#### CG-DESC-001 — Description required/minimum text

Evaluate normalized text, not raw HTML length.

#### CG-SEO-001 — SEO title required

#### CG-SEO-002 — SEO description required

Length thresholds should be configurable; avoid presenting arbitrary SEO-length folklore as universal truth.

#### CG-CAT-001 — Shopify category required

#### CG-VENDOR-001 — Vendor required / allowed values

#### CG-TYPE-001 — Product type required / allowed values

#### CG-TAG-001 — Required tag(s)

### Media

#### CG-MEDIA-001 — Minimum product media count

Configurable integer threshold.

#### CG-MEDIA-002 — Variant media requirement

Only implement after verifying the exact Shopify relation/data model needed for reliable evaluation.

### Physical/inventory

#### CG-WEIGHT-001 — Positive weight required

Scope should restrict to products/variants where physical shipping semantics make sense.

#### CG-INV-001 — Inventory tracking/configuration

Implement only after exact API fields/scopes are confirmed.

### Variants/options

#### CG-OPT-001 — Required option names

Example: apparel requires `Size` and `Color`.

#### CG-OPT-002 — Allowed option values

Example: Size must be one of configured values.

### Metafields

#### CG-META-001 — Required metafield

Config:

- namespace/key or app-defined selector
- optional type/value conditions

Fetch only the metafields needed by enabled policies where practical.

## 11. Evaluation context

Rules may need store-wide context.

Example:

```ts
type EvaluationContext = {
  shopId: string;
  observedAt: Date;
  apiVersion: string;
  normalizationVersion: string;
  identifierIndex: IdentifierLookup;
  policyRevisionId: string;
  dataAvailability: DataAvailability;
};
```

Global indexes should be explicit dependencies, not hidden database calls from arbitrary rule code.

## 12. Determinism

For identical:

- normalized resource input;
- policy revision;
- rule implementation version;
- store-level evaluation context/index;

output should be identical.

Avoid time-dependent rules unless time is explicitly part of the recorded evaluation context.

## 13. Finding identity

A finding should represent one stable rule violation on one logical resource/subresource.

Suggested deterministic key components:

```text
shopId
policy logical identity or policy scope context where required
ruleCode
resourceGid
subresourceGid / field key if relevant
```

Be careful not to include mutable display values (title/SKU) in finding identity.

A product rename must not create a new finding identity.

## 14. Finding lifecycle

Current evaluation drives lifecycle transitions.

Conceptual transitions:

```text
(no finding) + FAIL during baseline establishment
  -> OPEN / BASELINE_DEBT

(no finding) + FAIL after baseline
  -> OPEN / NEW_REGRESSION

OPEN + PASS
  -> RESOLVED

RESOLVED + FAIL
  -> OPEN / REOPENED_REGRESSION

OPEN FAIL + active exception
  -> evaluation FAIL, enforcement WAIVED

WAIVED + exception expires/revoked while still FAIL
  -> enforcement VIOLATION
```

Do not erase firstSeen/resolution/reopen history.

## 15. Policy changes and classification

If a merchant enables a new rule or tightens a threshold, previously passing resources may now fail without catalog data changing.

Where evidence allows, classify separately:

```text
POLICY_CHANGE_FAILURE
DATA_REGRESSION
UNKNOWN_CAUSE
```

Do not call a policy-created failure a merchant data regression if no source data changed.

## 16. Exception matching

Exception coverage should be explicit.

Minimum V1:

- exact finding/resource+rule exception

Potential later:

- rule + scoped group exception
- product-level exception covering variants

Broad exceptions require careful UX because they can hide future problems.

Active exception logic:

```text
createdAt <= now
AND revokedAt is null
AND (expiresAt is null OR expiresAt > now)
```

Time must be evaluated in a recorded server reference timezone/UTC.

## 17. Preflight evaluation

Preflight evaluates a fixed target set and fixed policy revision.

Final outcome logic baseline:

```text
if any blocking VIOLATION -> FAIL
else if any blocking INDETERMINATE -> INDETERMINATE
else if any WAIVED blocking failures -> PASS_WITH_WAIVERS
else -> PASS
```

Non-blocking warnings are listed but do not fail the preflight.

Policy can choose blocking status per rule.

## 18. Rule engine versioning

Store a coarse `engineVersion` or build SHA in scan/preflight evidence in addition to per-rule versions.

This allows future debugging when normalization/lifecycle behavior changes outside one rule implementation.

## 19. Error handling

A rule implementation exception is not a normal FAIL.

It must:

- be captured/observed;
- produce UNKNOWN/scan warning for affected evaluation;
- contribute to scan degraded/failure status depending on scale;
- never silently mark resource compliant.

## 20. Test contract

Every rule requires fixtures for:

- PASS
- FAIL
- NOT_APPLICABLE where scoped
- UNKNOWN when required data missing/unavailable
- boundary values
- null/empty/whitespace behavior
- Unicode/case behavior where relevant
- malformed configuration rejection

Global rules additionally require:

- duplicate set
- unique set
- update removes duplicate
- update creates duplicate
- deletion removes duplicate
- replay/idempotency scenario

## 21. Golden lifecycle tests

At minimum maintain end-to-end domain tests for:

1. baseline debt creation;
2. new regression;
3. resolution;
4. reopened regression;
5. exception creation;
6. exception expiry;
7. exception revocation;
8. policy-threshold change creating policy-change failure;
9. UNKNOWN transitioning to PASS after data availability returns;
10. full reconciliation matching incremental state.

These tests are core product safety tests and should be quality-gate blockers.
