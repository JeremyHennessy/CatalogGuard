import { boundary } from "@shopify/shopify-app-react-router/server";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

type CatalogVariant = {
  id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  price: string;
};

type CatalogProduct = {
  id: string;
  title: string;
  handle: string;
  status: string;
  updatedAt: string;
  variants: { nodes: CatalogVariant[] };
};

type CatalogQueryPayload = {
  data?: {
    products: { nodes: CatalogProduct[] };
  };
  errors?: Array<{ message: string }>;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const response = await admin.graphql(
    `#graphql
      query CatalogGuardPhaseOneProducts($first: Int!) {
        products(first: $first, sortKey: UPDATED_AT, reverse: true) {
          nodes {
            id
            title
            handle
            status
            updatedAt
            variants(first: 10) {
              nodes {
                id
                title
                sku
                barcode
                price
              }
            }
          }
        }
      }`,
    { variables: { first: 10 } },
  );

  const payload = (await response.json()) as CatalogQueryPayload;

  if (payload.errors?.length) {
    throw new Response(
      `Shopify catalog query failed: ${payload.errors
        .map((error) => error.message)
        .join("; ")}`,
      { status: 502 },
    );
  }

  if (!payload.data) {
    throw new Response("Shopify catalog query returned no data", {
      status: 502,
    });
  }

  return {
    apiVersion: "2026-07",
    shop: session.shop,
    products: payload.data.products.nodes,
  };
};

export default function CatalogAccess() {
  const { apiVersion, products, shop } = useLoaderData<typeof loader>();

  return (
    <s-page heading="CatalogGuard">
      <s-section heading="Phase 1 catalog access">
        <s-paragraph>
          Authenticated read-only GraphQL catalog access for {shop}. Admin API
          version: {apiVersion}.
        </s-paragraph>
        <s-paragraph>
          This page intentionally does not modify Shopify products. Its purpose
          is to verify the minimum product read boundary before the rule engine
          is introduced.
        </s-paragraph>
      </s-section>

      <s-section heading={`Products returned (${products.length})`}>
        {products.length === 0 ? (
          <s-paragraph>
            No products were returned by the development store.
          </s-paragraph>
        ) : (
          <s-unordered-list>
            {products.map((product) => (
              <s-list-item key={product.id}>
                {product.title} — {product.status} —{" "}
                {product.variants.nodes.length} variant(s)
              </s-list-item>
            ))}
          </s-unordered-list>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
