import * as assert from "node:assert/strict";
import { test } from "node:test";
import { buildCatalogChangeWebhookEvidenceV1 } from "../../app/application/catalog-change-webhook";
import { canonicalJsonStringify } from "../../app/persistence/json";

test("catalog product webhook evidence normalizes topic and fingerprints payload deterministically", () => {
  const payload = Object.freeze({
    updated_at: "2021-12-31T19:00:00-05:00",
    id: "788032119674292922",
    admin_graphql_api_id: "gid://shopify/Product/788032119674292922",
    title: "Example T-Shirt",
  });
  const first = buildCatalogChangeWebhookEvidenceV1({
    webhookId: "webhook-1",
    shopId: "shop-1",
    shopDomain: "catalogguard-dev.myshopify.com",
    topic: "products/update",
    apiVersion: "2026-07",
    payload,
    receivedAt: "2026-09-04T15:45:00.000Z",
  });
  const second = buildCatalogChangeWebhookEvidenceV1({
    webhookId: "webhook-1",
    shopId: "shop-1",
    shopDomain: "catalogguard-dev.myshopify.com",
    topic: "PRODUCTS_UPDATE",
    apiVersion: "2026-07",
    payload: {
      title: "Example T-Shirt",
      admin_graphql_api_id: "gid://shopify/Product/788032119674292922",
      id: "788032119674292922",
      updated_at: "2021-12-31T19:00:00-05:00",
    },
    receivedAt: "2026-09-04T15:45:00.000Z",
  });

  assert.deepEqual(first, second);
  assert.equal(first.topic, "PRODUCTS_UPDATE");
  assert.equal(first.resourceType, "PRODUCT");
  assert.equal(first.resourceGid, "gid://shopify/Product/788032119674292922");
  assert.equal(first.legacyResourceId, "788032119674292922");
  assert.equal(first.payloadIdPrecision, "STRING");
  assert.equal(first.payloadJson, canonicalJsonStringify(payload));
  assert.match(first.payloadFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(first.processingState, "PENDING_INCREMENTAL_RECONCILIATION");
  assert.equal(first.payloadUpdatedAt, "2022-01-01T00:00:00.000Z");
});

test("catalog product webhook evidence records unmatched shops without queueing reconciliation", () => {
  const evidence = buildCatalogChangeWebhookEvidenceV1({
    webhookId: "webhook-unmatched-shop",
    shopDomain: "missing-shop.myshopify.com",
    topic: "products/create",
    apiVersion: "2026-07",
    payload: {
      id: "788032119674292922",
      admin_graphql_api_id: "gid://shopify/Product/788032119674292922",
    },
    receivedAt: "2026-09-04T15:45:00.000Z",
  });

  assert.equal(evidence.shopId, undefined);
  assert.equal(evidence.processingState, "UNMATCHED_SHOP");
});

test("catalog product delete webhook does not derive a GID from an unsafe numeric id", () => {
  const unsafeProductId = 788032119674292922;
  assert.equal(Number.isSafeInteger(unsafeProductId), false);

  const evidence = buildCatalogChangeWebhookEvidenceV1({
    webhookId: "webhook-delete",
    shopId: "shop-1",
    shopDomain: "catalogguard-dev.myshopify.com",
    topic: "PRODUCTS_DELETE",
    apiVersion: "2026-07",
    payload: { id: unsafeProductId },
    receivedAt: "2026-09-04T15:45:00.000Z",
  });

  assert.equal(evidence.topic, "PRODUCTS_DELETE");
  assert.equal(evidence.payloadIdPrecision, "UNSAFE_NUMBER");
  assert.equal(evidence.resourceGid, undefined);
});

test("catalog product delete webhook can derive a GID from a lossless string id", () => {
  const evidence = buildCatalogChangeWebhookEvidenceV1({
    webhookId: "webhook-delete-lossless",
    shopId: "shop-1",
    shopDomain: "catalogguard-dev.myshopify.com",
    topic: "products/delete",
    apiVersion: "2026-07",
    payload: { id: "788032119674292922" },
    receivedAt: "2026-09-04T15:45:00.000Z",
  });

  assert.equal(
    evidence.resourceGid,
    "gid://shopify/Product/788032119674292922",
  );
  assert.equal(evidence.payloadIdPrecision, "STRING");
});

test("catalog product create and update webhooks require Shopify product GID evidence", () => {
  assert.throws(
    () =>
      buildCatalogChangeWebhookEvidenceV1({
        webhookId: "webhook-update-missing-gid",
        shopId: "shop-1",
        shopDomain: "catalogguard-dev.myshopify.com",
        topic: "PRODUCTS_UPDATE",
        apiVersion: "2026-07",
        payload: { id: "788032119674292922" },
        receivedAt: "2026-09-04T15:45:00.000Z",
      }),
    /must include admin_graphql_api_id/,
  );
});

test("catalog product webhook evidence rejects unsupported topics", () => {
  assert.throws(
    () =>
      buildCatalogChangeWebhookEvidenceV1({
        webhookId: "webhook-collection-update",
        shopId: "shop-1",
        shopDomain: "catalogguard-dev.myshopify.com",
        topic: "COLLECTIONS_UPDATE",
        apiVersion: "2026-07",
        payload: { id: "1" },
        receivedAt: "2026-09-04T15:45:00.000Z",
      }),
    /unsupported catalog webhook topic/,
  );
});
