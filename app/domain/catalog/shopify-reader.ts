import { normalizeShopifyCatalogV1, type NormalizedShopifyCatalogV1 } from "./shopify-normalizer";
import {
  SHOPIFY_PRODUCTS_QUERY_V1,
  SHOPIFY_VARIANTS_QUERY_V1,
  type ShopifyCatalogSourceV1,
  type ShopifyProductSourceV1,
  type ShopifyVariantSourceV1,
} from "./shopify-source";

export type ShopifyCatalogVariablesV1 = Readonly<{
  first: number;
  after: string | null;
}>;

export type ShopifyGraphqlExecutorV1 = (
  query: string,
  variables: ShopifyCatalogVariablesV1,
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
    throw new Error(`Shopify GraphQL response is missing ${connectionName} nodes`);
  }
  if (!isObject(connection.pageInfo)) {
    throw new Error(`Shopify GraphQL response is missing ${connectionName} pageInfo`);
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
