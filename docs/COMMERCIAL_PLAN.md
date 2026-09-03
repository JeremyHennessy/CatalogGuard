# Commercial Plan

## 1. Commercial objective

CatalogGuard is being pursued as a low-overhead Shopify software product with a realistic path to recurring revenue. The first objective is not “maximize features”; it is to prove that Shopify merchants repeatedly use and will pay for catalog governance beyond a one-time audit.

## 2. Market thesis

Generic Shopify catalog-audit utilities already exist and new entrants continue to appear. Competing on “we check more fields” is unlikely to be durable.

CatalogGuard's commercial thesis is that merchants with non-trivial catalogs will pay more for:

- merchant-specific policy;
- new-regression detection;
- preflight evidence;
- exceptions/waivers;
- operational confidence across imports/team edits/launches;

than for a simple health-score scan.

This is a hypothesis to validate, not a proven fact.

## 3. Initial customer segments

Prioritize stores where catalog mistakes have operational consequences.

### Segment A — Mid-size apparel/accessories

Signals:

- many variants;
- size/color structure;
- frequent seasonal launches;
- barcode/SKU/weight/media requirements;
- multiple people editing catalog.

### Segment B — Multi-vendor / distributor catalogs

Signals:

- supplier imports;
- large identifier sets;
- inconsistent vendor data;
- 3PL/feed requirements.

### Segment C — Shopify agencies

Signals:

- repeated client launches/migrations;
- catalog cleanup/handoff work;
- need for repeatable QA evidence.

### Segment D — Growing DTC operations teams

Signals:

- thousands of products/variants;
- spreadsheet/CSV workflow;
- recent hiring/delegation;
- frequent merchandising changes.

## 4. Lower-priority initial segments

- stores with only a handful of products;
- merchants who rarely change catalog data;
- merchants primarily looking for AI copy/SEO generation;
- businesses requiring a full PIM/MDM/ERP integration immediately.

These users may install an audit tool but are less likely to value ongoing regression protection.

## 5. Value proposition tests

Test these messages separately.

### Position A — Regression protection

> Know what broke today, not just everything that has ever been wrong.

### Position B — Launch preflight

> Run a pass/fail catalog check before you launch a collection or import supplier data.

### Position C — Catalog policy

> Define your store's product-data rules once and check every change against them.

### Position D — Operations guardrails

> Catch duplicate SKUs, missing barcodes, zero prices, missing weights, and policy violations before they spread.

Do not assume the internal engineering concept “CI for catalog” is the best App Store customer-facing copy without testing merchant comprehension.

## 6. Pricing hypotheses

Do not lock pricing before pilot evidence.

### Free / Pilot

Possible constraints:

- up to ~100 products; or
- manual scan only; or
- one built-in policy with no continuous monitoring.

Goal: let merchants experience real findings without giving away the recurring regression/preflight value.

### Guard — hypothesis: ~$19/month

Potential:

- larger catalog allowance;
- custom policy configuration;
- baseline/regression detection;
- manual preflight;
- exceptions.

### Team — hypothesis: ~$49/month

Potential:

- faster/scheduled reconciliation;
- richer history;
- Flow trigger/email alerting;
- policy revision history/export;
- higher limits.

### Agency — hypothesis: ~$99–149/month

Do not implement until multi-store/agency demand exists.

Potential:

- multiple stores;
- shared policy templates;
- cross-store status;
- client reports.

## 7. Pricing principles

- avoid price based solely on number of checks;
- price recurring operational protection, not a one-time report;
- do not create so many product-count tiers that support/billing complexity exceeds value;
- consider catalog size because it affects compute/storage, but prefer simple bands;
- do not offer “unlimited” without measuring large-catalog cost;
- use Shopify-provided billing/App Pricing for App Store distribution.

## 8. Pilot strategy

Target 5–10 real stores before overbuilding App Store polish.

Ideal pilot mix:

- 2 apparel/variant-heavy stores;
- 2 supplier/import-heavy stores;
- 1 agency or consultant managing client stores;
- additional stores chosen for catalog size/complexity diversity.

Offer pilot access in exchange for operational feedback, not incentivized App Store reviews.

## 9. Pilot questions

Do not ask only “do you like it?”

Observe:

- Did they establish a baseline?
- Did they customize a policy?
- How many regressions occurred naturally?
- Did they fix regressions?
- Did they run preflight before real work?
- Did they create legitimate exceptions?
- Which checks produced false positives?
- Which missing rule blocked value?
- Did anyone invite teammates/ask for alerts?
- Would they keep it installed at $19/$49?
- What existing tool/process would they stop using?

## 10. Core activation metric

A better activation definition than “completed first scan”:

> Merchant establishes a baseline **and** subsequently reviews at least one new regression or runs a preflight.

The first free audit is acquisition. Repeated governance behavior is product value.

## 11. Retention signals

Track, by store where privacy-safe:

- active installation;
- policies still active;
- regressions detected/reviewed;
- preflights run;
- findings resolved;
- exceptions actively managed;
- Flow/notification usage;
- time since last meaningful interaction.

A store that runs one scan and never returns is not strong validation even if the scan found many problems.

## 12. Commercial gates

### Gate A — Problem validation

Before major post-MVP investment:

- at least 5 relevant merchant/operator conversations; and
- at least 3 say regression/preflight is a real recurring problem, not merely “nice to have.”

### Gate B — Product validation

- at least 5 pilot installations;
- at least 3 complete baseline + second meaningful workflow (regression review or preflight);
- no unresolved core correctness issue.

### Gate C — Willingness to pay

At least several pilot users agree to a paid continuation or a price test produces actual paid conversions.

Do not interpret “I'd probably pay” as equivalent to payment.

### Gate D — App Store scale

Proceed to broader acquisition only after:

- install/onboarding is reliable;
- support burden is manageable;
- false positives/UNKNOWN behavior is acceptable;
- pricing entitlements are tested;
- App Store requirements are satisfied.

## 13. Revenue planning ranges

Do not put unverified competitor revenue into planning.

Use scenario math.

At $19 average MRR:

```text
10 paid stores   = $190 MRR
25 paid stores   = $475 MRR
50 paid stores   = $950 MRR
100 paid stores  = $1,900 MRR
250 paid stores  = $4,750 MRR
```

At a blended $30 average MRR:

```text
10 stores   = $300 MRR
50 stores   = $1,500 MRR
100 stores  = $3,000 MRR
250 stores  = $7,500 MRR
```

These are arithmetic scenarios, not forecasts.

## 14. Cost model to measure

Record per-store operating cost drivers:

- DB storage;
- snapshot retention;
- bulk result processing;
- scheduled scans;
- background job runtime;
- logging/monitoring;
- email/notification cost;
- support time.

Rule evaluation itself should be cheap. Large-catalog data movement and retention are more likely to drive infrastructure cost.

## 15. Distribution strategy

### Shopify App Store search

Potential keyword families:

- product audit
- catalog audit
- duplicate SKU
- barcode audit
- product data quality
- catalog QA
- product validation
- catalog monitoring
- catalog change detection
- launch checklist

Do not keyword-stuff or make unsupported claims.

### Direct outreach

Target operators/agencies who visibly manage large Shopify catalogs.

Lead with one concrete workflow:

> We built a Shopify guardrail that tells you which catalog problems are new since your baseline and lets you preflight a collection before launch.

### Agency channel

Potentially strong because one agency can expose multiple stores, but don't build an agency dashboard before proving agency pull.

### Content/SEO

Useful topics:

- duplicate SKU consequences in Shopify operations;
- Shopify catalog launch checklist;
- product data QA before CSV import;
- how to audit barcodes/weights/options;
- catalog regression vs catalog cleanup.

## 16. Competitive response policy

Do not chase every competitor feature.

When a competitor adds something:

1. determine whether merchants actually value it;
2. determine whether it strengthens CatalogGuard's core governance loop;
3. measure support/privacy/scope cost;
4. only then consider adding it.

## 17. App Store review strategy

Optimize the product to be easy to explain to reviewers:

- clear read-only scope initially;
- no unnecessary protected customer data;
- deterministic behavior;
- transparent limitations;
- Shopify billing;
- working uninstall/privacy handlers;
- truthful listing screenshots/copy.

## 18. Initial naming/brand note

`CatalogGuard` is a working product/repository name. Before commercial launch:

- check Shopify App Store naming conflicts;
- search trademark/domain availability as appropriate;
- avoid delaying technical pilot solely for branding unless a conflict is identified.

No trademark availability has been verified in this baseline.

## 19. Kill / pivot criteria

Reassess or narrow the product if, after a credible pilot:

- merchants consistently want only a one-time free audit;
- very few real regressions occur;
- preflight is not used before real launches/imports;
- custom rules create excessive setup burden;
- rule false positives undermine trust;
- users demand automatic editing more than governance;
- support cost makes $19–49/month unattractive.

Possible pivot directions if evidence supports them:

- agency QA/handoff product;
- supplier/CSV preflight specialist;
- SKU/barcode operations monitor;
- launch-readiness product;
- PIM QA integration layer.

Do not pivot based on one anecdote.
