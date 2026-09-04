import { boundary } from "@shopify/shopify-app-react-router/server";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { loadOpenFindingsV1 } from "../services/findings/findings.server";
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
  const findings = await loadOpenFindingsV1(shop.id);

  return {
    shopDomain: session.shop,
    findings,
  };
};

function displayDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function CatalogGuardFindings() {
  const { findings, shopDomain } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Findings">
      <s-section heading="Open catalog findings">
        <s-paragraph>
          Persisted open policy findings for {shopDomain}. This page reads
          CatalogGuard evidence and does not rerun the catalog scan.
        </s-paragraph>
        <s-paragraph>
          Showing {findings.items.length} of {findings.total} open findings.
          {findings.truncated
            ? " The list is capped for this first evidence view; pagination is still required."
            : ""}
        </s-paragraph>
        <p>
          <a href="/app">Back to overview</a>
        </p>
      </s-section>

      {findings.items.length === 0 ? (
        <s-section heading="No open findings">
          <s-paragraph>No open findings are currently persisted.</s-paragraph>
        </s-section>
      ) : (
        <s-section heading={`Findings (${findings.total})`}>
          <s-unordered-list>
            {findings.items.map((finding) => (
              <s-list-item key={finding.id}>
                {finding.ruleCode} — {finding.classification} —{" "}
                {finding.evaluation.severity}
                {finding.evaluation.blocking
                  ? " / blocking"
                  : " / non-blocking"}{" "}
                — {finding.evaluation.enforcement} —{" "}
                {finding.evaluation.message} — target{" "}
                {finding.subresourceGid ?? finding.resourceGid} — last seen{" "}
                {displayDate(finding.lastSeenAt)} —{" "}
                <a href={`/app/finding/${encodeURIComponent(finding.id)}`}>
                  View evidence history
                </a>
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
