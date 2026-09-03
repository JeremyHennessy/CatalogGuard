import type { FindingChangeCause } from "../../domain/findings/lifecycle";
import type { ValidatedPolicyRevisionV1 } from "../../domain/policy/contracts";
import type { ExactRuleExceptionV1 } from "../../domain/policy/evaluator";
import { runVerifiedCatalogPolicyScanV1 } from "../../application/run-verified-catalog-policy-scan";
import { PrismaScanReconciliationRepository } from "../../persistence/prisma-scan-reconciliation-repository.server";
import {
  readVerifiedCatalogFromShopifyAdmin,
  type ShopifyAdminGraphqlClient,
} from "../shopify/catalog-reader.server";

export type RunShopifyCatalogPolicyScanInputV1 = Readonly<{
  admin: ShopifyAdminGraphqlClient;
  scanId: string;
  shopId: string;
  scanType: string;
  apiVersion: string;
  engineVersion: string;
  startedAt: string;
  observedAt: string;
  finishedAt: string;
  sourceWatermark?: string;
  revision: ValidatedPolicyRevisionV1;
  exceptions?: readonly ExactRuleExceptionV1[];
  baseline: boolean;
  changeCause?: FindingChangeCause;
  changeCauseByFindingKey?: ReadonlyMap<string, FindingChangeCause>;
}>;

export async function runShopifyCatalogPolicyScanV1(
  input: RunShopifyCatalogPolicyScanInputV1,
) {
  const repository = new PrismaScanReconciliationRepository();

  return runVerifiedCatalogPolicyScanV1({
    scanId: input.scanId,
    shopId: input.shopId,
    scanType: input.scanType,
    apiVersion: input.apiVersion,
    engineVersion: input.engineVersion,
    startedAt: input.startedAt,
    observedAt: input.observedAt,
    finishedAt: input.finishedAt,
    sourceWatermark: input.sourceWatermark,
    revision: input.revision,
    exceptions: input.exceptions,
    baseline: input.baseline,
    changeCause: input.changeCause,
    changeCauseByFindingKey: input.changeCauseByFindingKey,
    readCatalog: () => readVerifiedCatalogFromShopifyAdmin(input.admin),
    repository,
  });
}
