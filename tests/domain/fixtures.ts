import {
  CATALOG_SCHEMA_VERSION,
  NORMALIZATION_VERSION,
  available,
  type NormalizedProductV1,
  type NormalizedVariantV1,
} from "../../app/domain/catalog/model";
import {
  InMemoryIdentifierIndex,
} from "../../app/domain/rules/identifier-index";
import type { EvaluationContextV1 } from "../../app/domain/rules/contracts";

export function makeVariant(
  overrides: Partial<NormalizedVariantV1> = {},
): NormalizedVariantV1 {
  return {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    gid: "gid://shopify/ProductVariant/101",
    productGid: "gid://shopify/Product/1",
    title: "Default Title",
    sku: available("SKU-001"),
    barcode: available("123456789012"),
    price: available("10.00"),
    compareAtPrice: available("12.00"),
    selectedOptions: available([]),
    ...overrides,
  };
}

export function makeProduct(
  overrides: Partial<NormalizedProductV1> = {},
): NormalizedProductV1 {
  const variant = makeVariant();

  return {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    gid: "gid://shopify/Product/1",
    title: "Example product",
    status: available("ACTIVE"),
    descriptionText: available("A normalized plain-text description."),
    seoTitle: available("Example product"),
    seoDescription: available("Example description"),
    vendor: available("Example Vendor"),
    productType: available("Example Type"),
    tags: available(["summer", "featured"]),
    categoryGid: available("gid://shopify/TaxonomyCategory/aa"),
    mediaCount: available(2),
    variants: [variant],
    ...overrides,
  };
}

export function makeContext(
  variants = [makeVariant()],
  completeness: "COMPLETE" | "PARTIAL" = "COMPLETE",
): EvaluationContextV1 {
  const identifierIndex = new InMemoryIdentifierIndex(completeness);

  for (const variant of variants) {
    identifierIndex.upsertVariant({
      productGid: variant.productGid,
      variantGid: variant.gid,
      sku:
        variant.sku.availability === "AVAILABLE" ? variant.sku.value : undefined,
      barcode:
        variant.barcode.availability === "AVAILABLE"
          ? variant.barcode.value
          : undefined,
    });
  }

  return {
    shopId: "gid://shopify/Shop/1",
    observedAt: new Date("2026-09-03T14:00:00Z"),
    apiVersion: "2026-07",
    normalizationVersion: NORMALIZATION_VERSION,
    policyRevisionId: "policy-revision-1",
    identifierIndex,
  };
}
