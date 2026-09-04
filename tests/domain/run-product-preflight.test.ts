import * as assert from "node:assert/strict";
import { test } from "node:test";
import { runProductPreflightV1 } from "../../app/application/run-product-preflight";
import type { PreflightEvidencePlanV1 } from "../../app/application/preflight-evidence";
import { normalizeShopifyCatalogV1 } from "../../app/domain/catalog/shopify-normalizer";
import {
  POLICY_SCHEMA_VERSION,
  validatePolicyRevisionV1,
} from "../../app/domain/policy/contracts";
import { createBuiltinRuleRegistry } from "../../app/domain/rules/registry";
import type {
  PersistPreflightEvidenceInputV1,
  PersistPreflightResultV1,
  PreflightRepository,
} from "../../app/persistence/preflight-repository";

function completeCatalog() {
  return normalizeShopifyCatalogV1({
    productsComplete: true,
    variantsComplete: true,
    products: [
      {
        id: "gid://shopify/Product/1",
        title: "Missing SKU product",
        status: "ACTIVE",
        description: "",
        seo: { title: null, description: null },
        vendor: "Vendor",
        productType: "snowboard",
        tags: [],
        category: null,
        mediaCount: { count: 1 },
        variantsCount: { count: 1 },
      },
      {
        id: "gid://shopify/Product/2",
        title: "Ready product",
        status: "ACTIVE",
        description: "Ready",
        seo: { title: "Ready product", description: "Ready" },
        vendor: "Vendor",
        productType: "snowboard",
        tags: ["launch"],
        category: null,
        mediaCount: { count: 2 },
        variantsCount: { count: 1 },
      },
    ],
    productVariants: [
      {
        id: "gid://shopify/ProductVariant/11",
        title: "Default Title",
        sku: null,
        barcode: null,
        price: "10.00",
        compareAtPrice: null,
        selectedOptions: [{ name: "Title", value: "Default Title" }],
        product: { id: "gid://shopify/Product/1" },
      },
      {
        id: "gid://shopify/ProductVariant/22",
        title: "Default Title",
        sku: "SKU-002",
        barcode: null,
        price: "12.00",
        compareAtPrice: null,
        selectedOptions: [{ name: "Title", value: "Default Title" }],
        product: { id: "gid://shopify/Product/2" },
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
    createdAt: "2026-09-04T10:00:00.000Z",
    rules: [
      {
        ruleCode: "CG-SKU-001",
        ruleVersion: 1,
        enabled: true,
        severity: "ERROR",
        blocking: true,
        config: {},
      },
    ],
  });
}

class RecordingPreflightRepository implements PreflightRepository {
  input?: PersistPreflightEvidenceInputV1;

  async persistPreflight(
    _plan: PreflightEvidencePlanV1,
  ): Promise<PersistPreflightResultV1> {
    throw new Error("plain preflight persistence is not used by product runs");
  }

  async persistPreflightEvidence(input: PersistPreflightEvidenceInputV1) {
    this.input = input;
    return {
      status: "PERSISTED" as const,
      preflightRunId: input.plan.run.id,
      scanId: input.scan.id,
      inputFingerprint: input.plan.inputFingerprint,
      outcome: input.plan.summary.outcome,
      targetCount: input.plan.targets.length,
    };
  }
}

function inputFor(repository: RecordingPreflightRepository, overrides = {}) {
  return {
    admin: { kind: "admin" },
    shopId: "shop-1",
    policyId: "policy-1",
    expectedRevisionId: "policy-revision-1",
    productTargetText: "gid://shopify/Product/1",
    apiVersion: "2026-07",
    engineVersion: "test-engine",
    now: () => "2026-09-04T13:00:00.000Z",
    nextScanId: () => "scan-preflight-1",
    nextPreflightRunId: () => "preflight-1",
    loadActiveRevision: async () => revision(),
    loadExceptions: async () => [],
    readCatalog: async () => completeCatalog(),
    repository,
    ...overrides,
  };
}

test("product preflight records PREFLIGHT scan evidence without using finding reconciliation", async () => {
  const repository = new RecordingPreflightRepository();
  const result = await runProductPreflightV1(inputFor(repository));

  assert.equal(result.scanId, "scan-preflight-1");
  assert.equal(result.preflightRunId, "preflight-1");
  assert.equal(result.policyRevisionId, "policy-revision-1");
  assert.equal(result.targetType, "PRODUCT");
  assert.equal(result.outcome, "FAIL");
  assert.equal(result.productsProcessed, 1);
  assert.equal(result.variantsProcessed, 1);
  assert.equal(result.evaluationCount, 1);
  assert.deepEqual(result.productGids, ["gid://shopify/Product/1"]);
  assert.equal(repository.input?.scan.scanType, "PREFLIGHT");
  assert.equal(repository.input?.scan.productsExpected, 1);
  assert.equal(repository.input?.scan.productsProcessed, 1);
  assert.equal(repository.input?.scan.variantsProcessed, 1);
  assert.equal(repository.input?.plan.run.targetType, "PRODUCT");
  assert.equal(repository.input?.plan.summary.blockingViolationCount, 1);
  assert.deepEqual(
    repository.input?.plan.targets.map((target) => [
      target.resourceType,
      target.resourceGid,
    ]),
    [
      ["PRODUCT", "gid://shopify/Product/1"],
      ["VARIANT", "gid://shopify/ProductVariant/11"],
    ],
  );
});

test("product preflight accepts numeric ids and Admin URLs as a deterministic product set", async () => {
  const repository = new RecordingPreflightRepository();
  const result = await runProductPreflightV1(
    inputFor(repository, {
      productTargetText:
        "https://admin.shopify.com/store/example/products/2, 1 gid://shopify/Product/1",
    }),
  );

  assert.equal(result.targetType, "PRODUCT_SET");
  assert.deepEqual(result.productGids, [
    "gid://shopify/Product/1",
    "gid://shopify/Product/2",
  ]);
  assert.deepEqual(repository.input?.plan.run.targetDefinition, {
    targetType: "PRODUCT_SET",
    productGids: ["gid://shopify/Product/1", "gid://shopify/Product/2"],
  });
});

test("stale product preflight page rejects before reading the catalog", async () => {
  const repository = new RecordingPreflightRepository();
  let catalogReads = 0;

  await assert.rejects(
    () =>
      runProductPreflightV1(
        inputFor(repository, {
          expectedRevisionId: "stale-revision",
          readCatalog: async () => {
            catalogReads += 1;
            return completeCatalog();
          },
        }),
      ),
    /active policy revision changed/,
  );

  assert.equal(catalogReads, 0);
  assert.equal(repository.input, undefined);
});

test("missing product targets fail before persistence", async () => {
  const repository = new RecordingPreflightRepository();

  await assert.rejects(
    () =>
      runProductPreflightV1(
        inputFor(repository, {
          productTargetText: "gid://shopify/Product/999",
        }),
      ),
    /gid:\/\/shopify\/Product\/999/,
  );

  assert.equal(repository.input, undefined);
});
