import {
  normalizeShopifyCatalogV1,
  type NormalizedShopifyCatalogV1,
} from "./shopify-normalizer";
import {
  SHOPIFY_COLLECTION_PRODUCTS_QUERY_V1,
  SHOPIFY_PRODUCTS_QUERY_V1,
  SHOPIFY_VARIANTS_QUERY_V1,
  type ShopifyCatalogSourceV1,
  type ShopifyCollectionProductSourceV1,
  type ShopifyProductSourceV1,
  type ShopifyVariantSourceV1,
} from "./shopify-source";

export type ShopifyCatalogVariablesV1 = Readonly<{
  first: number;
  after: string | null;
}>;

export type ShopifyCollectionProductsVariablesV1 = Readonly<{
  id: string;
  first: number;
  after: string | null;
}>;

export type ShopifyGraphqlExecutorV1 = (
  query: string,
  variables: ShopifyCatalogVariablesV1 | ShopifyCollectionProductsVariablesV1,
) => Promise<unknown>;

type PageInfo = Readonly<{
  hasNextPage: boolean;
  endCursor: string | null;
}>;

type ConnectionPage<T> = Readonly<{
  nodes: readonly T[];
  pageInfo: PageInfo;
}>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function graphqlErrors(payload: Record<string, unknown>): string[] {
  if (!Array.isArray(payload.errors)) return [];

  return payload.errors.map((entry) => {
    if (isObject(entry) && typeof entry.message === "string") {
      return entry.message;
    }
    return "Unknown Shopify GraphQL error";
  });
}

function parseConnectionPage<T>(
  payload: unknown,
  connectionName: "products" | "productVariants",
): ConnectionPage<T> {
  if (!isObject(payload)) {
    throw new Error("Shopify GraphQL response is not an object");
  }

  const errors = graphqlErrors(payload);
  if (errors.length > 0) {
    throw new Error(`Shopify GraphQL failed: ${errors.join("; ")}`);
  }

  if (!isObject(payload.data)) {
    throw new Error("Shopify GraphQL response returned no data");
  }

  const connection = payload.data[connectionName];
  if (!isObject(connection) || !Array.isArray(connection.nodes)) {
    throw new Error(
      `Shopify GraphQL response is missing ${connectionName} nodes`,
    );
  }
  if (!isObject(connection.pageInfo)) {
    throw new Error(
      `Shopify GraphQL response is missing ${connectionName} pageInfo`,
    );
  }

  const hasNextPage = connection.pageInfo.hasNextPage;
  const endCursor = connection.pageInfo.endCursor;

  if (typeof hasNextPage !== "boolean") {
    throw new Error(`${connectionName} pageInfo.hasNextPage is invalid`);
  }
  if (endCursor !== null && typeof endCursor !== "string") {
    throw new Error(`${connectionName} pageInfo.endCursor is invalid`);
  }

  return {
    nodes: connection.nodes as readonly T[],
    pageInfo: { hasNextPage, endCursor },
  };
}

async function readConnectionToEnd<T>(input: {
  execute: ShopifyGraphqlExecutorV1;
  query: string;
  connectionName: "products" | "productVariants";
  pageSize: number;
  maxPages: number;
}): Promise<readonly T[]> {
  const nodes: T[] = [];
  const seenCursors = new Set<string>();
  let after: string | null = null;

  for (let pageNumber = 1; pageNumber <= input.maxPages; pageNumber += 1) {
    const payload = await input.execute(input.query, {
      first: input.pageSize,
      after,
    });
    const page = parseConnectionPage<T>(payload, input.connectionName);
    nodes.push(...page.nodes);

    if (!page.pageInfo.hasNextPage) {
      return Object.freeze(nodes);
    }

    const nextCursor = page.pageInfo.endCursor;
    if (!nextCursor) {
      throw new Error(
        `${input.connectionName} hasNextPage=true without an endCursor`,
      );
    }
    if (seenCursors.has(nextCursor)) {
      throw new Error(
        `${input.connectionName} pagination repeated cursor ${nextCursor}`,
      );
    }

    seenCursors.add(nextCursor);
    after = nextCursor;
  }

  throw new Error(
    `${input.connectionName} pagination exceeded maxPages=${input.maxPages}`,
  );
}

export async function readVerifiedShopifyCatalogV1(input: {
  execute: ShopifyGraphqlExecutorV1;
  pageSize?: number;
  maxPages?: number;
}): Promise<NormalizedShopifyCatalogV1> {
  const pageSize = input.pageSize ?? 100;
  const maxPages = input.maxPages ?? 10_000;

  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error("Shopify catalog pageSize must be a positive integer");
  }
  if (!Number.isInteger(maxPages) || maxPages < 1) {
    throw new Error("Shopify catalog maxPages must be a positive integer");
  }

  const products = await readConnectionToEnd<ShopifyProductSourceV1>({
    execute: input.execute,
    query: SHOPIFY_PRODUCTS_QUERY_V1,
    connectionName: "products",
    pageSize,
    maxPages,
  });
  const productVariants = await readConnectionToEnd<ShopifyVariantSourceV1>({
    execute: input.execute,
    query: SHOPIFY_VARIANTS_QUERY_V1,
    connectionName: "productVariants",
    pageSize,
    maxPages,
  });

  const source: ShopifyCatalogSourceV1 = {
    products,
    productVariants,
    productsComplete: true,
    variantsComplete: true,
  };
  const catalog = normalizeShopifyCatalogV1(source);

  if (catalog.completeness !== "COMPLETE") {
    throw new Error(
      `Shopify catalog completeness verification failed: ${catalog.warnings.join("; ")}`,
    );
  }

  return catalog;
}

export type ShopifyCollectionProductTargetV1 = Readonly<{
  collectionGid: string;
  collectionHandle: string;
  collectionTitle: string;
  productGids: readonly string[];
}>;

function parseCollectionProductsPage(payload: unknown): Readonly<{
  collectionGid: string;
  collectionHandle: string;
  collectionTitle: string;
  productGids: readonly string[];
  pageInfo: PageInfo;
}> {
  if (!isObject(payload)) {
    throw new Error("Shopify GraphQL response is not an object");
  }

  const errors = graphqlErrors(payload);
  if (errors.length > 0) {
    throw new Error(`Shopify GraphQL failed: ${errors.join("; ")}`);
  }

  if (!isObject(payload.data)) {
    throw new Error("Shopify GraphQL response returned no data");
  }

  const collection = payload.data.collection;
  if (collection === null) {
    throw new Error("Shopify collection was not found");
  }
  if (!isObject(collection)) {
    throw new Error("Shopify GraphQL response is missing collection data");
  }
  if (typeof collection.id !== "string") {
    throw new Error("Shopify collection id is invalid");
  }
  if (typeof collection.handle !== "string") {
    throw new Error("Shopify collection handle is invalid");
  }
  if (typeof collection.title !== "string") {
    throw new Error("Shopify collection title is invalid");
  }

  const products = collection.products;
  if (!isObject(products) || !Array.isArray(products.nodes)) {
    throw new Error(
      "Shopify GraphQL response is missing collection product nodes",
    );
  }
  if (!isObject(products.pageInfo)) {
    throw new Error(
      "Shopify GraphQL response is missing collection product pageInfo",
    );
  }

  const hasNextPage = products.pageInfo.hasNextPage;
  const endCursor = products.pageInfo.endCursor;
  if (typeof hasNextPage !== "boolean") {
    throw new Error("collection products pageInfo.hasNextPage is invalid");
  }
  if (endCursor !== null && typeof endCursor !== "string") {
    throw new Error("collection products pageInfo.endCursor is invalid");
  }

  return Object.freeze({
    collectionGid: collection.id,
    collectionHandle: collection.handle,
    collectionTitle: collection.title,
    productGids: Object.freeze(
      products.nodes.map((node) => {
        const product = node as ShopifyCollectionProductSourceV1;
        if (!isObject(product) || typeof product.id !== "string") {
          throw new Error("collection product node id is invalid");
        }

        return product.id;
      }),
    ),
    pageInfo: Object.freeze({ hasNextPage, endCursor }),
  });
}

export async function readShopifyCollectionProductTargetV1(input: {
  execute: ShopifyGraphqlExecutorV1;
  collectionGid: string;
  pageSize?: number;
  maxPages?: number;
}): Promise<ShopifyCollectionProductTargetV1> {
  const pageSize = input.pageSize ?? 100;
  const maxPages = input.maxPages ?? 10_000;

  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error(
      "Shopify collection product pageSize must be a positive integer",
    );
  }
  if (!Number.isInteger(maxPages) || maxPages < 1) {
    throw new Error(
      "Shopify collection product maxPages must be a positive integer",
    );
  }

  const productGids: string[] = [];
  const seenProductGids = new Set<string>();
  const seenCursors = new Set<string>();
  let after: string | null = null;
  let collectionGid: string | undefined;
  let collectionHandle: string | undefined;
  let collectionTitle: string | undefined;

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const payload = await input.execute(SHOPIFY_COLLECTION_PRODUCTS_QUERY_V1, {
      id: input.collectionGid,
      first: pageSize,
      after,
    });
    const page = parseCollectionProductsPage(payload);

    collectionGid = page.collectionGid;
    collectionHandle = page.collectionHandle;
    collectionTitle = page.collectionTitle;

    if (collectionGid !== input.collectionGid) {
      throw new Error(
        `Shopify collection response id ${collectionGid} does not match requested ${input.collectionGid}`,
      );
    }

    for (const productGid of page.productGids) {
      if (seenProductGids.has(productGid)) {
        throw new Error(`collection product repeated GID: ${productGid}`);
      }
      seenProductGids.add(productGid);
      productGids.push(productGid);
    }

    if (!page.pageInfo.hasNextPage) {
      return Object.freeze({
        collectionGid,
        collectionHandle,
        collectionTitle,
        productGids: Object.freeze(productGids),
      });
    }

    const nextCursor = page.pageInfo.endCursor;
    if (!nextCursor) {
      throw new Error(
        "collection products hasNextPage=true without an endCursor",
      );
    }
    if (seenCursors.has(nextCursor)) {
      throw new Error(
        `collection products pagination repeated cursor ${nextCursor}`,
      );
    }

    seenCursors.add(nextCursor);
    after = nextCursor;
  }

  throw new Error(
    `collection products pagination exceeded maxPages=${maxPages}`,
  );
}
