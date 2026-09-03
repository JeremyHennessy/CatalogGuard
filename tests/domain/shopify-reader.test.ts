import * as assert from "node:assert/strict";
import { test } from "node:test";
import { readVerifiedShopifyCatalogV1 } from "../../app/domain/catalog/shopify-reader";
import type {
  ShopifyProductSourceV1,
  ShopifyVariantSourceV1,
} from "../../app/domain/catalog/shopify-source";

function product(id: string, variantsCount = 1): ShopifyProductSourceV1 {
  return {
    id,
    title: `Product ${id}`,
    status: "ACTIVE",
    description: "",
    seo: { title: null, description: null },
    vendor: "Vendor",
    productType: "Type",
    tags: [],
    category: null,
    mediaCount: { count: 0 },
    variantsCount: { count: variantsCount },
  };
}

function variant(
  id: string,
  productId: string,
  sku: string,
): ShopifyVariantSourceV1 {
  return {
    id,
    title: `Variant ${id}`,
    sku,
    barcode: null,
    price: "10.00",
    compareAtPrice: null,
    selectedOptions: [{ name: "Title", value: "Default Title" }],
    product: { id: productId },
  };
}

function envelope(
  connectionName: "products" | "productVariants",
  nodes: readonly unknown[],
  hasNextPage: boolean,
  endCursor: string | null,
) {
  return {
    data: {
      [connectionName]: {
        nodes,
        pageInfo: { hasNextPage, endCursor },
      },
    },
  };
}

test("verified Shopify reader consumes both global connections to completion", async () => {
  const calls: Array<{ operation: string; after: string | null }> = [];
  const execute = async (
    query: string,
    variables: { first: number; after: string | null },
  ) => {
    const products = query.includes("CatalogGuardProducts");
    calls.push({
      operation: products ? "products" : "variants",
      after: variables.after,
    });

    if (products) {
      return variables.after === null
        ? envelope("products", [product("gid://shopify/Product/2")], true, "p1")
        : envelope("products", [product("gid://shopify/Product/1")], false, "p2");
    }

    return variables.after === null
      ? envelope(
          "productVariants",
          [
            variant(
              "gid://shopify/ProductVariant/2",
              "gid://shopify/Product/2",
              "SKU-2",
            ),
          ],
          true,
          "v1",
        )
      : envelope(
          "productVariants",
          [
            variant(
              "gid://shopify/ProductVariant/1",
              "gid://shopify/Product/1",
              "SKU-1",
            ),
          ],
          false,
          "v2",
        );
  };

  const catalog = await readVerifiedShopifyCatalogV1({
    execute,
    pageSize: 1,
  });

  assert.equal(catalog.completeness, "COMPLETE");
  assert.deepEqual(
    catalog.products.map((item) => item.gid),
    ["gid://shopify/Product/1", "gid://shopify/Product/2"],
  );
  assert.deepEqual(calls, [
    { operation: "products", after: null },
    { operation: "products", after: "p1" },
    { operation: "variants", after: null },
    { operation: "variants", after: "v1" },
  ]);
});

test("Shopify reader rejects GraphQL errors instead of returning partial evidence", async () => {
  await assert.rejects(
    () =>
      readVerifiedShopifyCatalogV1({
        execute: async () => ({ errors: [{ message: "ACCESS_DENIED" }] }),
      }),
    /ACCESS_DENIED/,
  );
});

test("Shopify reader rejects a repeated pagination cursor", async () => {
  await assert.rejects(
    () =>
      readVerifiedShopifyCatalogV1({
        execute: async (query) => {
          if (query.includes("CatalogGuardProducts")) {
            return envelope("products", [product("gid://shopify/Product/1")], true, "same");
          }
          return envelope("productVariants", [], false, null);
        },
        maxPages: 3,
      }),
    /pagination repeated cursor same/,
  );
});

test("Shopify reader refuses a completed connection whose variant counts do not reconcile", async () => {
  await assert.rejects(
    () =>
      readVerifiedShopifyCatalogV1({
        execute: async (query) =>
          query.includes("CatalogGuardProducts")
            ? envelope(
                "products",
                [product("gid://shopify/Product/1", 2)],
                false,
                null,
              )
            : envelope(
                "productVariants",
                [
                  variant(
                    "gid://shopify/ProductVariant/1",
                    "gid://shopify/Product/1",
                    "SKU-1",
                  ),
                ],
                false,
                null,
              ),
      }),
    /completeness verification failed/,
  );
});

test("Shopify reader requires a cursor whenever hasNextPage is true", async () => {
  await assert.rejects(
    () =>
      readVerifiedShopifyCatalogV1({
        execute: async () => envelope("products", [], true, null),
      }),
    /hasNextPage=true without an endCursor/,
  );
});
