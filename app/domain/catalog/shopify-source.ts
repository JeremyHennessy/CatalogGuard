import type { ProductStatus } from "./model";

export const SHOPIFY_PRODUCTS_QUERY_V1 = `#graphql
  query CatalogGuardProducts($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: ID) {
      nodes {
        id
        title
        status
        description
        seo {
          title
          description
        }
        vendor
        productType
        tags
        category {
          id
        }
        mediaCount {
          count
        }
        variantsCount {
          count
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const SHOPIFY_VARIANTS_QUERY_V1 = `#graphql
  query CatalogGuardVariants($first: Int!, $after: String) {
    productVariants(first: $first, after: $after, sortKey: ID) {
      nodes {
        id
        title
        sku
        barcode
        price
        compareAtPrice
        selectedOptions {
          name
          value
        }
        product {
          id
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const SHOPIFY_COLLECTION_PRODUCTS_QUERY_V1 = `#graphql
  query CatalogGuardCollectionProducts($id: ID!, $first: Int!, $after: String) {
    collection(id: $id) {
      id
      handle
      title
      products(first: $first, after: $after) {
        nodes {
          id
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

export type ShopifyProductSourceV1 = Readonly<{
  id: string;
  title: string;
  status: ProductStatus;
  description: string;
  seo: Readonly<{
    title: string | null;
    description: string | null;
  }>;
  vendor: string;
  productType: string;
  tags: readonly string[];
  category: Readonly<{ id: string }> | null;
  mediaCount: Readonly<{ count: number }>;
  variantsCount: Readonly<{ count: number }>;
}>;

export type ShopifyCollectionProductSourceV1 = Readonly<{
  id: string;
}>;

export type ShopifyVariantSourceV1 = Readonly<{
  id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  price: string;
  compareAtPrice: string | null;
  selectedOptions: readonly Readonly<{ name: string; value: string }>[];
  product: Readonly<{ id: string }>;
}>;

export type ShopifyCatalogSourceV1 = Readonly<{
  products: readonly ShopifyProductSourceV1[];
  productVariants: readonly ShopifyVariantSourceV1[];
  productsComplete: boolean;
  variantsComplete: boolean;
}>;
