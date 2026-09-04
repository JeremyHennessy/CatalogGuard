import { boundary } from "@shopify/shopify-app-react-router/server";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { loadPoliciesForShopV1 } from "../services/policies/policy-workspace.server";
import { ensureCatalogGuardShopV1 } from "../services/shops/shop-record.server";

const API_VERSION = "2026-07";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await ensureCatalogGuardShopV1({
    admin,
    shopDomain: session.shop,
    currentScopes: session.scope,
    apiVersion: API_VERSION,
  });

  return {
    shopDomain: session.shop,
    policies: await loadPoliciesForShopV1(shop.id),
  };
};

export default function CatalogGuardPolicies() {
  const { policies, shopDomain } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Policies">
      <s-section heading="Catalog policy revisions">
        <s-paragraph>
          Policies for {shopDomain}. Saving an edit creates a new immutable
          revision; existing scan and baseline evidence continues to reference
          the exact revision that produced it.
        </s-paragraph>
        <s-link href="/app">Back to overview</s-link>
      </s-section>

      {policies.length === 0 ? (
        <s-section heading="No policies">
          <s-paragraph>No CatalogGuard policies are persisted.</s-paragraph>
        </s-section>
      ) : (
        <s-section heading={`Policies (${policies.length})`}>
          <s-unordered-list>
            {policies.map((policy) => (
              <s-list-item key={policy.id}>
                <s-link href={`/app/policy/${encodeURIComponent(policy.id)}`}>
                  {policy.name}
                </s-link>{" "}
                — {policy.status} — {policy.revisionCount} revision
                {policy.revisionCount === 1 ? "" : "s"}
                {policy.latestRevision
                  ? ` — latest v${policy.latestRevision.revisionNumber}`
                  : ""}
              </s-list-item>
            ))}
          </s-unordered-list>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
