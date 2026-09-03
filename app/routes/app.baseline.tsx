import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { developmentBaselineScanIdV1 } from "../domain/policy/dev-validation-template";
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
