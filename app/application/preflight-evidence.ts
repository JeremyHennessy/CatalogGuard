import { createHash } from "node:crypto";
import type { PolicyEvaluationV1 } from "../domain/policy/evaluator";
import {
  summarizePreflightEvaluationsV1,
  type PreflightEvaluationSummaryV1,
} from "../domain/preflight/outcome";
import { canonicalJsonStringify } from "../persistence/json";

export type PreflightTargetTypeV1 = "PRODUCT" | "PRODUCT_SET" | "COLLECTION";

export type PreflightTargetDefinitionV1 =
  | Readonly<{
      targetType: "PRODUCT";
      productGid: string;
    }>
  | Readonly<{
      targetType: "PRODUCT_SET";
      productGids: readonly string[];
    }>
  | Readonly<{
      targetType: "COLLECTION";
      collectionGid: string;
      collectionHandle?: string;
      collectionTitle?: string;
    }>;

export type MaterializedPreflightTargetV1 = Readonly<{
  resourceType: "PRODUCT" | "VARIANT";
  resourceGid: string;
  resourceFingerprint: string;
}>;

export type PreflightRunDescriptorV1 = Readonly<{
  id: string;
  scanId: string;
  shopId: string;
  policyRevisionId: string;
  targetType: PreflightTargetTypeV1;
  status: "COMPLETE";
  targetDefinition: PreflightTargetDefinitionV1;
  createdAt: string;
  completedAt: string;
  sourceFreshnessAt?: string;
  createdByActor?: string;
}>;

export type PreflightEvidencePlanV1 = Readonly<{
  inputFingerprint: string;
  run: PreflightRunDescriptorV1;
  summary: PreflightEvaluationSummaryV1;
  targets: readonly MaterializedPreflightTargetV1[];
  evaluations: readonly PolicyEvaluationV1[];
}>;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function parseIsoDate(value: string, field: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    throw new Error(`${field} must be an ISO date-time`);
  }

  return date;
}

function assertNonEmpty(value: string, field: string) {
  if (value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
}

function sortedTargets(
  targets: readonly MaterializedPreflightTargetV1[],
): readonly MaterializedPreflightTargetV1[] {
  return Object.freeze(
    [...targets].sort((a, b) =>
      `${a.resourceType}|${a.resourceGid}|${a.resourceFingerprint}`.localeCompare(
        `${b.resourceType}|${b.resourceGid}|${b.resourceFingerprint}`,
      ),
    ),
  );
}

function sortedEvaluations(
  evaluations: readonly PolicyEvaluationV1[],
): readonly PolicyEvaluationV1[] {
  return Object.freeze(
    [...evaluations].sort((a, b) =>
      canonicalJsonStringify(a).localeCompare(canonicalJsonStringify(b)),
    ),
  );
}

function evaluatedTargetKey(evaluation: PolicyEvaluationV1) {
  return evaluation.result.subresourceGid
    ? `VARIANT|${evaluation.result.subresourceGid}`
    : `PRODUCT|${evaluation.result.resourceGid}`;
}

function targetKey(target: MaterializedPreflightTargetV1) {
  return `${target.resourceType}|${target.resourceGid}`;
}

function validateTargetDefinition(definition: PreflightTargetDefinitionV1) {
  switch (definition.targetType) {
    case "PRODUCT":
      assertNonEmpty(definition.productGid, "productGid");
      break;
    case "PRODUCT_SET": {
      if (definition.productGids.length === 0) {
        throw new Error("productGids must contain at least one product");
      }

      for (const productGid of definition.productGids) {
        assertNonEmpty(productGid, "productGids item");
      }
      break;
    }
    case "COLLECTION":
      assertNonEmpty(definition.collectionGid, "collectionGid");
      break;
  }
}

export function preflightInputFingerprintV1(input: {
  run: PreflightRunDescriptorV1;
  targets: readonly MaterializedPreflightTargetV1[];
  evaluations: readonly PolicyEvaluationV1[];
}) {
  return sha256(
    canonicalJsonStringify({
      run: input.run,
      targets: sortedTargets(input.targets),
      evaluations: sortedEvaluations(input.evaluations),
    }),
  );
}

export function buildPreflightEvidencePlanV1(input: {
  run: PreflightRunDescriptorV1;
  targets: readonly MaterializedPreflightTargetV1[];
  evaluations: readonly PolicyEvaluationV1[];
}): PreflightEvidencePlanV1 {
  if (input.run.targetType !== input.run.targetDefinition.targetType) {
    throw new Error("preflight targetType must match target definition");
  }

  validateTargetDefinition(input.run.targetDefinition);

  const createdAt = parseIsoDate(input.run.createdAt, "preflight createdAt");
  const completedAt = parseIsoDate(
    input.run.completedAt,
    "preflight completedAt",
  );

  if (completedAt.getTime() < createdAt.getTime()) {
    throw new Error("preflight completedAt cannot be before createdAt");
  }

  if (input.run.sourceFreshnessAt) {
    parseIsoDate(input.run.sourceFreshnessAt, "preflight sourceFreshnessAt");
  }

  if (input.targets.length === 0) {
    throw new Error("preflight must materialize at least one target resource");
  }

  const targetKeys = new Set<string>();
  for (const target of input.targets) {
    assertNonEmpty(target.resourceGid, "target resourceGid");
    assertNonEmpty(target.resourceFingerprint, "target resourceFingerprint");

    const key = targetKey(target);
    if (targetKeys.has(key)) {
      throw new Error(`duplicate materialized preflight target: ${key}`);
    }
    targetKeys.add(key);
  }

  for (const evaluation of input.evaluations) {
    if (evaluation.policyRevisionId !== input.run.policyRevisionId) {
      throw new Error(
        `evaluation policy revision ${evaluation.policyRevisionId} does not match preflight revision ${input.run.policyRevisionId}`,
      );
    }

    const key = evaluatedTargetKey(evaluation);
    if (!targetKeys.has(key)) {
      throw new Error(
        `preflight evaluation target was not materialized: ${key}`,
      );
    }
  }

  const evaluations = sortedEvaluations(input.evaluations);
  const targets = sortedTargets(input.targets);
  const summary = summarizePreflightEvaluationsV1(evaluations);

  return Object.freeze({
    inputFingerprint: preflightInputFingerprintV1({
      run: input.run,
      targets,
      evaluations,
    }),
    run: input.run,
    summary,
    targets,
    evaluations,
  });
}
