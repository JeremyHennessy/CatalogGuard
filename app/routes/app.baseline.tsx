import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { establishDevBaselineV1 } from "../application/establish-dev-baseline";
import { authenticate } from "../shopify.server";
import { loadExactRuleExceptionsForEvaluationV1 } from "../services/exceptions/exact-exceptions.server";
import { loadCatalogGuardOverviewV1 } from "../services/overview/overview.server";
import { ensureDevValidationPolicyV1 } from "../services/policies/dev-validation-policy.server";
import { runShopifyCatalogPolicyScanV1 } from "../services/scans/catalog-policy-scan.server";
import { ensureCatalogGuardShopV1 } from "../services/shops/shop-record.server";

const API_VERSION = "2026-07";
const ENGINE_VERSION = "catalogguard-policy-v1";

export const loader = async () => redirect("/app");

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await ensureCatalogGuardShopV1({
    admin,
    shopDomain: session.shop,
    currentScopes: session.scope,
    apiVersion: API_VERSION,
  });

  await establishDevBaselineV1({
    admin,
    shopId: shop.id,
    apiVersion: API_VERSION,
    engineVersion: ENGINE_VERSION,
    now: () => new Date().toISOString(),
    loadOverview: loadCatalogGuardOverviewV1,
    ensurePolicy: ensureDevValidationPolicyV1,
    loadExceptions: loadExactRuleExceptionsForEvaluationV1,
    runScan: runShopifyCatalogPolicyScanV1,
  });

  return redirect("/app");
};
