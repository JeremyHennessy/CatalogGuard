import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import prisma from "../db.server";
import type {
  MaterializedPreflightTargetV1,
  PreflightEvidencePlanV1,
} from "../application/preflight-evidence";
import type { PolicyEvaluationV1 } from "../domain/policy/evaluator";
import { canonicalJsonStringify, parseCanonicalJson } from "./json";
import type {
  PersistPreflightEvidenceInputV1,
  PersistPreflightResultV1,
  PreflightRepository,
} from "./preflight-repository";

function dateFromIso(value: string, field: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    throw new Error(`${field} must be an ISO date-time`);
  }

  return date;
}

function optionalCanonicalJson(value: unknown) {
  return value === undefined ? null : canonicalJsonStringify(value);
}

function metadataFingerprint(value: string | null) {
  if (!value) return null;
  const parsed = parseCanonicalJson(value);

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed) ||
    typeof (parsed as Record<string, unknown>).inputFingerprint !== "string"
  ) {
    throw new Error("persisted scan metadata is missing inputFingerprint");
  }

  return (parsed as Record<string, unknown>).inputFingerprint as string;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stableId(prefix: string, value: unknown) {
  return `${prefix}_${sha256(canonicalJsonStringify(value)).slice(0, 40)}`;
}

function targetKey(target: {
  resourceType: string;
  resourceGid: string;
  resourceFingerprint: string;
}) {
  return `${target.resourceType}|${target.resourceGid}|${target.resourceFingerprint}`;
}

function sortedTargetKeys(targets: readonly MaterializedPreflightTargetV1[]) {
  return targets.map(targetKey).sort();
}

function assertSameTargets(
  stored: readonly {
    resourceType: string;
    resourceGid: string;
    resourceFingerprint: string;
  }[],
  planned: readonly MaterializedPreflightTargetV1[],
) {
  const storedKeys = stored.map(targetKey).sort();
  const plannedKeys = sortedTargetKeys(planned);

  if (storedKeys.length !== plannedKeys.length) {
    throw new Error("preflight run already exists with different targets");
  }

  for (const [index, storedKey] of storedKeys.entries()) {
    if (storedKey !== plannedKeys[index]) {
      throw new Error("preflight run already exists with different targets");
    }
  }
}

function targetDefinitionRecordJson(plan: PreflightEvidencePlanV1) {
  return canonicalJsonStringify({
    inputFingerprint: plan.inputFingerprint,
    targetDefinition: plan.run.targetDefinition,
  });
}

function policyRuleKey(ruleCode: string, ruleVersion: number) {
  return `${ruleCode}@${ruleVersion}`;
}

function countEvaluations(evaluations: readonly PolicyEvaluationV1[]) {
  let passCount = 0;
  let failCount = 0;
  let unknownCount = 0;
  let notApplicableCount = 0;
  let warningCount = 0;

  for (const evaluation of evaluations) {
    switch (evaluation.result.status) {
      case "PASS":
        passCount += 1;
        break;
      case "FAIL":
        failCount += 1;
        if (evaluation.severity === "WARNING") warningCount += 1;
        break;
      case "UNKNOWN":
        unknownCount += 1;
        break;
      case "NOT_APPLICABLE":
        notApplicableCount += 1;
        break;
    }
  }

  return Object.freeze({
    passCount,
    failCount,
    unknownCount,
    notApplicableCount,
    warningCount,
  });
}

async function validateLinkedScan(
  tx: Prisma.TransactionClient,
  plan: PreflightEvidencePlanV1,
) {
  const scan = await tx.scan.findUnique({
    where: { id: plan.run.scanId },
    select: {
      id: true,
      shopId: true,
      scanType: true,
      status: true,
      policyRevisionId: true,
    },
  });

  if (!scan) {
    throw new Error(`preflight scan not found: ${plan.run.scanId}`);
  }

  if (scan.status !== "COMPLETE") {
    throw new Error(
      "preflight scan must be complete before preflight persists",
    );
  }

  if (scan.scanType !== "PREFLIGHT") {
    throw new Error("preflight run must link to a PREFLIGHT scan");
  }

  if (
    scan.shopId !== plan.run.shopId ||
    scan.policyRevisionId !== plan.run.policyRevisionId
  ) {
    throw new Error("preflight scan identity does not match preflight run");
  }
}

function assertEvidenceInputMatchesPlan(
  input: PersistPreflightEvidenceInputV1,
) {
  if (input.scan.id !== input.plan.run.scanId) {
    throw new Error("preflight evidence scan id must match run scan id");
  }
  if (input.scan.shopId !== input.plan.run.shopId) {
    throw new Error("preflight evidence shop id must match run shop id");
  }
  if (input.scan.scanType !== "PREFLIGHT") {
    throw new Error("preflight evidence scanType must be PREFLIGHT");
  }
  if (input.scan.policyRevisionId !== input.plan.run.policyRevisionId) {
    throw new Error(
      "preflight evidence policy revision must match run policy revision",
    );
  }
  if (input.scan.startedAt !== input.plan.run.createdAt) {
    throw new Error("preflight scan startedAt must match run createdAt");
  }
  if (input.scan.finishedAt !== input.plan.run.completedAt) {
    throw new Error("preflight scan finishedAt must match run completedAt");
  }
}

function assertSameExistingScan(
  input: PersistPreflightEvidenceInputV1,
  existing: {
    shopId: string;
    scanType: string;
    status: string;
    policyRevisionId: string | null;
    apiVersion: string;
    engineVersion: string;
    normalizationVersion: string;
    startedAt: Date;
    finishedAt: Date | null;
    sourceWatermark: string | null;
    productsExpected: number | null;
    productsProcessed: number;
    variantsProcessed: number;
    metadataJson: string | null;
  },
) {
  if (
    existing.shopId !== input.scan.shopId ||
    existing.scanType !== input.scan.scanType ||
    existing.status !== "COMPLETE" ||
    existing.policyRevisionId !== input.scan.policyRevisionId ||
    existing.apiVersion !== input.scan.apiVersion ||
    existing.engineVersion !== input.scan.engineVersion ||
    existing.normalizationVersion !== input.scan.normalizationVersion ||
    existing.startedAt.toISOString() !== input.scan.startedAt ||
    existing.finishedAt?.toISOString() !== input.scan.finishedAt ||
    (existing.sourceWatermark ?? undefined) !== input.scan.sourceWatermark ||
    existing.productsExpected !== input.scan.productsExpected ||
    existing.productsProcessed !== input.scan.productsProcessed ||
    existing.variantsProcessed !== input.scan.variantsProcessed ||
    metadataFingerprint(existing.metadataJson) !== input.plan.inputFingerprint
  ) {
    throw new Error(
      `scan id ${input.scan.id} already exists with different immutable preflight evidence`,
    );
  }
}

async function validatePersistedException(
  tx: Prisma.TransactionClient,
  input: PersistPreflightEvidenceInputV1,
  exceptionId: string,
  evaluation: PolicyEvaluationV1,
) {
  const exception = await tx.ruleException.findUnique({
    where: { id: exceptionId },
    select: {
      id: true,
      shopId: true,
      ruleCode: true,
      resourceGid: true,
      subresourceGid: true,
    },
  });

  if (!exception) {
    throw new Error(`persisted exception not found: ${exceptionId}`);
  }

  if (
    exception.shopId !== input.scan.shopId ||
    exception.ruleCode !== evaluation.ruleCode ||
    exception.resourceGid !== evaluation.result.resourceGid ||
    (exception.subresourceGid ?? undefined) !== evaluation.result.subresourceGid
  ) {
    throw new Error(
      `persisted exception ${exceptionId} does not exactly match evaluation evidence`,
    );
  }
}

async function policyRuleIdsFor(
  tx: Prisma.TransactionClient,
  input: PersistPreflightEvidenceInputV1,
) {
  const policyRules = await tx.policyRule.findMany({
    where: { policyRevisionId: input.scan.policyRevisionId },
    select: { id: true, ruleCode: true, ruleVersion: true },
  });
  const policyRuleIdByKey = new Map(
    policyRules.map((rule) => [
      policyRuleKey(rule.ruleCode, rule.ruleVersion),
      rule.id,
    ]),
  );

  for (const evaluation of input.plan.evaluations) {
    const ruleId = policyRuleIdByKey.get(
      policyRuleKey(evaluation.ruleCode, evaluation.ruleVersion),
    );
    if (!ruleId) {
      throw new Error(
        `policy revision ${input.scan.policyRevisionId} does not contain ${evaluation.ruleCode}@${evaluation.ruleVersion}`,
      );
    }

    if (evaluation.exceptionId) {
      await validatePersistedException(
        tx,
        input,
        evaluation.exceptionId,
        evaluation,
      );
    }
  }

  return policyRuleIdByKey;
}

async function persistPreflightRunInTransaction(
  tx: Prisma.TransactionClient,
  plan: PreflightEvidencePlanV1,
): Promise<PersistPreflightResultV1> {
  const targetDefinitionJson = targetDefinitionRecordJson(plan);
  const existing = await tx.preflightRun.findUnique({
    where: { id: plan.run.id },
    select: {
      id: true,
      scanId: true,
      shopId: true,
      policyRevisionId: true,
      targetType: true,
      status: true,
      outcome: true,
      targetDefinitionJson: true,
      blockingViolationCount: true,
      waiverCount: true,
      indeterminateBlockingCount: true,
      targets: {
        select: {
          resourceType: true,
          resourceGid: true,
          resourceFingerprint: true,
        },
      },
    },
  });

  if (existing) {
    if (
      existing.scanId !== plan.run.scanId ||
      existing.shopId !== plan.run.shopId ||
      existing.policyRevisionId !== plan.run.policyRevisionId ||
      existing.targetType !== plan.run.targetType ||
      existing.status !== plan.run.status ||
      existing.outcome !== plan.summary.outcome ||
      existing.targetDefinitionJson !== targetDefinitionJson ||
      existing.blockingViolationCount !== plan.summary.blockingViolationCount ||
      existing.waiverCount !== plan.summary.waiverCount ||
      existing.indeterminateBlockingCount !==
        plan.summary.indeterminateBlockingCount
    ) {
      throw new Error(
        `preflight run ${plan.run.id} already exists with different immutable input`,
      );
    }

    assertSameTargets(existing.targets, plan.targets);

    return Object.freeze({
      status: "ALREADY_PERSISTED" as const,
      preflightRunId: plan.run.id,
      scanId: plan.run.scanId,
      inputFingerprint: plan.inputFingerprint,
      outcome: plan.summary.outcome,
      targetCount: plan.targets.length,
    });
  }

  await tx.preflightRun.create({
    data: {
      id: plan.run.id,
      targetType: plan.run.targetType,
      status: plan.run.status,
      outcome: plan.summary.outcome,
      targetDefinitionJson,
      sourceFreshnessAt: plan.run.sourceFreshnessAt
        ? dateFromIso(plan.run.sourceFreshnessAt, "preflight sourceFreshnessAt")
        : null,
      blockingViolationCount: plan.summary.blockingViolationCount,
      waiverCount: plan.summary.waiverCount,
      indeterminateBlockingCount: plan.summary.indeterminateBlockingCount,
      createdByActor: plan.run.createdByActor,
      createdAt: dateFromIso(plan.run.createdAt, "preflight createdAt"),
      completedAt: dateFromIso(plan.run.completedAt, "preflight completedAt"),
      shop: { connect: { id: plan.run.shopId } },
      scan: { connect: { id: plan.run.scanId } },
      policyRevision: { connect: { id: plan.run.policyRevisionId } },
    },
  });

  for (const target of plan.targets) {
    await tx.preflightTarget.create({
      data: {
        resourceType: target.resourceType,
        resourceGid: target.resourceGid,
        resourceFingerprint: target.resourceFingerprint,
        preflightRun: { connect: { id: plan.run.id } },
      },
    });
  }

  return Object.freeze({
    status: "PERSISTED" as const,
    preflightRunId: plan.run.id,
    scanId: plan.run.scanId,
    inputFingerprint: plan.inputFingerprint,
    outcome: plan.summary.outcome,
    targetCount: plan.targets.length,
  });
}

async function persistPreflightScanEvidence(
  tx: Prisma.TransactionClient,
  input: PersistPreflightEvidenceInputV1,
) {
  const existingScan = await tx.scan.findUnique({
    where: { id: input.scan.id },
    select: {
      shopId: true,
      scanType: true,
      status: true,
      policyRevisionId: true,
      apiVersion: true,
      engineVersion: true,
      normalizationVersion: true,
      startedAt: true,
      finishedAt: true,
      sourceWatermark: true,
      productsExpected: true,
      productsProcessed: true,
      variantsProcessed: true,
      metadataJson: true,
    },
  });

  if (existingScan) {
    assertSameExistingScan(input, existingScan);

    const evaluationCount = await tx.evaluation.count({
      where: { scanId: input.scan.id },
    });
    if (evaluationCount !== input.plan.evaluations.length) {
      throw new Error(
        `scan id ${input.scan.id} already exists with different evaluation count`,
      );
    }

    return;
  }

  const policyRuleIdByKey = await policyRuleIdsFor(tx, input);
  const counts = countEvaluations(input.plan.evaluations);

  await tx.scan.create({
    data: {
      id: input.scan.id,
      scanType: input.scan.scanType,
      status: "COMPLETE",
      apiVersion: input.scan.apiVersion,
      engineVersion: input.scan.engineVersion,
      normalizationVersion: input.scan.normalizationVersion,
      startedAt: dateFromIso(input.scan.startedAt, "scan startedAt"),
      finishedAt: dateFromIso(input.scan.finishedAt, "scan finishedAt"),
      sourceWatermark: input.scan.sourceWatermark,
      productsExpected: input.scan.productsExpected,
      productsProcessed: input.scan.productsProcessed,
      variantsProcessed: input.scan.variantsProcessed,
      passCount: counts.passCount,
      failCount: counts.failCount,
      unknownCount: counts.unknownCount,
      notApplicableCount: counts.notApplicableCount,
      warningCount: counts.warningCount,
      metadataJson: canonicalJsonStringify({
        inputFingerprint: input.plan.inputFingerprint,
        evidenceOnly: true,
        preflightRunId: input.plan.run.id,
        targetCount: input.plan.targets.length,
      }),
      shop: { connect: { id: input.scan.shopId } },
      policyRevision: { connect: { id: input.scan.policyRevisionId } },
    },
  });

  for (const [index, evaluation] of input.plan.evaluations.entries()) {
    const policyRuleId = policyRuleIdByKey.get(
      policyRuleKey(evaluation.ruleCode, evaluation.ruleVersion),
    );
    if (!policyRuleId) {
      throw new Error("policy rule disappeared during transaction");
    }

    await tx.evaluation.create({
      data: {
        id: stableId("evaluation", {
          scanId: input.scan.id,
          index,
          evaluation,
        }),
        ruleCode: evaluation.ruleCode,
        ruleVersion: evaluation.ruleVersion,
        resourceGid: evaluation.result.resourceGid,
        subresourceGid: evaluation.result.subresourceGid,
        status: evaluation.result.status,
        enforcement: evaluation.enforcement,
        observedJson: optionalCanonicalJson(evaluation.result.observed),
        expectedJson: optionalCanonicalJson(evaluation.result.expected),
        message: evaluation.result.message,
        reasonCode: evaluation.result.reasonCode,
        evidenceJson: optionalCanonicalJson(evaluation.result.evidence),
        evaluatedAt: dateFromIso(
          evaluation.evaluatedAt,
          "evaluation evaluatedAt",
        ),
        scan: { connect: { id: input.scan.id } },
        policyRevision: {
          connect: { id: input.scan.policyRevisionId },
        },
        policyRule: { connect: { id: policyRuleId } },
        ...(evaluation.exceptionId
          ? { exception: { connect: { id: evaluation.exceptionId } } }
          : {}),
      },
    });
  }
}

export class PrismaPreflightRepository implements PreflightRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async persistPreflight(
    plan: PreflightEvidencePlanV1,
  ): Promise<PersistPreflightResultV1> {
    return this.client.$transaction(async (tx) => {
      await validateLinkedScan(tx, plan);
      return persistPreflightRunInTransaction(tx, plan);
    });
  }

  async persistPreflightEvidence(
    input: PersistPreflightEvidenceInputV1,
  ): Promise<PersistPreflightResultV1> {
    assertEvidenceInputMatchesPlan(input);

    return this.client.$transaction(async (tx) => {
      await persistPreflightScanEvidence(tx, input);
      return persistPreflightRunInTransaction(tx, input.plan);
    });
  }
}
