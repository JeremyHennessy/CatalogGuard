# CatalogGuard

CatalogGuard is a Shopify catalog policy, regression-detection, and preflight QA application.

> **Product position:** GitHub-style branch protection / CI for a Shopify catalog.
>
> CatalogGuard is **not** a generic store-health-score scanner, SEO copywriter, PIM replacement, storefront editor, or automatic bulk fixer.

## Canonical project state

This repository is the source of truth for product scope, architecture, engineering decisions, quality gates, commercial assumptions, and future handoffs.

**Baseline established:** 2026-09-03

**Baseline status:** Planning / architecture baseline only. No production Shopify app has been implemented, deployed, submitted, approved, or verified yet.

**Current Shopify API target:** GraphQL Admin API `2026-07` (stable as of 2026-09-03).

Before making consequential changes, read:

1. [`AGENTS.md`](AGENTS.md)
2. [`PROJECT_BASELINE.md`](PROJECT_BASELINE.md)
3. [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md)
4. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
5. [`docs/RULE_ENGINE.md`](docs/RULE_ENGINE.md)
6. [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md)
7. [`docs/ROADMAP.md`](docs/ROADMAP.md)
8. [`docs/QUALITY_AND_RELEASE.md`](docs/QUALITY_AND_RELEASE.md)
9. [`docs/SHOPIFY_PLATFORM_BASELINE.md`](docs/SHOPIFY_PLATFORM_BASELINE.md)
10. [`docs/COMMERCIAL_PLAN.md`](docs/COMMERCIAL_PLAN.md)
11. [`docs/COMPETITIVE_BASELINE.md`](docs/COMPETITIVE_BASELINE.md)
12. [`docs/HANDOFF.md`](docs/HANDOFF.md)
13. [`docs/DECISION_LOG.md`](docs/DECISION_LOG.md)

## Product thesis

Most catalog audit apps answer:

> What is wrong with my store right now?

CatalogGuard is intended to answer the more operationally valuable questions:

- What does **this merchant** define as a valid catalog?
- What is existing catalog debt versus a **new regression**?
- What changed, and which change introduced a violation?
- Which violations are intentionally accepted exceptions?
- Is a collection, supplier import, or product launch safe to proceed?
- Can catalog-policy events feed the merchant's existing Shopify Flow workflows?

The intended product loop is:

```text
Define policy
    -> Establish baseline
    -> Observe Shopify changes
    -> Re-evaluate affected resources
    -> Detect new regressions
    -> Triage / fix / waive
    -> Run preflight
    -> Pass or fail with evidence
```

## MVP product surfaces

### 1. Catalog dashboard

Show operational status, not vanity scoring:

- passing products / variants
- critical findings
- warnings
- new regressions
- resolved findings
- accepted exceptions
- policy coverage
- last complete reconciliation

### 2. Deterministic rule engine

Initial rule families:

- SKU presence / uniqueness / format
- barcode presence / uniqueness / configurable GTIN validity
- price / compare-at-price validity
- cost presence when configured and permitted
- physical-product weight requirements
- media count / variant-media requirements where supported
- product-description and SEO field requirements
- taxonomy / category requirements
- variant option structure
- allowed option values
- inventory configuration rules where permitted
- tags
- vendor / product type
- metafields
- conditional rules based on product scope

### 3. Policy packs

Initial templates:

- Basic Catalog Integrity
- 3PL / Warehouse Ready
- Google Shopping Ready
- Apparel
- Wholesale / B2B

Policy packs are starting points. Merchant-specific policy is the core product.

### 4. Baseline and regression detection

CatalogGuard must distinguish:

- pre-existing finding
- new regression
- resolved finding
- accepted exception
- expired exception
- re-opened regression

A large legacy catalog with 500 known warnings must not generate the same operational signal as a supplier import that introduces 15 new critical violations today.

### 5. Exceptions / waivers

Merchants can acknowledge a finding with:

- reason
- actor where available
- creation timestamp
- optional expiration
- optional notes / evidence

Exceptions must never silently delete the underlying failed evaluation.

### 6. Preflight

Run policy validation against:

- one product
- selected products
- a collection
- a proposed launch set
- eventually a Shopify CSV import before it is applied

Preflight must produce explicit pass / fail criteria and retain run evidence.

### 7. Continuous monitoring

Use Shopify webhooks for incremental evaluation and scheduled / on-demand full reconciliation to protect against missed events, permission changes, API failures, or logic drift.

### 8. Shopify Admin integration

Where supported and useful, surface product policy state directly in Shopify Admin via Admin UI extensions.

### 9. Shopify Flow integration

CatalogGuard should expose specialized catalog-policy triggers to Shopify Flow rather than building a generic automation engine.

## Non-goals for V1

Do **not** add these without a specific, evidence-backed decision:

- AI product-copy generation
- AI image generation
- generic SEO suite
- storefront/theme modification
- advertising management
- order analytics
- customer analytics
- PIM replacement
- 3PL integration
- destructive automatic bulk repair
- broad write access to products
- a generic workflow builder that duplicates Shopify Flow
- unsupported claims that CatalogGuard can universally block Shopify's native publish/save action

The initial application should be predominantly **read-only**.

## Engineering baseline

Preferred stack:

- Shopify CLI
- Shopify's recommended React Router app template
- TypeScript
- `@shopify/shopify-app-react-router`
- Shopify App Bridge
- Shopify GraphQL Admin API
- Prisma
- PostgreSQL before production multi-instance deployment
- Admin UI extensions where justified
- Shopify Flow extension(s) after core policy/regression behavior is stable
- GitHub Actions for quality gates and deployment workflow

Preferred topology:

```text
GitHub
  -> CI / quality gate
  -> application host
       -> CatalogGuard server
       -> PostgreSQL
       -> background / reconciliation execution
       -> Shopify GraphQL Admin API
       -> Shopify webhooks
```

GitHub Pages may be used for static marketing/docs if desired, but it is **not** the production backend for a public Shopify app requiring secure server-side authentication, secrets, webhooks, database access, and background processing.

Hosting vendors are implementation candidates, not immutable architectural requirements. Validate webhook reliability, background-job duration, database connectivity, observability, and cost before choosing a production host.

## Data-minimization baseline

CatalogGuard should avoid protected customer data entirely unless a future feature has a compelling product requirement and receives an explicit architecture/privacy review.

Initial scope should focus on catalog/shop configuration data. Do not request orders, customers, buyer identity, payment, or fulfillment data merely because it is available.

## Permission baseline

Start with the minimum scopes required for the implemented rules.

Expected initial direction:

- `read_products`
- add inventory-related read scopes only when inventory checks actually require them

Do not request `write_products` in the initial read-only product solely for convenience.

Exact scopes must be verified against the Shopify API and extension features implemented at that time.

## Release principle

No work is considered complete because files changed, a commit exists, or a deployment ran.

A phase is complete only when its acceptance criteria and required evidence in [`docs/QUALITY_AND_RELEASE.md`](docs/QUALITY_AND_RELEASE.md) are satisfied.

## Source-of-truth hierarchy

When instructions conflict, resolve them in this order:

1. Explicit current user direction
2. An explicitly approved project baseline / checkpoint
3. `PROJECT_BASELINE.md`
4. `docs/DECISION_LOG.md`
5. Detailed specification documents in `docs/`
6. Open GitHub issue scope
7. Current implementation
8. Assumptions

Never silently reinterpret an approved checkpoint from the nearest commit.

## Resume instructions for another chat / agent

Before doing work:

1. Read the canonical files listed at the top of this README.
2. Inspect current `main`, open PRs, open issues, and CI status.
3. Establish the exact current head SHA.
4. Compare requested work with the baseline and decision log.
5. Verify any time-sensitive Shopify platform assumptions against official Shopify documentation.
6. Work on the smallest necessary surface.
7. Record material decisions and update handoff state.
8. Do not report success until the relevant tests / Shopify dev-store behavior / deployment evidence are actually verified.

See [`docs/HANDOFF.md`](docs/HANDOFF.md) for the required handoff format.

## Current implementation status

At baseline creation:

- Repository contained only its initial README.
- No Shopify application code existed.
- No Shopify Partner / Dev Dashboard app configuration was verified.
- No development store connection was verified.
- No production host was configured or verified.
- No PostgreSQL database was configured or verified.
- No billing configuration was implemented or verified.
- No App Store submission existed or was verified.

Any future chat must update these statements only with evidence.

## Official Shopify references used for this baseline

- Scaffold an app: https://shopify.dev/docs/apps/build/scaffold-app
- React Router package: https://shopify.dev/docs/api/shopify-app-react-router/latest
- API versioning: https://shopify.dev/docs/api/usage/versioning
- GraphQL bulk operations: https://shopify.dev/docs/api/usage/bulk-operations/queries
- Admin UI extensions: https://shopify.dev/docs/api/admin-extensions/latest
- Shopify Flow triggers: https://shopify.dev/docs/apps/build/flow/triggers
- App billing: https://shopify.dev/docs/apps/launch/billing
- App Store requirements: https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements
- Privacy law compliance: https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance
- Protected customer data: https://shopify.dev/docs/apps/launch/protected-customer-data
- Access tokens: https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens

These links are references, not substitutes for re-verification when Shopify's platform changes.
