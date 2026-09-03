import {
  CATALOG_SCHEMA_VERSION,
  available,
  type NormalizedProductV1,
  type NormalizedVariantV1,
} from "./model";
import type {
  ShopifyCatalogSourceV1,
  ShopifyVariantSourceV1,
} from "./shopify-source";
import {
  InMemoryIdentifierIndex,
  type IdentifierIndexCompleteness,
} from "../rules/identifier-index";

export type NormalizedShopifyCatalogV1 = Readonly<{
  products: readonly NormalizedProductV1[];
  identifierIndex: InMemoryIdentifierIndex;
  completeness: IdentifierIndexCompleteness;
  warnings: readonly string[];
}>;

function requireNonNegativeInteger(value: number, field: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
}

function assertUniqueGids(values: readonly string[], label: string) {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`duplicate ${label} GID: ${value}`);
    }
    seen.add(value);
  }
}

function normalizeVariant(source: ShopifyVariantSourceV1): NormalizedVariantV1 {
  return Object.freeze({
    schemaVersion: CATALOG_SCHEMA_VERSION,
    gid: source.id,
    productGid: source.product.id,
    title: source.title,
    sku: available(source.sku),
    barcode: available(source.barcode),
    price: available(source.price),
    compareAtPrice: available(source.compareAtPrice),
    selectedOptions: available(
      Object.freeze(
        source.selectedOptions.map((option) =>
          Object.freeze({ name: option.name, value: option.value }),
        ),
      ),
    ),
  });
}

export function normalizeShopifyCatalogV1(
  source: ShopifyCatalogSourceV1,
): NormalizedShopifyCatalogV1 {
  assertUniqueGids(
    source.products.map((product) => product.id),
    "product",
  );
  assertUniqueGids(
    source.productVariants.map((variant) => variant.id),
    "variant",
  );

  const productIds = new Set(source.products.map((product) => product.id));
  const variantsByProduct = new Map<string, NormalizedVariantV1[]>();
  const normalizedVariants: NormalizedVariantV1[] = [];
  const warnings: string[] = [];
  let complete = source.productsComplete && source.variantsComplete;

  if (!source.productsComplete) {
    warnings.push(
      "Shopify product pagination did not reach the end of the connection.",
    );
  }
  if (!source.variantsComplete) {
    warnings.push(
      "Shopify product-variant pagination did not reach the end of the connection.",
    );
  }

  for (const variantSource of source.productVariants) {
    if (!productIds.has(variantSource.product.id)) {
      if (source.productsComplete) {
        throw new Error(
          `variant ${variantSource.id} references missing product ${variantSource.product.id}`,
        );
      }

      complete = false;
      warnings.push(
        `Variant ${variantSource.id} references a product outside the partial product stream.`,
      );
      continue;
    }

    const variant = normalizeVariant(variantSource);
    normalizedVariants.push(variant);
    const group = variantsByProduct.get(variant.productGid) ?? [];
    group.push(variant);
    variantsByProduct.set(variant.productGid, group);
  }

  const products = source.products
    .map((productSource) => {
      requireNonNegativeInteger(
        productSource.mediaCount.count,
        `product ${productSource.id} mediaCount`,
      );
      requireNonNegativeInteger(
        productSource.variantsCount.count,
        `product ${productSource.id} variantsCount`,
      );

      const variants = [
        ...(variantsByProduct.get(productSource.id) ?? []),
      ].sort((a, b) => a.gid.localeCompare(b.gid));

      if (variants.length !== productSource.variantsCount.count) {
        complete = false;
        warnings.push(
          `Product ${productSource.id} expected ${productSource.variantsCount.count} variants but normalized ${variants.length}.`,
        );
      }

      return Object.freeze({
        schemaVersion: CATALOG_SCHEMA_VERSION,
        gid: productSource.id,
        title: productSource.title,
        status: available(productSource.status),
        descriptionText: available(productSource.description),
        seoTitle: available(productSource.seo.title),
        seoDescription: available(productSource.seo.description),
        vendor: available(productSource.vendor),
        productType: available(productSource.productType),
        tags: available(Object.freeze([...productSource.tags])),
        categoryGid: available(productSource.category?.id ?? null),
        mediaCount: available(productSource.mediaCount.count),
        variants: Object.freeze(variants),
      }) satisfies NormalizedProductV1;
    })
    .sort((a, b) => a.gid.localeCompare(b.gid));

  const completeness: IdentifierIndexCompleteness = complete
    ? "COMPLETE"
    : "PARTIAL";
  const identifierIndex = new InMemoryIdentifierIndex(completeness);

  for (const variant of normalizedVariants) {
    identifierIndex.upsertVariant({
      productGid: variant.productGid,
      variantGid: variant.gid,
      sku:
        variant.sku.availability === "AVAILABLE"
          ? variant.sku.value
          : undefined,
      barcode:
        variant.barcode.availability === "AVAILABLE"
          ? variant.barcode.value
          : undefined,
    });
  }

  return Object.freeze({
    products: Object.freeze(products),
    identifierIndex,
    completeness,
    warnings: Object.freeze(warnings),
  });
}
