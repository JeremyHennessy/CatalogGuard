import { randomUUID } from "node:crypto";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "react-router";
import { redirect } from "react-router";
import { runPolicyReconciliationV1 } from "../application/run-policy-reconciliation";
import { authenticate } from "../shopify.server";
import { loadExactRuleExceptionsForEvaluationV1 } from "../services/exceptions/exact-exceptions.server";
import { loadActiveValidatedPolicyRevisionV1 } from "../services/policies/active-policy.server";
import { runShopifyCatalogPolicyScanV1 } from "../services/scans/catalog-policy-scan.server";
import { ensureCatalogGuardShopV1 } from "../services/shops/shop-record.server";

const API_VERSION = "2026-07";
const ENGINE_VERSION = "catalogguard-policy-v1";

export const loader = async ({ params }: LoaderFunctionArgs) =>
  redirect(
    params.policyId
      ? `/app/policy/${encodeURIComponent(params.policyId)}`
      : "/app/policies",
  );

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

  const { admin, session } = await authenticate.admin(request);
  const shop = await ensureCatalogGuardShopV1({
    admin,
    shopDomain: session.shop,
    currentScopes: session.scope,
    apiVersion: API_VERSION,
  });

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
