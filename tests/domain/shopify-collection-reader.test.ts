import * as assert from "node:assert/strict";
import { test } from "node:test";
import { readShopifyCollectionProductTargetV1 } from "../../app/domain/catalog/shopify-reader";

test("Shopify collection product reader paginates membership to completion", async () => {
  const variables: unknown[] = [];
  const payloads = [
    {
      data: {
        collection: {
          id: "gid://shopify/Collection/5",
          handle: "launch",
          title: "Launch",
          products: {
            nodes: [
              { id: "gid://shopify/Product/2" },
              { id: "gid://shopify/Product/1" },
            ],
            pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
          },
        },
      },
    },
    {
      data: {
        collection: {
          id: "gid://shopify/Collection/5",
          handle: "launch",
          title: "Launch",
          products: {
            nodes: [{ id: "gid://shopify/Product/3" }],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    },
  ];

  const result = await readShopifyCollectionProductTargetV1({
    collectionGid: "gid://shopify/Collection/5",
    pageSize: 2,
    execute: async (_query, inputVariables) => {
      variables.push(inputVariables);
      const payload = payloads.shift();
      assert.ok(payload);
      return payload;
    },
  });

  assert.deepEqual(variables, [
    { id: "gid://shopify/Collection/5", first: 2, after: null },
    { id: "gid://shopify/Collection/5", first: 2, after: "cursor-1" },
  ]);
  assert.deepEqual(result, {
    collectionGid: "gid://shopify/Collection/5",
    collectionHandle: "launch",
    collectionTitle: "Launch",
    productGids: [
      "gid://shopify/Product/2",
      "gid://shopify/Product/1",
      "gid://shopify/Product/3",
    ],
  });
});

test("Shopify collection product reader rejects missing collections", async () => {
  await assert.rejects(
    () =>
      readShopifyCollectionProductTargetV1({
        collectionGid: "gid://shopify/Collection/404",
        execute: async () => ({ data: { collection: null } }),
      }),
    /collection was not found/,
  );
});
