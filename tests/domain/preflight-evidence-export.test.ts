import * as assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPreflightEvidenceExportV1,
  preflightEvidenceExportJsonV1,
  type PreflightRunEvidenceDetailV1,
} from "../../app/application/preflight-evidence-export";
import { canonicalJsonStringify } from "../../app/persistence/json";

function detailFixture(
  overrides: Partial<PreflightRunEvidenceDetailV1> = {},
): PreflightRunEvidenceDetailV1 {
  return {
    id: "preflight-1",
    shopId: "shop-1",
    scanId: "scan-1",
    policyRevisionId: "revision-1",
    targetType: "COLLECTION",
    status: "COMPLETE",
    outcome: "FAIL",
    targetDefinitionJson: canonicalJsonStringify({
      inputFingerprint: "fingerprint-1",
      targetDefinition: {
        targetType: "COLLECTION",
        collectionGid: "gid://shopify/Collection/5",
        collectionHandle: "launch",
      },
    }),
    sourceFreshnessAt: "2026-09-04T15:30:00.000Z",
    blockingViolationCount: 1,
    waiverCount: 0,
    indeterminateBlockingCount: 0,
    createdByActor: "example.myshopify.com",
    createdAt: "2026-09-04T15:30:00.000Z",
    completedAt: "2026-09-04T15:30:00.000Z",
    policyRevision: {
      id: "revision-1",
      revisionNumber: 3,
      nameSnapshot: "Launch Policy",
      schemaVersion: 1,
      createdAt: "2026-09-04T14:00:00.000Z",
    },
    scan: {
      id: "scan-1",
      shopId: "shop-1",
      scanType: "PREFLIGHT",
      status: "COMPLETE",
      policyRevisionId: "revision-1",
      apiVersion: "2026-07",
      engineVersion: "test-engine",
      normalizationVersion: "shopify-normalized-catalog-v1",
      startedAt: "2026-09-04T15:30:00.000Z",
      finishedAt: "2026-09-04T15:30:00.000Z",
      productsExpected: 1,
      productsProcessed: 1,
      variantsProcessed: 1,
      passCount: 0,
      failCount: 1,
      unknownCount: 0,
      notApplicableCount: 0,
      warningCount: 0,
      metadataJson: canonicalJsonStringify({
        evidenceOnly: true,
        inputFingerprint: "fingerprint-1",
        preflightRunId: "preflight-1",
        targetCount: 2,
      }),
    },
    targets: [
      {
        resourceType: "PRODUCT",
        resourceGid: "gid://shopify/Product/1",
        resourceFingerprint: "product-fingerprint",
      },
      {
        resourceType: "VARIANT",
        resourceGid: "gid://shopify/ProductVariant/11",
        resourceFingerprint: "variant-fingerprint",
      },
    ],
    evaluations: [
      {
        id: "evaluation-1",
        scanId: "scan-1",
        policyRevisionId: "revision-1",
        policyRuleId: "rule-1",
        ruleCode: "CG-SKU-001",
        ruleVersion: 1,
        resourceGid: "gid://shopify/Product/1",
        subresourceGid: "gid://shopify/ProductVariant/11",
        status: "FAIL",
        enforcement: "VIOLATION",
        observedJson: canonicalJsonStringify({ sku: "DUPLICATE" }),
        expectedJson: canonicalJsonStringify({ unique: true }),
        message: "SKU must be unique",
        reasonCode: "DUPLICATE_SKU",
        evidenceJson: canonicalJsonStringify({ duplicateSku: "DUPLICATE" }),
        evaluatedAt: "2026-09-04T15:30:00.000Z",
        policyRule: {
          id: "rule-1",
          severity: "ERROR",
          blocking: true,
          configJson: canonicalJsonStringify({}),
          scopeJson: canonicalJsonStringify({}),
        },
      },
    ],
    ...overrides,
  };
}

test("preflight evidence export parses persisted canonical JSON", () => {
  const detail = detailFixture();
  const exported = buildPreflightEvidenceExportV1(detail);

  assert.equal(exported.schemaVersion, 1);
  assert.equal(exported.preflightRun.inputFingerprint, "fingerprint-1");
  assert.deepEqual(exported.preflightRun.targetDefinition, {
    targetType: "COLLECTION",
    collectionGid: "gid://shopify/Collection/5",
    collectionHandle: "launch",
  });
  assert.deepEqual(exported.scan.metadata, {
    evidenceOnly: true,
    inputFingerprint: "fingerprint-1",
    preflightRunId: "preflight-1",
    targetCount: 2,
  });
  assert.deepEqual(exported.evaluations[0].observed, {
    sku: "DUPLICATE",
  });
  assert.deepEqual(exported.evaluations[0].expected, {
    unique: true,
  });
  assert.deepEqual(exported.evaluations[0].evidence, {
    duplicateSku: "DUPLICATE",
  });
  assert.equal(
    preflightEvidenceExportJsonV1(detail),
    canonicalJsonStringify(exported) + "\n",
  );
});

test("preflight evidence export rejects invalid target definition records", () => {
  const detail = detailFixture({
    targetDefinitionJson: canonicalJsonStringify({
      targetDefinition: {
        targetType: "PRODUCT",
        productGid: "gid://shopify/Product/1",
      },
    }),
  });

  assert.throws(
    () => buildPreflightEvidenceExportV1(detail),
    /missing inputFingerprint/,
  );
});
