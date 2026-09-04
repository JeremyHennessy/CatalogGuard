import { boundary } from "@shopify/shopify-app-react-router/server";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { loadRecentPreflightRunsV1 } from "../services/preflight/preflight-runs.server";
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
  const preflightRuns = await loadRecentPreflightRunsV1(shop.id);

  return {
    shopDomain: session.shop,
    preflightRuns,
  };
};

function displayDate(value: string | undefined) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString();
}

export default function CatalogGuardPreflight() {
  const { preflightRuns, shopDomain } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Preflight">
      <s-section heading="Launch evidence">
        <s-paragraph>
          Persisted preflight evidence for {shopDomain}. This page only reads
          recorded preflight runs; it does not rerun catalog checks or create a
          new baseline.
        </s-paragraph>
        <s-paragraph>
          Outcomes use the same policy semantics as findings: blocking
          violations fail, blocking unknowns are indeterminate, and exact active
          waivers can produce pass with waivers without changing technical
          failures.
        </s-paragraph>
        <s-paragraph>
          <s-link href="/app">Back to overview</s-link>
        </s-paragraph>
      </s-section>

      {preflightRuns.items.length === 0 ? (
        <s-section heading="No preflight runs yet">
          <s-paragraph>
            No target-specific launch checks are persisted yet. The evidence
            model and history surface are in place; the next slice wires product
            and collection run actions into this page.
          </s-paragraph>
        </s-section>
      ) : (
        <s-section heading={`Recent preflights (${preflightRuns.total})`}>
          <s-unordered-list>
            {preflightRuns.items.map((run) => (
              <s-list-item key={run.id}>
                {run.targetType} — {run.outcome ?? run.status} — policy{" "}
                {run.policyRevision.nameSnapshot} v
                {run.policyRevision.revisionNumber} — completed{" "}
                {displayDate(run.completedAt)} — targets {run.targetCount}
                {run.targetsTruncated ? "+" : ""} — blocking violations{" "}
                {run.blockingViolationCount} — blocking indeterminate{" "}
                {run.indeterminateBlockingCount} — waivers {run.waiverCount}
              </s-list-item>
            ))}
          </s-unordered-list>
        </s-section>
      )}

      {preflightRuns.items.length > 0 ? (
        <s-section heading="Target evidence preview">
          {preflightRuns.items.map((run) => (
            <div key={run.id}>
              <h3>{run.id}</h3>
              <s-unordered-list>
                {run.targets.map((target) => (
                  <s-list-item key={`${run.id}-${target.resourceGid}`}>
                    {target.resourceType} — {target.resourceGid} — fingerprint{" "}
                    {target.resourceFingerprint}
                  </s-list-item>
                ))}
              </s-unordered-list>
              <pre>{run.targetDefinitionJson}</pre>
            </div>
          ))}
        </s-section>
      ) : null}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
