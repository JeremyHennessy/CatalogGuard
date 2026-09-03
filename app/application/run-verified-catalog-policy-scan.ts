import {
  NORMALIZATION_VERSION,
  type NormalizedProductV1,
} from "../domain/catalog/model";
import type { NormalizedShopifyCatalogV1 } from "../domain/catalog/shopify-normalizer";
import type { ExactRuleExceptionV1 } from "../domain/policy/evaluator";
import { evaluatePolicyRevisionV1 } from "../domain/policy/evaluator";
import type { ValidatedPolicyRevisionV1 } from "../domain/policy/contracts";
import type { FindingChangeCause } from "../domain/findings/lifecycle";
import type {
  PersistPolicyScanResultV1,
  ScanReconciliationRepository,
} from "../persistence/scan-reconciliation-repository";

export type VerifiedCatalogReaderV1 = () => Promise<NormalizedShopifyCatalogV1>;

export type RunVerifiedCatalogPolicyScanInputV1 = Readonly<{
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
  readCatalog: VerifiedCatalogReaderV1;
  repository: ScanReconciliationRepository;
}>;

export type RunVerifiedCatalogPolicyScanResultV1 = Readonly<{
  persistence: PersistPolicyScanResultV1;
  productsProcessed: number;
  variantsProcessed: number;
  evaluationCount: number;
}>;

function parseIsoDate(value: string, field: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error(`${field} must be an ISO date-time`);
  }
  return date;
}

function variantCount(products: readonly NormalizedProductV1[]) {
  return products.reduce((sum, product) => sum + product.variants.length, 0);
}

export async function runVerifiedCatalogPolicyScanV1(
  input: RunVerifiedCatalogPolicyScanInputV1,
): Promise<RunVerifiedCatalogPolicyScanResultV1> {
  const startedAt = parseIsoDate(input.startedAt, "scan startedAt");
  const observedAt = parseIsoDate(input.observedAt, "scan observedAt");
  const finishedAt = parseIsoDate(input.finishedAt, "scan finishedAt");

  if (finishedAt.getTime() < startedAt.getTime()) {
    throw new Error("scan finishedAt cannot be before startedAt");
  }
  if (
    observedAt.getTime() < startedAt.getTime() ||
    observedAt.getTime() > finishedAt.getTime()
  ) {
    throw new Error("scan observedAt must fall between startedAt and finishedAt");
  }

  const catalog = await input.readCatalog();
  if (catalog.completeness !== "COMPLETE") {
    throw new Error("verified catalog reader returned a partial catalog");
  }

  const productsProcessed = catalog.products.length;
  const variantsProcessed = variantCount(catalog.products);
  const evaluations = evaluatePolicyRevisionV1({
    revision: input.revision,
    products: catalog.products,
    context: {
      shopId: input.shopId,
      observedAt,
      apiVersion: input.apiVersion,
      normalizationVersion: NORMALIZATION_VERSION,
      identifierIndex: catalog.identifierIndex,
    },
    exceptions: input.exceptions,
  });

  const persistence = await input.repository.persistPolicyScan({
    scan: {
      id: input.scanId,
      shopId: input.shopId,
      scanType: input.scanType,
      policyRevisionId: input.revision.id,
      apiVersion: input.apiVersion,
      engineVersion: input.engineVersion,
      normalizationVersion: NORMALIZATION_VERSION,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      sourceWatermark: input.sourceWatermark,
      productsExpected: productsProcessed,
      productsProcessed,
      variantsProcessed,
    },
    evaluations,
    baseline: input.baseline,
    changeCause: input.changeCause,
    changeCauseByFindingKey: input.changeCauseByFindingKey,
  });

  return Object.freeze({
    persistence,
    productsProcessed,
    variantsProcessed,
    evaluationCount: evaluations.length,
  });
}
