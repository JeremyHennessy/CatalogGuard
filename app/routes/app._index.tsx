import { boundary } from "@shopify/shopify-app-react-router/server";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, redirect, useLoaderData } from "react-router";
import { developmentBaselineScanIdV1 } from "../domain/policy/dev-validation-template";
import { authenticate } from "../shopify.server";
import { loadExactRuleExceptionsForEvaluationV1 } from "../services/exceptions/exact-exceptions.server";
import { loadCatalogGuardOverviewV1 } from "../services/overview/overview.server";
import { ensureDevValidationPolicyV1 } from "../services/policies/dev-validation-policy.server";
import { runShopifyCatalogPolicyScanV1 } from "../services/scans/catalog-policy-scan.server";
import { ensureCatalogGuardShopV1 } from "../services/shops/shop-record.server";

const API_VERSION = "2026-07";
const ENGINE_VERSION = "catalogguard-policy-v1";
const ESTABLISH_BASELINE_INTENT = "establish-dev-baseline";

async function authenticatedShop(request: Request) {
  const { admin, session } = await authenticate.admin(request);
  const shop = await ensureCatalogGuardShopV1({
    admin,
    shopDomain: session.shop,
    currentScopes: session.scope,
    apiVersion: API_VERSION,
  });

  return { admin, session, shop };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, shop } = await authenticatedShop(request);
  const overview = await loadCatalogGuardOverviewV1(shop.id);

  return {
    apiVersion: API_VERSION,
    shopDomain: session.shop,
    overview,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent !== ESTABLISH_BASELINE_INTENT) {
    throw new Response("Unsupported CatalogGuard action", { status: 400 });
  }

  const { admin, shop } = await authenticatedShop(request);
  const overview = await loadCatalogGuardOverviewV1(shop.id);

  if (overview.baseline) {
    return redirect("/app");
  }

  const now = new Date().toISOString();
  const revision = await ensureDevValidationPolicyV1({
    shopId: shop.id,
    createdAt: now,
  });
  const exceptions = await loadExactRuleExceptionsForEvaluationV1(shop.id);

  await runShopifyCatalogPolicyScanV1({
    admin,
    scanId: developmentBaselineScanIdV1(shop.id),
    shopId: shop.id,
    scanType: "BASELINE",
    apiVersion: API_VERSION,
    engineVersion: ENGINE_VERSION,
    startedAt: now,
    observedAt: now,
    finishedAt: now,
    revision,
    exceptions,
    baseline: true,
  });

  return redirect("/app");
};

function displayDate(value: string | undefined) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString();
}

export default function CatalogGuardOverview() {
  const { apiVersion, overview, shopDomain } = useLoaderData<typeof loader>();
  const latest = overview.latestComplete;

  return (
    <s-page heading="CatalogGuard">
      <s-section heading="Overview">
        <s-paragraph>
          Read-only catalog policy evidence for {shopDomain}. Shopify Admin API
          version: {apiVersion}.
        </s-paragraph>
        <s-paragraph>
          CatalogGuard persists scan and finding evidence. Reloading this page
          reads the persisted state; it does not silently rerun the catalog
          scan.
        </s-paragraph>
      </s-section>

      {overview.baseline ? (
        <>
          <s-section heading="Baseline established">
            <s-paragraph>
              Baseline completed {displayDate(overview.baseline.finishedAt)}.
              Current failures found by that explicit baseline are classified as
              baseline debt rather than new regressions.
            </s-paragraph>
          </s-section>

          {latest ? (
            <s-section heading="Latest complete scan">
              <s-unordered-list>
                <s-list-item>
                  Products evaluated: {latest.productsProcessed}
                </s-list-item>
                <s-list-item>
                  Variants evaluated: {latest.variantsProcessed}
                </s-list-item>
                <s-list-item>PASS evaluations: {latest.passCount}</s-list-item>
                <s-list-item>FAIL evaluations: {latest.failCount}</s-list-item>
                <s-list-item>
                  UNKNOWN evaluations: {latest.unknownCount}
                </s-list-item>
                <s-list-item>
                  NOT_APPLICABLE evaluations: {latest.notApplicableCount}
                </s-list-item>
              </s-unordered-list>
            </s-section>
          ) : null}

          <s-section heading="Current finding summary">
            <s-unordered-list>
              <s-list-item>Open findings: {overview.counts.open}</s-list-item>
              <s-list-item>
                Baseline debt: {overview.counts.baselineDebt}
              </s-list-item>
              <s-list-item>
                New/reopened regressions: {overview.counts.regressions}
              </s-list-item>
              <s-list-item>
                Blocking violations: {overview.counts.blockingViolations}
              </s-list-item>
              <s-list-item>
                Blocking indeterminate: {overview.counts.blockingIndeterminate}
              </s-list-item>
              <s-list-item>
                Waived failures: {overview.counts.waived}
              </s-list-item>
            </s-unordered-list>
          </s-section>

          <s-section heading={`Open findings (${overview.counts.open})`}>
            {overview.findings.length === 0 ? (
              <s-paragraph>
                No open findings are currently persisted.
              </s-paragraph>
            ) : (
              <s-unordered-list>
                {overview.findings.map((finding) => (
                  <s-list-item key={finding.id}>
                    {finding.ruleCode} — {finding.classification} —{" "}
                    {finding.severity}
                    {finding.blocking
                      ? " / blocking"
                      : " / non-blocking"} — {finding.enforcement} —{" "}
                    {finding.message} — resource{" "}
                    {finding.subresourceGid ?? finding.resourceGid}
                  </s-list-item>
                ))}
              </s-unordered-list>
            )}
          </s-section>
        </>
      ) : (
        <s-section heading="No baseline yet">
          <s-paragraph>
            CatalogGuard will not classify current catalog failures until you
            explicitly establish a baseline.
          </s-paragraph>
          <s-paragraph>
            The development validation policy checks ACTIVE product variants for
            a required SKU and store-wide unique SKU using EXACT normalization.
            Both checks are CRITICAL and blocking. This is a development test
            policy, not a merchant production default.
          </s-paragraph>
          <Form method="post">
            <input
              type="hidden"
              name="intent"
              value={ESTABLISH_BASELINE_INTENT}
            />
            <s-button type="submit" variant="primary">
              Establish dev baseline
            </s-button>
          </Form>
        </s-section>
      )}

      <s-section heading="Development policy boundary">
        <s-paragraph>
          CatalogGuard remains read-only to Shopify products. The baseline
          action reads the complete catalog, evaluates the immutable development
          policy, and writes only CatalogGuard&apos;s own evidence database.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
