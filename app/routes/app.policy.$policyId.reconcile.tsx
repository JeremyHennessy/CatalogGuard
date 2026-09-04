import { randomUUID } from "node:crypto";
import { boundary } from "@shopify/shopify-app-react-router/server";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useLoaderData, useSubmit } from "react-router";
import { runPolicyReconciliationV1 } from "../application/run-policy-reconciliation";
import { authenticate } from "../shopify.server";
import { loadExactRuleExceptionsForEvaluationV1 } from "../services/exceptions/exact-exceptions.server";
import { loadActiveValidatedPolicyRevisionV1 } from "../services/policies/active-policy.server";
import { runShopifyCatalogPolicyScanV1 } from "../services/scans/catalog-policy-scan.server";
import { ensureCatalogGuardShopV1 } from "../services/shops/shop-record.server";

const API_VERSION = "2026-07";
const ENGINE_VERSION = "catalogguard-policy-v1";

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

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  if (!params.policyId) {
    throw new Response("Policy id is required", { status: 400 });
  }
  const { session, shop } = await authenticatedShop(request);
  const revision = await loadActiveValidatedPolicyRevisionV1(
    shop.id,
    params.policyId,
  );
  if (!revision) {
    throw new Response("Active policy revision not found", { status: 404 });
  }

  return {
    shopDomain: session.shop,
    policyId: params.policyId,
    revisionId: revision.id,
    revisionNumber: revision.revisionNumber,
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  if (!params.policyId) {
    throw new Response("Policy id is required", { status: 400 });
  }
  const form = await request.formData();
  const expectedRevisionId = form.get("expectedRevisionId");
  if (
    typeof expectedRevisionId !== "string" ||
    expectedRevisionId.trim().length === 0
  ) {
    throw new Response("Expected policy revision is required", { status: 400 });
  }

  const { admin, shop } = await authenticatedShop(request);
  await runPolicyReconciliationV1({
    admin,
    shopId: shop.id,
    policyId: params.policyId,
    expectedRevisionId,
    apiVersion: API_VERSION,
    engineVersion: ENGINE_VERSION,
    now: () => new Date().toISOString(),
    nextScanId: () => `scan_${randomUUID()}`,
    loadActiveRevision: loadActiveValidatedPolicyRevisionV1,
    loadExceptions: loadExactRuleExceptionsForEvaluationV1,
    runScan: runShopifyCatalogPolicyScanV1,
  });

  return redirect("/app");
};

export default function CatalogGuardPolicyReconciliation() {
  const { policyId, revisionId, revisionNumber, shopDomain } =
    useLoaderData<typeof loader>();
  const submit = useSubmit();

  const reconcile = () => {
    const form = new FormData();
    form.set("expectedRevisionId", revisionId);
    submit(form, { method: "post" });
  };

  return (
    <s-page heading="Policy reconciliation">
      <s-section heading={`Reconcile active revision v${revisionNumber}`}>
        <s-paragraph>
          Run a complete read-only catalog reconciliation for {shopDomain} using
          the exact active policy revision shown here. This is explicit and does
          not run automatically when a policy is saved.
        </s-paragraph>
        <s-paragraph>
          New failures created by this run are classified with POLICY_CHANGE
          cause. Existing baseline evidence is retained and is never rewritten.
        </s-paragraph>
        <s-unordered-list>
          <s-list-item>Policy: {policyId}</s-list-item>
          <s-list-item>Revision: {revisionId}</s-list-item>
          <s-list-item>Shopify products remain read-only.</s-list-item>
        </s-unordered-list>
        <s-button type="button" variant="primary" onClick={reconcile}>
          Run full policy reconciliation
        </s-button>
        <s-paragraph>
          <s-link href={`/app/policy/${encodeURIComponent(policyId)}`}>
            Back to policy
          </s-link>
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
