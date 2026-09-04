import type { Prisma, PrismaClient } from "@prisma/client";
import prisma from "../db.server";
import type {
  MaterializedPreflightTargetV1,
  PreflightEvidencePlanV1,
} from "../application/preflight-evidence";
import { canonicalJsonStringify } from "./json";
import type {
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

export class PrismaPreflightRepository implements PreflightRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async persistPreflight(
    plan: PreflightEvidencePlanV1,
  ): Promise<PersistPreflightResultV1> {
    return this.client.$transaction(async (tx) => {
      await validateLinkedScan(tx, plan);

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
          existing.blockingViolationCount !==
            plan.summary.blockingViolationCount ||
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
            ? dateFromIso(
                plan.run.sourceFreshnessAt,
                "preflight sourceFreshnessAt",
              )
            : null,
          blockingViolationCount: plan.summary.blockingViolationCount,
          waiverCount: plan.summary.waiverCount,
          indeterminateBlockingCount: plan.summary.indeterminateBlockingCount,
          createdByActor: plan.run.createdByActor,
          createdAt: dateFromIso(plan.run.createdAt, "preflight createdAt"),
          completedAt: dateFromIso(
            plan.run.completedAt,
            "preflight completedAt",
          ),
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
    });
  }
}
