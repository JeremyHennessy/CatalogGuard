# Quality and Release Standard

CatalogGuard is a governance product. False confidence is a product defect. Quality gates therefore emphasize correctness, explainability, and reproducibility over raw feature velocity.

## 1. Definition of done

A task is not done because:

- code was written;
- a commit exists;
- CI started;
- a deployment completed;
- a screenshot looks correct.

It is done only when the acceptance criteria for the changed layer are verified with evidence.

## 2. Baseline CI gate

Once implementation begins, `main` should require a quality workflow including at minimum:

- dependency install using locked versions;
- formatting check;
- lint;
- TypeScript typecheck;
- unit tests;
- rule fixture tests;
- lifecycle tests;
- build;
- Prisma schema/migration validation.

Add integration/extension tests as those components exist.

## 3. Required test families

### Rule tests

Every rule:

- PASS
- FAIL
- NOT_APPLICABLE when scoped
- UNKNOWN when required evidence unavailable
- boundaries
- null/empty/whitespace
- malformed configuration

### Normalization tests

Use saved GraphQL-shaped fixtures to verify:

- product fields;
- variant fields;
- tags/types/vendors;
- descriptions/SEO;
- media counts;
- categories;
- metafields;
- inventory/weight fields when introduced;
- missing/deprecated fields.

### Scope tests

- all match
- no match
- any match
- missing scope input -> UNKNOWN where applicability is uncertain

### Finding lifecycle tests

- baseline debt
- new regression
- resolution
- reopen
- exception
- exception expiry
- exception revoke
- policy-change failure
- UNKNOWN recovery

### Uniqueness/index tests

- unique SKU
- duplicate SKU
- duplicate removed
- duplicate created incrementally
- variant deletion
- blank identifiers ignored or handled according to rule contract

### Webhook tests

- valid HMAC
- invalid HMAC rejected
- duplicate delivery
- retry
- processing failure
- app uninstall
- mandatory compliance topics

### Preflight tests

- PASS
- PASS_WITH_WAIVERS
- FAIL
- INDETERMINATE
- policy revision immutability
- target materialization/history

### Data deletion tests

- uninstall state
- shop redact deletes/anonymizes all relevant shop-scoped data
- no orphaned catalog snapshots/findings remain unless explicitly/legal retained and anonymized

## 4. Shopify dev-store acceptance suite

Before pilot release, run a representative live integration scenario.

### Install/auth

- clean install
- embedded app opens
- session/auth works in supported browser/incognito conditions per Shopify requirements
- requested scopes match documented scopes

### Full scan

- seed known products/variants
- scan completes
- source counts reconcile
- known defects exactly match expected findings

### Regression

- establish baseline
- edit one passing resource into a violation
- observe webhook/incremental evaluation
- verify new regression
- restore data
- verify resolution

### Reconciliation

- intentionally bypass/disable incremental processing in a test scenario where practical
- run full reconciliation
- verify local state converges to Shopify source

### Exception

- create waiver
- verify enforcement state
- expire/revoke
- verify violation returns

### Preflight

- fail -> fix -> pass
- waiver -> PASS_WITH_WAIVERS
- missing required evidence -> INDETERMINATE

## 5. Large-catalog performance test

Before pricing/marketing “large catalog” support:

Create representative generated data or pilot store data covering at least:

- thousands of products/variants;
- duplicate identifiers;
- multiple policy scopes;
- metafield rules;
- multiple findings per product.

Measure:

- Shopify bulk operation duration;
- result file size;
- parsing memory;
- DB write duration;
- rule evaluations/sec;
- scan total duration;
- identifier-index performance;
- findings-query latency;
- DB storage growth.

Do not publish catalog-size performance claims until measured.

## 6. Migration gate

Every production DB migration must be tested:

### Clean

```text
empty DB -> all migrations -> current schema
```

### Upgrade

```text
previous supported schema + representative data -> migration -> current schema
```

For destructive transformations:

- backup/rollback plan;
- explicit migration note;
- verify historical finding/preflight evidence is preserved or intentionally transformed.

## 7. API-version gate

Before changing Shopify API version:

1. read official version changelog;
2. list used GraphQL fields/mutations/webhook topics/extensions affected;
3. update fixtures;
4. run normalization/rule tests;
5. run dev-store full scan;
6. run webhook regression scenario;
7. test extensions;
8. update platform baseline/decision log;
9. record deployed SHA.

## 8. Access-scope gate

Any new Shopify scope requires:

- feature requiring it;
- exact API fields/actions needing it;
- least-privilege alternative considered;
- privacy/security impact reviewed;
- uninstall/redaction implications reviewed;
- docs updated;
- dev-store reinstall/reauthorization path tested where required.

Do not add scopes speculatively.

## 9. UI release acceptance

For every major embedded page:

- loading state;
- empty state;
- error state;
- partial/UNKNOWN state where applicable;
- responsive width in Shopify Admin;
- keyboard accessibility;
- status not encoded by color alone;
- direct affected-resource navigation works;
- large finding list remains usable.

For approved UI states, unrelated backend fixes must not cause visual regressions.

## 10. Error-state requirements

Never show a successful status when the source operation failed.

Examples:

- full scan failure -> explicit failed/degraded state;
- preflight missing blocking evidence -> INDETERMINATE;
- Shopify permission lost -> affected rules UNKNOWN;
- stale data -> show freshness, do not imply fresh evaluation;
- webhook processor backlog -> operational state should expose degraded monitoring if material.

## 11. Security gate

Before any external pilot:

- no secrets committed;
- environment configuration documented;
- dependency vulnerabilities reviewed;
- webhook HMAC verified;
- session/auth uses official current approach;
- token storage encrypted/protected according to host/database capability;
- logs scrub secrets/tokens;
- mandatory privacy endpoints implemented;
- shop deletion tested;
- CSP/embedded behavior meets Shopify requirements;
- only required scopes requested.

## 12. Billing gate

Before charging through Shopify:

Test:

- new install and plan selection;
- free/trial behavior if offered;
- upgrade;
- downgrade;
- cancellation/uninstall;
- reinstall;
- entitlement refresh;
- plan-page behavior;
- billing errors.

Use Shopify-provided billing for App Store-distributed paid functionality.

## 13. Release evidence record

Each meaningful release/handoff should record:

```text
Release / checkpoint name
Date/time
Branch
Commit SHA
PR number
CI run IDs + conclusion
Deployment identifier/URL
Shopify app version/config version if applicable
DB migration version
Shopify API version
Dev-store acceptance performed? yes/no + evidence
Known issues
Rollback reference
```

Store current state in `docs/HANDOFF.md` or a versioned release note once releases become frequent.

## 14. Approval checkpoint

When the user explicitly approves a working state, record immediately:

- exact SHA;
- what behavior/UI was approved;
- environment/deployment evidence;
- relevant migration/config/API version;
- screenshots if available;
- timestamp.

That state becomes an immutable reference point. Future changes do not redefine what was approved.

## 15. Rollback principle

Every experimental production change should have an identified rollback path before deployment.

If an experiment fails:

- revert it;
- verify reversion;
- do not stack another speculative change on the failed state.

## 16. No mock-success rule

Fixtures and mocks are appropriate for tests.

They must not be substituted for failed production Shopify data in a way that makes the merchant believe a scan/preflight succeeded.

Production source failure must remain visible.
