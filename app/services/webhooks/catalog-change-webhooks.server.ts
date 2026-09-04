import prisma from "../../db.server";
import {
  buildCatalogChangeWebhookEvidenceV1,
  type CatalogChangeProcessingStateV1,
  type CatalogChangeWebhookEvidenceV1,
  type CatalogWebhookPayloadIdPrecisionV1,
} from "../../application/catalog-change-webhook";

type CatalogChangeEventRowV1 = Readonly<{
  id: string;
  shopId: string | null;
  shopDomain: string;
  topic: string;
  apiVersion: string;
  resourceType: string;
  resourceGid: string | null;
  legacyResourceId: string;
  payloadIdPrecision: string;
  payloadFingerprint: string;
  payloadJson: string;
  processingState: string;
  receivedAt: Date;
  payloadUpdatedAt: Date | null;
  processedAt: Date | null;
  errorSummary: string | null;
}>;

export type PersistCatalogChangeWebhookResultV1 = Readonly<{
  status: "PERSISTED" | "ALREADY_OBSERVED";
  event: CatalogChangeWebhookEvidenceV1;
}>;

function selectCatalogChangeEvent() {
  return {
    id: true,
    shopId: true,
    shopDomain: true,
    topic: true,
    apiVersion: true,
    resourceType: true,
    resourceGid: true,
    legacyResourceId: true,
    payloadIdPrecision: true,
    payloadFingerprint: true,
    payloadJson: true,
    processingState: true,
    receivedAt: true,
    payloadUpdatedAt: true,
    processedAt: true,
    errorSummary: true,
  } as const;
}

function payloadIdPrecisionFromDatabase(
  value: string,
): CatalogWebhookPayloadIdPrecisionV1 {
  if (
    value === "STRING" ||
    value === "SAFE_INTEGER" ||
    value === "UNSAFE_NUMBER"
  ) {
    return value;
  }

  throw new Error("unsupported catalog webhook id precision: " + value);
}

function processingStateFromDatabase(
  value: string,
): CatalogChangeProcessingStateV1 {
  if (
    value === "PENDING_INCREMENTAL_RECONCILIATION" ||
    value === "UNMATCHED_SHOP" ||
    value === "RECONCILED" ||
    value === "FAILED"
  ) {
    return value;
  }

  throw new Error("unsupported catalog webhook processing state: " + value);
}

function topicFromDatabase(
  value: string,
): CatalogChangeWebhookEvidenceV1["topic"] {
  if (
    value === "PRODUCTS_CREATE" ||
    value === "PRODUCTS_UPDATE" ||
    value === "PRODUCTS_DELETE"
  ) {
    return value;
  }

  throw new Error("unsupported catalog webhook topic: " + value);
}

function resourceTypeFromDatabase(
  value: string,
): CatalogChangeWebhookEvidenceV1["resourceType"] {
  if (value === "PRODUCT") return value;
  throw new Error("unsupported catalog webhook resource type: " + value);
}

function dateFromIso(value: string, field: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error(field + " must be an ISO date-time");
  }

  return date;
}

function rowToEvidence(
  row: CatalogChangeEventRowV1,
): CatalogChangeWebhookEvidenceV1 {
  return Object.freeze({
    id: row.id,
    ...(row.shopId ? { shopId: row.shopId } : {}),
    shopDomain: row.shopDomain,
    topic: topicFromDatabase(row.topic),
    apiVersion: row.apiVersion,
    resourceType: resourceTypeFromDatabase(row.resourceType),
    ...(row.resourceGid ? { resourceGid: row.resourceGid } : {}),
    legacyResourceId: row.legacyResourceId,
    payloadIdPrecision: payloadIdPrecisionFromDatabase(row.payloadIdPrecision),
    payloadFingerprint: row.payloadFingerprint,
    payloadJson: row.payloadJson,
    processingState: processingStateFromDatabase(row.processingState),
    receivedAt: row.receivedAt.toISOString(),
    ...(row.payloadUpdatedAt
      ? { payloadUpdatedAt: row.payloadUpdatedAt.toISOString() }
      : {}),
    ...(row.processedAt ? { processedAt: row.processedAt.toISOString() } : {}),
    ...(row.errorSummary ? { errorSummary: row.errorSummary } : {}),
  });
}

function assertSameImmutableWebhookEvidence(
  existing: CatalogChangeEventRowV1,
  next: CatalogChangeWebhookEvidenceV1,
) {
  const mismatched =
    existing.shopDomain !== next.shopDomain ||
    existing.topic !== next.topic ||
    existing.apiVersion !== next.apiVersion ||
    existing.resourceType !== next.resourceType ||
    (existing.resourceGid ?? undefined) !== next.resourceGid ||
    existing.legacyResourceId !== next.legacyResourceId ||
    existing.payloadIdPrecision !== next.payloadIdPrecision ||
    existing.payloadFingerprint !== next.payloadFingerprint ||
    existing.payloadJson !== next.payloadJson;

  if (mismatched) {
    throw new Error(
      "webhook id " + next.id + " already exists with different evidence",
    );
  }
}

export async function persistCatalogChangeWebhookV1(input: {
  webhookId: string;
  shopDomain: string;
  topic: string;
  apiVersion: string;
  payload: Record<string, unknown>;
  receivedAt?: string;
}): Promise<PersistCatalogChangeWebhookResultV1> {
  const receivedAt = input.receivedAt ?? new Date().toISOString();

  return prisma.$transaction(async (tx) => {
    const shop = await tx.shop.findUnique({
      where: { shopDomain: input.shopDomain },
      select: { id: true },
    });
    const event = buildCatalogChangeWebhookEvidenceV1({
      webhookId: input.webhookId,
      shopId: shop?.id,
      shopDomain: input.shopDomain,
      topic: input.topic,
      apiVersion: input.apiVersion,
      payload: input.payload,
      receivedAt,
    });
    const existing = await tx.catalogChangeEvent.findUnique({
      where: { id: event.id },
      select: selectCatalogChangeEvent(),
    });

    if (existing) {
      assertSameImmutableWebhookEvidence(existing, event);

      return Object.freeze({
        status: "ALREADY_OBSERVED" as const,
        event: rowToEvidence(existing),
      });
    }

    const created = await tx.catalogChangeEvent.create({
      data: {
        id: event.id,
        shopDomain: event.shopDomain,
        topic: event.topic,
        apiVersion: event.apiVersion,
        resourceType: event.resourceType,
        resourceGid: event.resourceGid,
        legacyResourceId: event.legacyResourceId,
        payloadIdPrecision: event.payloadIdPrecision,
        payloadFingerprint: event.payloadFingerprint,
        payloadJson: event.payloadJson,
        processingState: event.processingState,
        receivedAt: dateFromIso(event.receivedAt, "catalog webhook receivedAt"),
        ...(event.payloadUpdatedAt
          ? {
              payloadUpdatedAt: dateFromIso(
                event.payloadUpdatedAt,
                "catalog webhook payloadUpdatedAt",
              ),
            }
          : {}),
        ...(shop ? { shop: { connect: { id: shop.id } } } : {}),
      },
      select: selectCatalogChangeEvent(),
    });

    if (shop) {
      await tx.shop.update({
        where: { id: shop.id },
        data: {
          lastWebhookObservedAt: dateFromIso(
            event.receivedAt,
            "catalog webhook receivedAt",
          ),
        },
      });
    }

    return Object.freeze({
      status: "PERSISTED" as const,
      event: rowToEvidence(created),
    });
  });
}
