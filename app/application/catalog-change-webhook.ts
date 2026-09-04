import { createHash } from "node:crypto";
import { canonicalJsonStringify } from "../persistence/json";

export type CatalogProductWebhookTopicV1 =
  | "PRODUCTS_CREATE"
  | "PRODUCTS_UPDATE"
  | "PRODUCTS_DELETE";

export type CatalogWebhookPayloadIdPrecisionV1 =
  | "STRING"
  | "SAFE_INTEGER"
  | "UNSAFE_NUMBER";

export type CatalogChangeProcessingStateV1 =
  | "PENDING_INCREMENTAL_RECONCILIATION"
  | "UNMATCHED_SHOP"
  | "RECONCILED"
  | "FAILED";

export type CatalogChangeWebhookEvidenceV1 = Readonly<{
  id: string;
  shopId?: string;
  shopDomain: string;
  topic: CatalogProductWebhookTopicV1;
  apiVersion: string;
  resourceType: "PRODUCT";
  resourceGid?: string;
  legacyResourceId: string;
  payloadIdPrecision: CatalogWebhookPayloadIdPrecisionV1;
  payloadFingerprint: string;
  payloadJson: string;
  processingState: CatalogChangeProcessingStateV1;
  receivedAt: string;
  payloadUpdatedAt?: string;
  processedAt?: string;
  errorSummary?: string;
}>;

export type BuildCatalogChangeWebhookEvidenceInputV1 = Readonly<{
  webhookId: string;
  shopId?: string;
  shopDomain: string;
  topic: string;
  apiVersion: string;
  payload: Record<string, unknown>;
  receivedAt: string;
}>;

const TOPIC_MAP: Readonly<Record<string, CatalogProductWebhookTopicV1>> =
  Object.freeze({
    PRODUCTS_CREATE: "PRODUCTS_CREATE",
    PRODUCTS_UPDATE: "PRODUCTS_UPDATE",
    PRODUCTS_DELETE: "PRODUCTS_DELETE",
    "products/create": "PRODUCTS_CREATE",
    "products/update": "PRODUCTS_UPDATE",
    "products/delete": "PRODUCTS_DELETE",
  });

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function assertNonEmpty(value: string, field: string) {
  if (value.trim().length === 0) {
    throw new Error(field + " is required");
  }
}

function parseIsoDate(value: string, field: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error(field + " must be an ISO date-time");
  }

  return date;
}

function normalizeTopic(topic: string): CatalogProductWebhookTopicV1 {
  const normalized = TOPIC_MAP[topic];
  if (!normalized) {
    throw new Error("unsupported catalog webhook topic: " + topic);
  }

  return normalized;
}

function payloadProductGid(payload: Record<string, unknown>) {
  const value = payload.admin_graphql_api_id;
  if (value === undefined || value === null) return undefined;

  if (
    typeof value !== "string" ||
    !/^gid:\/\/shopify\/Product\/\d+$/.test(value)
  ) {
    throw new Error(
      "product webhook admin_graphql_api_id must be a Shopify Product GID",
    );
  }

  return value;
}

function payloadLegacyProductId(payload: Record<string, unknown>): Readonly<{
  value: string;
  precision: CatalogWebhookPayloadIdPrecisionV1;
}> {
  const value = payload.id;

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Object.freeze({ value, precision: "STRING" as const });
  }

  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return Object.freeze({
      value: String(value),
      precision: Number.isSafeInteger(value)
        ? ("SAFE_INTEGER" as const)
        : ("UNSAFE_NUMBER" as const),
    });
  }

  throw new Error("product webhook payload is missing a numeric product id");
}

function optionalPayloadUpdatedAt(payload: Record<string, unknown>) {
  const value = payload.updated_at;
  if (value === undefined || value === null || value === "") return undefined;

  if (typeof value !== "string") {
    throw new Error("product webhook updated_at must be a string when present");
  }

  return parseIsoDate(value, "product webhook updated_at").toISOString();
}

function productGidFromLegacyId(input: {
  legacyResourceId: string;
  precision: CatalogWebhookPayloadIdPrecisionV1;
}) {
  if (input.precision === "UNSAFE_NUMBER") return undefined;

  return "gid://shopify/Product/" + input.legacyResourceId;
}

export function buildCatalogChangeWebhookEvidenceV1(
  input: BuildCatalogChangeWebhookEvidenceInputV1,
): CatalogChangeWebhookEvidenceV1 {
  assertNonEmpty(input.webhookId, "webhookId");
  assertNonEmpty(input.shopDomain, "shopDomain");
  assertNonEmpty(input.apiVersion, "apiVersion");

  const topic = normalizeTopic(input.topic);
  const legacyId = payloadLegacyProductId(input.payload);
  const explicitProductGid = payloadProductGid(input.payload);

  if (topic !== "PRODUCTS_DELETE" && !explicitProductGid) {
    throw new Error(
      "product create/update webhooks must include admin_graphql_api_id",
    );
  }

  const shopId =
    input.shopId && input.shopId.trim().length > 0
      ? input.shopId.trim()
      : undefined;
  const receivedAt = parseIsoDate(
    input.receivedAt,
    "catalog webhook receivedAt",
  ).toISOString();
  const payloadJson = canonicalJsonStringify(input.payload);
  const resourceGid =
    explicitProductGid ??
    productGidFromLegacyId({
      legacyResourceId: legacyId.value,
      precision: legacyId.precision,
    });
  const payloadUpdatedAt = optionalPayloadUpdatedAt(input.payload);

  return Object.freeze({
    id: input.webhookId.trim(),
    ...(shopId ? { shopId } : {}),
    shopDomain: input.shopDomain.trim(),
    topic,
    apiVersion: input.apiVersion.trim(),
    resourceType: "PRODUCT" as const,
    ...(resourceGid ? { resourceGid } : {}),
    legacyResourceId: legacyId.value,
    payloadIdPrecision: legacyId.precision,
    payloadFingerprint: sha256(payloadJson),
    payloadJson,
    processingState: shopId
      ? ("PENDING_INCREMENTAL_RECONCILIATION" as const)
      : ("UNMATCHED_SHOP" as const),
    receivedAt,
    ...(payloadUpdatedAt ? { payloadUpdatedAt } : {}),
  });
}
