import * as assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeShopifyCatalogV1 } from "../../app/domain/catalog/shopify-normalizer";
import {
  SHOPIFY_PRODUCTS_QUERY_V1,
  SHOPIFY_VARIANTS_QUERY_V1,
  type ShopifyCatalogSourceV1,
} from "../../app/domain/catalog/shopify-source";

function source(
  overrides: Partial<ShopifyCatalogSourceV1> = {},
): ShopifyCatalogSourceV1 {
  return {
    productsComplete: true,
    variantsComplete: true,
    products: [
      {
        id: "gid://shopify/Product/1",
        title: "Complete product",
        status: "ACTIVE",
        description: "Normalized plain text",
        seo: { title: "SEO title", description: "SEO description" },
        vendor: "Example Vendor",
        productType: "snowboard",
        tags: ["Winter", "Sport"],
        category: { id: "gid://shopify/TaxonomyCategory/sg-1" },
        mediaCount: { count: 2 },
        variantsCount: { count: 2 },
      },
    ],
    productVariants: [
      {
        id: "gid://shopify/ProductVariant/2",
        title: "Blue",
        sku: "SKU-1",
        barcode: "BAR-1",
        price: "10.00",
        compareAtPrice: "12.00",
        selectedOptions: [{ name: "Color", value: "Blue" }],
        product: { id: "gid://shopify/Product/1" },
      },
      {
        id: "gid://shopify/ProductVariant/1",
        title: "Red",
        sku: "SKU-2",
        barcode: null,
        price: "11.00",
        compareAtPrice: null,
        selectedOptions: [{ name: "Color", value: "Red" }],
        product: { id: "gid://shopify/Product/1" },
      },
    ],
    ...overrides,
  };
}

test("Shopify query contracts use independent paginated product and variant streams", () => {
  assert.match(SHOPIFY_PRODUCTS_QUERY_V1, /products\(first: \$first, after: \$after, sortKey: ID\)/);
  assert.match(SHOPIFY_PRODUCTS_QUERY_V1, /variantsCount/);
  assert.match(SHOPIFY_PRODUCTS_QUERY_V1, /pageInfo/);
  assert.doesNotMatch(SHOPIFY_PRODUCTS_QUERY_V1, /\bvariants\s*\(/);

  assert.match(
    SHOPIFY_VARIANTS_QUERY_V1,
    /productVariants\(first: \$first, after: \$after, sortKey: ID\)/,
  );
  assert.match(SHOPIFY_VARIANTS_QUERY_V1, /selectedOptions/);
  assert.match(SHOPIFY_VARIANTS_QUERY_V1, /product\s*\{\s*id\s*\}/);
  assert.match(SHOPIFY_VARIANTS_QUERY_V1, /pageInfo/);
});

test("complete Shopify streams normalize deterministically and produce a complete identifier index", () => {
  const catalog = normalizeShopifyCatalogV1(source());

  assert.equal(catalog.completeness, "COMPLETE");
  assert.deepEqual(catalog.warnings, []);
  assert.equal(catalog.products.length, 1);

  const product = catalog.products[0];
  assert.equal(product.gid, "gid://shopify/Product/1");
  assert.equal(product.descriptionText.availability, "AVAILABLE");
  assert.equal(product.categoryGid.availability, "AVAILABLE");
  assert.equal(product.mediaCount.availability, "AVAILABLE");
  assert.deepEqual(
    product.variants.map((variant) => variant.gid),
    ["gid://shopify/ProductVariant/1", "gid://shopify/ProductVariant/2"],
  );

  const sku = catalog.identifierIndex.lookup("SKU", "SKU-1", "EXACT");
  assert.equal(sku.completeness, "COMPLETE");
  assert.deepEqual(
    sku.matches.map((match) => match.variantGid),
    ["gid://shopify/ProductVariant/2"],
  );
});

test("variant-count mismatch degrades completeness instead of claiming a complete scan", () => {
  const partial = normalizeShopifyCatalogV1(
    source({ productVariants: source().productVariants.slice(0, 1) }),
  );

  assert.equal(partial.completeness, "PARTIAL");
  assert.match(partial.warnings.join("\n"), /expected 2 variants but normalized 1/);
  assert.equal(
    partial.identifierIndex.lookup("SKU", "SKU-1", "EXACT").completeness,
    "PARTIAL",
  );
});

test("unfinished connection pagination degrades completeness even when counts happen to match", () => {
  const partial = normalizeShopifyCatalogV1(
    source({ productsComplete: false }),
  );

  assert.equal(partial.completeness, "PARTIAL");
  assert.match(partial.warnings.join("\n"), /product pagination did not reach the end/);
});

test("complete product stream rejects orphan variants", () => {
  assert.throws(
    () =>
      normalizeShopifyCatalogV1(
        source({
          productVariants: [
            {
              ...source().productVariants[0],
              product: { id: "gid://shopify/Product/missing" },
            },
          ],
        }),
      ),
    /references missing product/,
  );
});

test("duplicate Shopify identities are rejected before normalization", () => {
  const firstVariant = source().productVariants[0];

  assert.throws(
    () =>
      normalizeShopifyCatalogV1(
        source({ productVariants: [firstVariant, firstVariant] }),
      ),
    /duplicate variant GID/,
  );
});
