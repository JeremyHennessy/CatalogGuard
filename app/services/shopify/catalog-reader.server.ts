import {
  readShopifyCollectionProductTargetV1,
  readVerifiedShopifyCatalogV1,
} from "../../domain/catalog/shopify-reader";

export type ShopifyAdminGraphqlClient = Readonly<{
  graphql(query: string, options: { variables: object }): Promise<Response>;
}>;

export async function readVerifiedCatalogFromShopifyAdmin(
  admin: ShopifyAdminGraphqlClient,
) {
  return readVerifiedShopifyCatalogV1({
    execute: async (query, variables) => {
      const response = await admin.graphql(query, { variables });
      return response.json();
    },
  });
}

export async function readCollectionProductTargetFromShopifyAdmin(
  admin: ShopifyAdminGraphqlClient,
  collectionGid: string,
) {
  return readShopifyCollectionProductTargetV1({
    collectionGid,
    execute: async (query, variables) => {
      const response = await admin.graphql(query, { variables });
      return response.json();
    },
  });
}
