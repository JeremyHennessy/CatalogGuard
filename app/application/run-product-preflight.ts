import { createHash } from "node:crypto";
import {
  NORMALIZATION_VERSION,
  type NormalizedProductV1,
  type NormalizedVariantV1,
} from "../domain/catalog/model";
import type { NormalizedShopifyCatalogV1 } from "../domain/catalog/shopify-normalizer";
import type { ValidatedPolicyRevisionV1 } from "../domain/policy/contracts";
import type { ExactRuleExceptionV1 } from "../domain/policy/evaluator";
import { evaluatePolicyRevisionV1 } from "../domain/policy/evaluator";
import type { PreflightOutcomeV1 } from "../domain/preflight/outcome";
import { canonicalJsonStringify } from "../persistence/json";
import type {
  PersistPreflightResultV1,
  PreflightRepository,
} from "../persistence/preflight-repository";
import {
  buildPreflightEvidencePlanV1,
  type MaterializedPreflightTargetV1,
  type PreflightEvidencePlanV1,
  type PreflightTargetDefinitionV1,
  type PreflightTargetTypeV1,
} from "./preflight-evidence";

export type RunProductPreflightInputV1<TAdmin> = Readonly<{
  admin: TAdmin;
  shopId: string;
  policyId: string;
  expectedRevisionId: string;
  productTargetText: string;
  apiVersion: string;
  engineVersion: string;
  createdByActor?: string;
  now: () => string;
  nextScanId: () => string;
  nextPreflightRunId: () => string;
  loadActiveRevision(
    shopId: string,
    policyId: string,
  ): Promise<ValidatedPolicyRevisionV1 | null>;
  loadExceptions(shopId: string): Promise<readonly ExactRuleExceptionV1[]>;
  readCatalog(admin: TAdmin): Promise<NormalizedShopifyCatalogV1>;
  repository: PreflightRepository;
}>;

export type RunProductPreflightResultV1 = Readonly<{
  scanId: string;
  preflightRunId: string;
  policyRevisionId: string;
  targetType: PreflightTargetTypeV1;
  productGids: readonly string[];
  outcome: PreflightOutcomeV1;
  targetCount: number;
  evaluationCount: number;
  productsProcessed: number;
  variantsProcessed: number;
  persistence: PersistPreflightResultV1;
}>;

const PRODUCT_GID_PATTERN = /^gid:\/\/shopify\/Product\/\d+$/;
const NUMERIC_ID_PATTERN = /^\d+$/;
const PRODUCT_URL_ID_PATTERN = /\/products\/(\d+)(?:[/?#]|$)/;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function assertNonEmpty(value: string, field: string) {
  if (value.trim().length === 0) {
    throw new Error(`${field} must be non-empty`);
  }
}

function parseIsoDate(value: string, field: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    throw new Error(`${field} must be an ISO date-time`);
  }

  return date;
}

function normalizeProductIdentifier(raw: string) {
  const value = raw.trim();
  if (!value) return undefined;

  if (PRODUCT_GID_PATTERN.test(value)) return value;
  if (NUMERIC_ID_PATTERN.test(value)) {
    return `gid://shopify/Product/${value}`;
  }

  const urlMatch = value.match(PRODUCT_URL_ID_PATTERN);
  if (urlMatch) {
    return `gid://shopify/Product/${urlMatch[1]}`;
  }

  throw new Error(`unsupported product preflight target: ${raw}`);
}

export function parseProductPreflightTargetGidsV1(
  productTargetText: string,
): readonly string[] {
  const gids = new Set<string>();

  for (const token of productTargetText.split(/[\s,]+/)) {
    const gid = normalizeProductIdentifier(token);
    if (gid) gids.add(gid);
  }

  if (gids.size === 0) {
    throw new Error("at least one product target is required");
  }

  return Object.freeze([...gids].sort((a, b) => a.localeCompare(b)));
}

function resourceFingerprint(value: unknown) {
  return sha256(canonicalJsonStringify(value));
}

function materializedProductTarget(
  product: NormalizedProductV1,
): MaterializedPreflightTargetV1 {
  return Object.freeze({
    resourceType: "PRODUCT" as const,
    resourceGid: product.gid,
    resourceFingerprint: resourceFingerprint({
      normalizationVersion: NORMALIZATION_VERSION,
      resourceType: "PRODUCT",
      product,
    }),
  });
}

function materializedVariantTarget(
  variant: NormalizedVariantV1,
): MaterializedPreflightTargetV1 {
  return Object.freeze({
    resourceType: "VARIANT" as const,
    resourceGid: variant.gid,
    resourceFingerprint: resourceFingerprint({
      normalizationVersion: NORMALIZATION_VERSION,
      resourceType: "VARIANT",
      variant,
    }),
  });
}

function materializedTargetsFor(
  products: readonly NormalizedProductV1[],
): readonly MaterializedPreflightTargetV1[] {
  const targets: MaterializedPreflightTargetV1[] = [];

  for (const product of [...products].sort((a, b) =>
    a.gid.localeCompare(b.gid),
  )) {
    targets.push(materializedProductTarget(product));

    for (const variant of [...product.variants].sort((a, b) =>
      a.gid.localeCompare(b.gid),
    )) {
      targets.push(materializedVariantTarget(variant));
    }
  }

  return Object.freeze(
    targets.sort((a, b) =>
      `${a.resourceType}|${a.resourceGid}`.localeCompare(
        `${b.resourceType}|${b.resourceGid}`,
      ),
    ),
  );
}

function productTargetDefinition(
  productGids: readonly string[],
): PreflightTargetDefinitionV1 {
  if (productGids.length === 1) {
    return Object.freeze({
      targetType: "PRODUCT" as const,
      productGid: productGids[0],
    });
  }

  return Object.freeze({
    targetType: "PRODUCT_SET" as const,
    productGids,
  });
}

function selectProducts(
  catalog: NormalizedShopifyCatalogV1,
  productGids: readonly string[],
) {
  const productsByGid = new Map(
    catalog.products.map((product) => [product.gid, product]),
  );
  const selected: NormalizedProductV1[] = [];
  const missing: string[] = [];

  for (const gid of productGids) {
    const product = productsByGid.get(gid);
    if (product) {
      selected.push(product);
    } else {
      missing.push(gid);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `preflight target product was not found in verified catalog: ${missing.join(
        ", ",
      )}`,
    );
  }

  return Object.freeze(selected);
}

function variantCount(products: readonly NormalizedProductV1[]) {
  return products.reduce((sum, product) => sum + product.variants.length, 0);
}

function runTargetType(definition: PreflightTargetDefinitionV1) {
  return definition.targetType;
}

function ensureGeneratedId(value: string, field: string) {
  assertNonEmpty(value, field);
  return value.trim();
}

function buildPlan(input: {
  scanId: string;
  preflightRunId: string;
  shopId: string;
  revision: ValidatedPolicyRevisionV1;
  targetDefinition: PreflightTargetDefinitionV1;
  observedAt: Date;
  createdByActor?: string;
  targets: readonly MaterializedPreflightTargetV1[];
  evaluations: PreflightEvidencePlanV1["evaluations"];
}) {
  const observedAtIso = input.observedAt.toISOString();
  const actor = input.createdByActor?.trim();

  return buildPreflightEvidencePlanV1({
    run: {
      id: input.preflightRunId,
      scanId: input.scanId,
      shopId: input.shopId,
      policyRevisionId: input.revision.id,
      targetType: runTargetType(input.targetDefinition),
      status: "COMPLETE",
      targetDefinition: input.targetDefinition,
      createdAt: observedAtIso,
      completedAt: observedAtIso,
      sourceFreshnessAt: observedAtIso,
      ...(actor ? { createdByActor: actor } : {}),
    },
    targets: input.targets,
    evaluations: input.evaluations,
  });
}

export async function runProductPreflightV1<TAdmin>(
  input: RunProductPreflightInputV1<TAdmin>,
): Promise<RunProductPreflightResultV1> {
  const productGids = parseProductPreflightTargetGidsV1(input.productTargetText);
  const revision = await input.loadActiveRevision(input.shopId, input.policyId);
  if (!revision) {
    throw new Error(`active policy revision not found: ${input.policyId}`);
  }
  if (revision.id !== input.expectedRevisionId) {
    throw new Error(
      "active policy revision changed; reload before preflighting",
    );
  }

  const observedAt = parseIsoDate(input.now(), "preflight observedAt");
  const scanId = ensureGeneratedId(input.nextScanId(), "scan id");
  const preflightRunId = ensureGeneratedId(
    input.nextPreflightRunId(),
    "preflight run id",
  );
  const [exceptions, catalog] = await Promise.all([
    input.loadExceptions(input.shopId),
    input.readCatalog(input.admin),
  ]);

  if (catalog.completeness !== "COMPLETE") {
    throw new Error("verified catalog reader returned a partial catalog");
  }

  const products = selectProducts(catalog, productGids);
  const variantsProcessed = variantCount(products);
  const targetDefinition = productTargetDefinition(productGids);
  const evaluations = evaluatePolicyRevisionV1({
    revision,
    products,
    context: {
      shopId: input.shopId,
      observedAt,
      apiVersion: input.apiVersion,
      normalizationVersion: NORMALIZATION_VERSION,
      identifierIndex: catalog.identifierIndex,
    },
    exceptions,
  });
  const plan = buildPlan({
    scanId,
    preflightRunId,
    shopId: input.shopId,
    revision,
    targetDefinition,
    observedAt,
    createdByActor: input.createdByActor,
    targets: materializedTargetsFor(products),
    evaluations,
  });
  const persistence = await input.repository.persistPreflightEvidence({
    scan: {
      id: scanId,
      shopId: input.shopId,
      scanType: "PREFLIGHT",
      policyRevisionId: revision.id,
      apiVersion: input.apiVersion,
      engineVersion: input.engineVersion,
      normalizationVersion: NORMALIZATION_VERSION,
      startedAt: observedAt.toISOString(),
      finishedAt: observedAt.toISOString(),
      productsExpected: products.length,
      productsProcessed: products.length,
      variantsProcessed,
    },
    plan,
  });

  return Object.freeze({
    scanId,
    preflightRunId,
    policyRevisionId: revision.id,
    targetType: plan.run.targetType,
    productGids,
    outcome: plan.summary.outcome,
    targetCount: plan.targets.length,
    evaluationCount: plan.evaluations.length,
    productsProcessed: products.length,
    variantsProcessed,
    persistence,
  });
}
