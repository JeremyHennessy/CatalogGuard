# Data Model Baseline

This is a logical schema baseline, not a final Prisma schema. Field names/types may change during implementation, but lifecycle/evidence requirements must remain represented.

## 1. Design goals

- support Shopify multi-tenancy safely;
- retain minimal catalog data;
- keep policy revisions immutable for evidence;
- make finding identity/lifecycle explicit;
- support full and incremental scans;
- make webhook processing idempotent;
- support preflight reproducibility;
- support future multi-store agency views without redesigning every table;
- avoid customer/order data in V1.

## 2. Shop

Represents one Shopify store installation.

Suggested fields:

```text
id
shopifyShopId
shopDomain
status                ACTIVE | UNINSTALLED | REDACTED | SUSPENDED
installedAt
uninstalledAt?
redactedAt?
currentScopes
apiVersion
lastSuccessfulFullScanAt?
lastWebhookObservedAt?
createdAt
updatedAt
```

Do not treat `shopDomain` as an immutable human label; Shopify IDs/GIDs should be used where supported for stable identity.

## 3. Session / token storage

Prefer the official Shopify template/library session model and adapt storage to PostgreSQL.

Token/session tables are security-sensitive and should remain separate from domain data where practical.

Must support expiring offline-token/refresh-token behavior required by current Shopify public-app tooling.

## 4. Policy

Logical merchant policy identity.

```text
id
shopId
name
description?
status            ACTIVE | ARCHIVED
activeRevisionId?
createdAt
updatedAt
```

## 5. PolicyRevision

Immutable snapshot of one policy version.

```text
id
policyId
revisionNumber
nameSnapshot
descriptionSnapshot?
schemaVersion
createdAt
createdByActor?
changeSummary?
```

Unique:

```text
(policyId, revisionNumber)
```

Once referenced by a completed scan/preflight, a revision must never be edited in place.

## 6. PolicyRule

Rule instance within one revision.

```text
id
policyRevisionId
ruleCode
ruleVersion
enabled
severity
blocking
configJson
scopeJson
merchantLabel?
merchantNotes?
position?
```

Configuration/scope JSON must pass known schemas before activation.

## 7. RuleDefinition registry

Built-in rule definitions should primarily exist in source code, not as merchant-editable DB logic.

A DB metadata table is optional for display/telemetry, but rule executable code is version-controlled.

Never execute merchant-supplied arbitrary JavaScript as a “custom rule” in V1.

## 8. CatalogResource

Represents current normalized identity/state metadata for an evaluated Shopify resource.

Possible model:

```text
id
shopId
resourceType          PRODUCT | VARIANT
shopifyGid
parentShopifyGid?
displayTitle?
currentFingerprint
normalizationVersion
lastObservedAt
lastSource            FULL_SCAN | WEBHOOK_REFRESH | PREFLIGHT_REFRESH
isDeleted
createdAt
updatedAt
```

Unique:

```text
(shopId, resourceType, shopifyGid)
```

## 9. ResourceSnapshot

Optional/retained evidence of relevant normalized fields.

```text
id
catalogResourceId
fingerprint
payloadJson
normalizationVersion
observedAt
source
scanId?
changeEventId?
```

Retention should be bounded. Store only data required for rule evidence/change explanation.

Potential retention strategy can be introduced after measuring storage growth.

## 10. IdentifierIndex

Supports store-wide uniqueness rules.

```text
id
shopId
identifierType       SKU | BARCODE
normalizedValue
rawValue?
variantGid
productGid
lastObservedAt
```

Indexes:

```text
(shopId, identifierType, normalizedValue)
(shopId, variantGid)
```

Do not apply a uniqueness constraint on normalizedValue because duplicates are the condition being detected.

## 11. Scan

One catalog evaluation run.

```text
id
shopId
scanType             BASELINE | FULL_RECONCILIATION | INCREMENTAL | PREFLIGHT | CSV_PREFLIGHT
status               QUEUED | FETCHING | PROCESSING | COMPLETED | COMPLETED_WITH_WARNINGS | FAILED | CANCELLED
policyRevisionId?
apiVersion
engineVersion
normalizationVersion
startedAt
finishedAt?
sourceWatermark?
productsExpected?
productsProcessed
variantsProcessed
passCount
failCount
unknownCount
notApplicableCount
warningCount
errorSummary?
metadataJson?
```

An incremental scan may represent one affected resource/change batch. If implementation uses a distinct EvaluationRun model instead, preserve equivalent evidence.

Implementation note (2026-09-04): merchant-triggered product and collection preflight create a completed `PREFLIGHT` Scan with normal `Evaluation` rows and `metadataJson` containing `evidenceOnly: true`, the preflight run id, target count, and input fingerprint. They do not update `Finding` or `FindingEvent`; full reconciliation remains the path that mutates current finding lifecycle.

## 12. BulkOperation

Track Shopify asynchronous bulk work explicitly.

```text
id
shopId
scanId
shopifyBulkOperationGid
operationType
status
createdAt
completedAt?
resultUrlObservedAt?
objectCount?
fileSize?
errorCode?
retryCount
```

Do not rely only on transient process memory for bulk-operation state.

## 13. Finding

Stable identity and current lifecycle for one rule/resource violation.

```text
id
shopId
findingKey
ruleCode
resourceType
resourceGid
subresourceGid?
fieldKey?
currentStatus        OPEN | RESOLVED
classification       BASELINE_DEBT | NEW_REGRESSION | REOPENED_REGRESSION | POLICY_CHANGE_FAILURE | UNKNOWN_CAUSE
firstSeenAt
lastSeenAt
resolvedAt?
reopenedCount
latestEvaluationId
createdAt
updatedAt
```

Unique:

```text
(shopId, findingKey)
```

The exact policy context in finding identity needs care. If the same underlying rule/resource can participate in multiple policies, avoid creating confusing duplicate lifecycle objects. One approach is a base rule/resource Finding plus per-policy evaluation/disposition records.

This must be resolved during schema implementation and covered by tests before migration is considered stable.

## 14. Evaluation

Evidence from one rule execution.

```text
id
scanId
policyRevisionId
policyRuleId
ruleCode
ruleVersion
resourceGid
subresourceGid?
status              PASS | FAIL | NOT_APPLICABLE | UNKNOWN
enforcement         COMPLIANT | VIOLATION | WAIVED | INDETERMINATE | NOT_APPLICABLE
observedJson?
expectedJson?
message
reasonCode?
evidenceJson?
evaluatedAt
```

For scale, retaining every PASS evaluation indefinitely may be too expensive. A production optimization may store detailed records primarily for failures/preflight evidence plus aggregate pass counts/fingerprints.

Do not optimize away required historical evidence before measuring actual scale.

## 15. FindingEvent

Lifecycle/audit timeline.

```text
id
findingId
eventType           CREATED | CLASSIFIED | WAIVED | WAIVER_EXPIRED | WAIVER_REVOKED | RESOLVED | REOPENED | RECLASSIFIED
scanId?
evaluationId?
exceptionId?
metadataJson?
createdAt
```

This makes historical transitions explainable without depending on mutable current Finding columns.

## 16. Exception

```text
id
shopId
findingId?
ruleCode?
resourceGid?
coverageType        FINDING_EXACT  (V1)
reason
notes?
createdByActor?
createdAt
expiresAt?
revokedAt?
revokedByActor?
revocationReason?
```

V1 should favor exact exceptions. Broad policy/scope exceptions can be introduced later with explicit semantics.

## 17. ChangeEvent

Represents observed catalog change evidence.

```text
id
shopId
resourceGid
resourceType
source              WEBHOOK | RECONCILIATION | MANUAL_REFRESH
sourceEventId?
observedAt
previousFingerprint?
newFingerprint
changedFieldsJson?
previousSnapshotId?
newSnapshotId?
processingStatus
```

Do not claim exact editor identity unless the data source supplies trustworthy attribution.

## 18. WebhookReceipt

Idempotency and processing evidence.

```text
id
shopId?
shopDomain
shopifyWebhookId? / delivery identifier if supplied
webhookTopic
payloadHash
receivedAt
hmacVerified
processingStatus
processedAt?
retryCount
lastError?
```

Use the strongest stable delivery identifier Shopify provides in the current webhook format. Fallback payload hashing should not be assumed sufficient without collision/replay considerations.

## 19. Preflight

Could use Scan with `scanType=PREFLIGHT` plus specialized target tables.

Suggested PreflightRun:

```text
id
shopId
scanId
policyRevisionId
targetType            PRODUCT | PRODUCT_SET | COLLECTION | CSV
status
outcome               PASS | PASS_WITH_WAIVERS | FAIL | INDETERMINATE
targetDefinitionJson
sourceFreshnessAt?
blockingViolationCount
waiverCount
indeterminateBlockingCount
createdByActor?
createdAt
completedAt?
```


Implementation note (2026-09-04): the persisted slice stores `targetDefinitionJson` as canonical evidence containing `inputFingerprint` plus `targetDefinition`. Product preflight accepts product GIDs, numeric product IDs, or Shopify Admin product URLs. Collection preflight accepts collection GIDs, numeric collection IDs, or Shopify Admin collection URLs, reads live collection product membership through Shopify Admin GraphQL, records `targetType: COLLECTION` with collection GID/handle/title evidence, evaluates the materialized products against the exact active policy revision, and stores exact evaluated product/variant identities and fingerprints. Detail/export loads the shop-scoped persisted `PreflightRun`, linked `Scan`, immutable `PolicyRevision`, materialized targets, evaluations, policy-rule metadata, and any evaluation-linked exception; JSON export parses canonical persisted JSON into a `schemaVersion: 1` evidence payload. Reusing a preflight run or scan ID with different immutable evidence is rejected rather than treated as an update.

## 20. PreflightTarget

Materialize exact evaluated target identity for reproducibility.

```text
id
preflightRunId
resourceType
resourceGid
resourceFingerprint
```

If a collection membership changes after the preflight, the historical run still states exactly what was evaluated.

## 21. AppEvent / AuditEvent

Optional internal audit trail for important merchant actions:

```text
POLICY_CREATED
POLICY_REVISION_ACTIVATED
BASELINE_ESTABLISHED
EXCEPTION_CREATED
EXCEPTION_REVOKED
PREFLIGHT_STARTED
PREFLIGHT_COMPLETED
```

Avoid collecting sensitive staff data unnecessarily. Actor identity can be a minimal Shopify/session identifier if available and justified.

## 22. Subscription

If Shopify App Pricing exposes plan state through app/platform data, store only what is necessary for feature entitlement/caching.

Do not build an independent card/payment database.

Possible fields:

```text
shopId
planKey
status
trialEndsAt?
currentPeriodEnd?
lastSyncedAt
```

Exact billing integration should follow current Shopify App Pricing behavior.

## 23. Data deletion

When `shop/redact` is processed, delete or irreversibly anonymize shop-linked data according to policy/legal requirements.

Tables with `shopId` should make full-shop deletion straightforward.

Create and test a deletion procedure rather than manually enumerating ad hoc SQL at review time.

## 24. Indexing baseline

Likely important indexes:

- Shop by Shopify shop ID/domain
- CatalogResource by shop + GID
- IdentifierIndex by shop + type + normalized value
- Finding by shop + current status + classification
- Finding by shop + rule code
- Evaluation by scan
- Scan by shop + startedAt/status
- WebhookReceipt by delivery/idempotency identifier
- PolicyRevision by policy + revision number
- Exception by finding + active date conditions

Validate with real query plans after representative catalog fixtures exist.

## 25. Migration policy

Every schema migration must be:

- committed;
- reproducible from clean DB;
- tested against the prior supported schema when data-preserving migration is expected;
- reversible or accompanied by an explicit roll-forward recovery plan;
- documented if it changes historical evidence semantics.

Never modify production schema manually without recording the equivalent migration.
