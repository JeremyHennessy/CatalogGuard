# Architecture

## 1. Architectural objective

CatalogGuard must be reliable enough to make operational claims about catalog compliance without over-collecting merchant data or creating a high-maintenance infrastructure footprint.

The architecture should optimize for:

- deterministic rule execution;
- reproducible historical evidence;
- webhook-driven incremental updates;
- complete reconciliation for correctness;
- low privilege;
- low operational overhead;
- straightforward Shopify App Store review;
- testability independent of a live merchant store where possible.

## 2. Baseline stack

### App framework

- Shopify CLI
- Shopify React Router app template
- TypeScript
- `@shopify/shopify-app-react-router`
- Shopify App Bridge / Shopify-provided UI primitives

### API

- Shopify GraphQL Admin API
- Initial pin: `2026-07`

Do not introduce REST Admin API usage for new public-app functionality.

### Persistence

- Prisma
- local development may begin with the scaffold's SQLite setup
- production target: PostgreSQL

### Testing

- TypeScript unit tests
- deterministic rule-fixture suite
- integration tests for persistence and lifecycle logic
- Shopify dev-store integration tests
- Admin UI extension unit/integration coverage where Shopify tooling supports it

## 3. Logical components

```text
Shopify Admin
   |
   | embedded app / admin extension
   v
CatalogGuard Web Application
   |
   +--> Auth/session boundary
   +--> Product UI/loaders/actions
   +--> Policy service
   +--> Finding service
   +--> Preflight service
   +--> Scan orchestrator
   +--> Webhook receiver
   |
   v
CatalogGuard domain layer
   |
   +--> Shopify normalization
   +--> Rule engine
   +--> Scope evaluator
   +--> Finding lifecycle engine
   +--> Regression classifier
   +--> Exception evaluator
   +--> Snapshot/diff logic
   |
   v
PostgreSQL

Background execution
   |
   +--> full scans / reconciliation
   +--> bulk operation result processing
   +--> retry work
   +--> exception-expiry checks
   +--> optional digest/Flow dispatch

External
   |
   +--> Shopify GraphQL Admin API
   +--> Shopify webhooks
   +--> Shopify Flow trigger API/extension
```

## 4. Domain boundary

Rule evaluation must not be embedded directly in route components or Shopify webhook handlers.

Preferred structure:

```text
app/
  routes/
  shopify.server.ts
  services/
    shopify/
    scans/
    policies/
    findings/
    preflight/
    webhooks/
  domain/
    normalization/
    rules/
    scopes/
    findings/
    regressions/
    exceptions/
    snapshots/
  db/
  extensions/
```

The exact scaffold structure can differ, but business logic should remain framework-independent enough to run in unit/fixture tests.

## 5. Shopify data flow

### Initial/full scan

```text
Merchant requests scan / scheduled reconciliation
  -> create Scan row
  -> start GraphQL bulk query
  -> persist bulk operation identifier/status
  -> receive/poll completion using supported Shopify pattern
  -> download result
  -> parse streaming where practical
  -> normalize selected catalog fields
  -> evaluate applicable policy rules
  -> upsert current findings/lifecycle evidence
  -> write scan summary
  -> mark reconciliation watermark
```

Do not hold a web request open for a full large-catalog scan.

Shopify GraphQL bulk operations are intended for asynchronous bulk retrieval and should be preferred over hand-written pagination for the full catalog where appropriate.

## 6. Incremental flow

```text
Shopify catalog webhook
  -> verify HMAC
  -> persist receipt/idempotency key
  -> acknowledge promptly
  -> enqueue/process affected resource refresh
  -> fetch authoritative resource state when needed
  -> normalize
  -> compare fingerprint/snapshot
  -> evaluate rules
  -> update finding lifecycle
  -> optionally dispatch Flow trigger / notification
```

Do not assume every webhook payload contains every field needed for rule evaluation. Treat the webhook primarily as a change signal and fetch authoritative current state when required.

## 7. Webhook correctness

Requirements:

- HMAC verification;
- idempotent processing;
- duplicate delivery tolerance;
- out-of-order delivery tolerance where practical;
- prompt HTTP acknowledgement;
- retryable background processing;
- persistent failure visibility;
- reconciliation to recover from missing deliveries.

A webhook is evidence that an event was delivered, not proof that local state is complete.

## 8. Reconciliation strategy

Reconciliation protects against:

- missed webhook deliveries;
- webhook handler outages;
- permission changes;
- product changes outside expected topics;
- local processing bugs;
- normalization/rule-engine version changes.

Initial recommendation:

- on-demand full reconciliation always available;
- scheduled reconciliation frequency tied to plan/value after performance testing;
- after rule/policy engine material changes, support explicit re-evaluation/reconciliation.

Do not advertise “real-time correctness” unless measured behavior supports that claim.

## 9. Normalization layer

Shopify API objects should be converted into an internal, versioned evaluation model.

Example concept:

```ts
type NormalizedProduct = {
  gid: string;
  status: string;
  title: string;
  vendor?: string | null;
  productType?: string | null;
  tags: string[];
  categoryId?: string | null;
  descriptionText?: string | null;
  seo?: { title?: string | null; description?: string | null };
  mediaCount: number;
  metafields: Record<string, unknown>;
  variants: NormalizedVariant[];
};
```

Do not expose raw GraphQL response shape directly to every rule.

Normalization schema/version must be tracked when necessary to explain historical evaluations.

## 10. Snapshot strategy

Avoid storing the entire merchant catalog indefinitely if not required.

Store the minimal subset needed for:

- current evaluation;
- finding explanation;
- regression detection;
- selected before/after change evidence;
- historical preflight reproducibility.

Use deterministic fingerprints to detect relevant changes.

Possible approach:

```text
canonical normalized evaluation payload
  -> stable JSON serialization
  -> hash/fingerprint
```

Historical field snapshots can be compact and limited to fields covered by enabled policies.

## 11. Global uniqueness rules

Rules such as SKU uniqueness cannot always be evaluated from one isolated product.

Maintain/query store-level indexes for identifiers, or evaluate uniqueness in scan context.

Example internal index concept:

```text
IdentifierIndex
  shopId
  type = SKU | BARCODE
  normalizedValue
  resourceGid
  variantGid
```

Incremental updates must update the index transactionally enough that duplicate detection is reliable.

Do not implement uniqueness by issuing one Shopify search query per variant during a full scan.

## 12. Transactions / consistency

Where one resource update affects multiple findings/indexes:

- normalize first;
- update resource/snapshot/index state in a DB transaction where practical;
- run finding lifecycle updates consistently against one observed version;
- make reprocessing idempotent.

A partially processed resource should not silently become the latest successful evaluation.

## 13. Scan status model

Candidate statuses:

```text
QUEUED
FETCHING
PROCESSING
COMPLETED
COMPLETED_WITH_WARNINGS
FAILED
CANCELLED
```

Track counts and an error summary.

If only part of a store was processed, do not call the scan complete.

## 14. Background execution / hosting requirements

Production hosting must support or integrate with:

- secure HTTPS endpoints;
- Shopify session-token/OAuth requirements;
- webhook endpoints;
- database migrations;
- processing jobs beyond a normal browser request lifetime;
- scheduled reconciliation;
- retries/backoff;
- logs/metrics/error tracking.

Candidate deployment models can include a conventional Node web service plus worker/cron, or a serverless app plus a reliable external queue/job mechanism.

No host is approved in this baseline.

Before selecting one, run a proof that processes a representative Shopify bulk result without violating runtime/time/memory constraints.

## 15. Authentication/token baseline

Use official Shopify app tooling.

As of baseline date:

- embedded apps are subject to Shopify session-token requirements;
- public apps are moving/required to use expiring offline access tokens for Admin API calls;
- current scaffold/tooling should be used rather than inventing token rotation.

Token storage must be compatible with refresh/rotation behavior.

## 16. Access scopes

Start with catalog-only scopes.

Expected initial:

```text
read_products
```

Potential later read scopes depend on exact rules (for example inventory-related fields). Verify current scope requirements before adding.

Do not request:

```text
write_products
read_customers
read_orders
```

unless a specific approved feature demonstrably requires them.

## 17. Mandatory compliance webhooks

Before App Store submission, implement and test Shopify-required privacy compliance topics, including the currently documented:

- `customers/data_request`
- `customers/redact`
- `shop/redact`

CatalogGuard should generally have no customer data to return/redact, but the endpoints are still required for App Store distribution.

`shop/redact` must drive removal/anonymization of shop data in accordance with Shopify requirements and CatalogGuard's documented retention policy.

## 18. Uninstall lifecycle

Handle app uninstall separately from delayed privacy redaction.

On uninstall:

- stop scheduled work;
- invalidate local active-install status;
- stop notifications/Flow dispatch;
- retain/delete data only according to documented policy and Shopify legal/privacy requirements;
- process later `shop/redact` appropriately.

## 19. API version policy

Initial API pin: `2026-07`.

Upgrade procedure:

1. review Shopify release notes/changelog;
2. inspect impacted GraphQL fields/webhook payloads/extensions;
3. add/update fixtures;
4. run rule/normalization tests;
5. run dev-store full scan;
6. run incremental lifecycle scenario;
7. deploy deliberately;
8. record decision and SHA.

Do not use `latest`/`unstable` for production logic casually.

## 20. Observability

Minimum production observability should include:

- request error rate;
- webhook verification failures;
- webhook processing backlog/failures;
- bulk operation status/duration;
- scan duration/failure rate;
- rule-engine errors/UNKNOWN counts;
- DB migration status;
- App Store install/uninstall counts if safely available;
- notification/Flow dispatch failures.

Operational logs must avoid secrets and unnecessary merchant data.

## 21. Failure behavior

The system must prefer explicit uncertainty over false success.

Examples:

- GraphQL permission missing -> `UNKNOWN` for affected rules, not PASS;
- bulk query partial/fails -> scan FAILED/indeterminate, not complete;
- webhook cannot fetch current resource -> retry and show degraded state where relevant;
- policy revision cannot be resolved -> preflight INDETERMINATE;
- stale source used -> freshness visible in preflight evidence.

## 22. Scaling assumptions

Do not prematurely optimize for millions of stores.

Design should comfortably support:

- small stores with tens/hundreds of products;
- medium stores with thousands/tens of thousands of variants;
- large pilot cases sufficient to expose bulk-processing behavior.

Measure bulk result size, rule throughput, DB growth, snapshot retention, and scan latency before designing sharding/distributed infrastructure.

## 23. Suggested repository evolution

After Shopify scaffolding, likely structure:

```text
CatalogGuard/
├── app/
├── extensions/
├── prisma/
├── tests/
│   ├── fixtures/
│   ├── rules/
│   ├── lifecycle/
│   ├── integration/
│   └── shopify/
├── docs/
├── scripts/
├── .github/workflows/
├── shopify.app.toml
├── package.json
├── README.md
├── AGENTS.md
└── PROJECT_BASELINE.md
```

Treat this as a direction, not a requirement to fight Shopify's generated template structure.
