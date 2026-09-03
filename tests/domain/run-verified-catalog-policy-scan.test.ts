import * as assert from "node:assert/strict";
import { test } from "node:test";
import { runVerifiedCatalogPolicyScanV1 } from "../../app/application/run-verified-catalog-policy-scan";
import { normalizeShopifyCatalogV1 } from "../../app/domain/catalog/shopify-normalizer";
import {
  POLICY_SCHEMA_VERSION,
  validatePolicyRevisionV1,
} from "../../app/domain/policy/contracts";
import { createBuiltinRuleRegistry } from "../../app/domain/rules/registry";
import type {
  PersistPolicyScanInputV1,
  ScanReconciliationRepository,
} from "../../app/persistence/scan-reconciliation-repository";

function completeCatalog() {
  return normalizeShopifyCatalogV1({
    productsComplete: true,
    variantsComplete: true,
    products: [
      {
        id: "gid://shopify/Product/1",
        title: "Minimal product",
        status: "ACTIVE",
        description: "",
        seo: { title: null, description: null },
        vendor: "Vendor",
        productType: "snowboard",
        tags: [],
        category: null,
        mediaCount: { count: 0 },
        variantsCount: { count: 1 },
      },
    ],
    productVariants: [
      {
        id: "gid://shopify/ProductVariant/1",
        title: "Default Title",
        sku: null,
        barcode: null,
        price: "10.00",
        compareAtPrice: null,
        selectedOptions: [{ name: "Title", value: "Default Title" }],
        product: { id: "gid://shopify/Product/1" },
      },
    ],
  });
}

function revision() {
  return validatePolicyRevisionV1(createBuiltinRuleRegistry(), {
    schemaVersion: POLICY_SCHEMA_VERSION,
    id: "policy-revision-1",
    policyId: "policy-1",
    revisionNumber: 1,
    createdAt: "2026-09-03T18:00:00.000Z",
    rules: [
      {
        ruleCode: "CG-SKU-001",
        ruleVersion: 1,
        enabled: true,
        severity: "ERROR",
        blocking: true,
        config: {},
      },
      {
        ruleCode: "CG-MEDIA-001",
        ruleVersion: 1,
        enabled: true,
        severity: "WARNING",
        blocking: false,
        config: { minimum: 1 },
      },
    ],
  });
}

class RecordingRepository implements ScanReconciliationRepository {
  input?: PersistPolicyScanInputV1;

  async persistPolicyScan(input: PersistPolicyScanInputV1) {
    this.input = input;
    return {
      status: "PERSISTED" as const,
      scanId: input.scan.id,
      inputFingerprint: "fingerprint",
      evaluationCount: input.evaluations.length,
      findingCount: 2,
      findingEventCount: 2,
    };
  }
}

test("verified catalog scan composes normalization evidence, policy evaluation, and persistence", async () => {
  const repository = new RecordingRepository();
  const result = await runVerifiedCatalogPolicyScanV1({
    scanId: "scan-1",
    shopId: "shop-1",
    scanType: "FULL_RECONCILIATION",
    apiVersion: "2026-07",
    engineVersion: "test-engine",
    startedAt: "2026-09-03T18:00:00.000Z",
    observedAt: "2026-09-03T18:01:00.000Z",
    finishedAt: "2026-09-03T18:02:00.000Z",
    revision: revision(),
    baseline: true,
    readCatalog: async () => completeCatalog(),
    repository,
  });

  assert.equal(result.productsProcessed, 1);
  assert.equal(result.variantsProcessed, 1);
  assert.equal(result.evaluationCount, 2);
  assert.equal(repository.input?.scan.productsExpected, 1);
  assert.equal(repository.input?.scan.productsProcessed, 1);
  assert.equal(repository.input?.scan.variantsProcessed, 1);
  assert.equal(repository.input?.scan.normalizationVersion, "catalog-v1");
  assert.deepEqual(
    repository.input?.evaluations.map((evaluation) => [
      evaluation.ruleCode,
      evaluation.result.status,
      evaluation.enforcement,
    ]),
    [
      ["CG-MEDIA-001", "FAIL", "VIOLATION"],
      ["CG-SKU-001", "FAIL", "VIOLATION"],
    ],
  );
});

test("verified catalog scan refuses partial catalog evidence before persistence", async () => {
  const repository = new RecordingRepository();
  const partial = normalizeShopifyCatalogV1({
    productsComplete: false,
    variantsComplete: true,
    products: [],
    productVariants: [],
  });

  await assert.rejects(
    () =>
      runVerifiedCatalogPolicyScanV1({
        scanId: "scan-partial",
        shopId: "shop-1",
        scanType: "FULL_RECONCILIATION",
        apiVersion: "2026-07",
        engineVersion: "test-engine",
        startedAt: "2026-09-03T18:00:00.000Z",
        observedAt: "2026-09-03T18:01:00.000Z",
        finishedAt: "2026-09-03T18:02:00.000Z",
        revision: revision(),
        baseline: false,
        readCatalog: async () => partial,
        repository,
      }),
    /partial catalog/,
  );
  assert.equal(repository.input, undefined);
});

test("verified catalog scan rejects inconsistent recorded timestamps", async () => {
  const repository = new RecordingRepository();

  await assert.rejects(
    () =>
      runVerifiedCatalogPolicyScanV1({
        scanId: "scan-time",
        shopId: "shop-1",
        scanType: "FULL_RECONCILIATION",
        apiVersion: "2026-07",
        engineVersion: "test-engine",
        startedAt: "2026-09-03T18:02:00.000Z",
        observedAt: "2026-09-03T18:01:00.000Z",
        finishedAt: "2026-09-03T18:03:00.000Z",
        revision: revision(),
        baseline: false,
        readCatalog: async () => completeCatalog(),
        repository,
      }),
    /observedAt must fall between/,
  );
  assert.equal(repository.input, undefined);
});
