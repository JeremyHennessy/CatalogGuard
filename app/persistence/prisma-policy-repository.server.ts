import type { Prisma, PrismaClient } from "@prisma/client";
import prisma from "../db.server";
import type { RuleSeverity } from "../domain/rules/contracts";
import {
  policyRevisionInputFromSnapshotV1,
  snapshotValidatedPolicyRevisionV1,
  type PersistedPolicyRevisionSnapshotV1,
} from "./policy-mapper";
import type {
  AppendPolicyRevisionInput,
  CreatePolicyInput,
  PolicyRepository,
  PolicyRevisionSnapshotMetadata,
} from "./policy-repository";

function severityFromDatabase(value: string): RuleSeverity {
  if (
    value === "INFO" ||
    value === "WARNING" ||
    value === "ERROR" ||
    value === "CRITICAL"
  ) {
    return value;
  }

  throw new Error(`unsupported persisted rule severity: ${value}`);
}

async function persistRevision(
  tx: Prisma.TransactionClient,
  revision: AppendPolicyRevisionInput["revision"],
  metadata: PolicyRevisionSnapshotMetadata,
) {
  const snapshot = snapshotValidatedPolicyRevisionV1(revision);

  await tx.policyRevision.create({
    data: {
      id: snapshot.id,
      revisionNumber: snapshot.revisionNumber,
      schemaVersion: snapshot.schemaVersion,
      createdAt: new Date(snapshot.createdAt),
      nameSnapshot: metadata.nameSnapshot,
      descriptionSnapshot: metadata.descriptionSnapshot,
      createdByActor: metadata.createdByActor,
      changeSummary: metadata.changeSummary,
      policy: { connect: { id: snapshot.policyId } },
      rules: {
        create: snapshot.rules.map((rule) => ({
          ruleCode: rule.ruleCode,
          ruleVersion: rule.ruleVersion,
          enabled: rule.enabled,
          severity: rule.severity,
          blocking: rule.blocking,
          configJson: rule.configJson,
          scopeJson: rule.scopeJson,
          position: rule.position,
        })),
      },
    },
  });
}

export class PrismaPolicyRepository implements PolicyRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async createPolicy(input: CreatePolicyInput): Promise<void> {
    if (input.initialRevision.revisionNumber !== 1) {
      throw new Error("an initial policy revision must use revision number 1");
    }

    await this.client.$transaction(async (tx) => {
      await tx.policy.create({
        data: {
          id: input.initialRevision.policyId,
          name: input.name,
          description: input.description,
          shop: { connect: { id: input.shopId } },
        },
      });

      await persistRevision(tx, input.initialRevision, {
        nameSnapshot: input.name,
        descriptionSnapshot: input.description,
        createdByActor: input.createdByActor,
        changeSummary: "Initial policy revision",
      });

      await tx.policy.update({
        where: { id: input.initialRevision.policyId },
        data: { activeRevisionId: input.initialRevision.id },
      });
    });
  }

  async appendRevision(input: AppendPolicyRevisionInput): Promise<void> {
    if (input.revision.policyId !== input.policyId) {
      throw new Error(
        "policy revision does not belong to the requested policy",
      );
    }

    await this.client.$transaction(async (tx) => {
      const policy = await tx.policy.findUnique({
        where: { id: input.policyId },
        select: { id: true },
      });

      if (!policy) {
        throw new Error(`policy not found: ${input.policyId}`);
      }

      const latest = await tx.policyRevision.findFirst({
        where: { policyId: input.policyId },
        orderBy: { revisionNumber: "desc" },
        select: { revisionNumber: true },
      });
      const expectedRevisionNumber = (latest?.revisionNumber ?? 0) + 1;

      if (input.revision.revisionNumber !== expectedRevisionNumber) {
        throw new Error(
          `policy revision must append revision ${expectedRevisionNumber}, received ${input.revision.revisionNumber}`,
        );
      }

      await persistRevision(tx, input.revision, input.snapshot);
    });
  }

  async activateRevision(policyId: string, revisionId: string): Promise<void> {
    await this.client.$transaction(async (tx) => {
      const revision = await tx.policyRevision.findFirst({
        where: { id: revisionId, policyId },
        select: { id: true },
      });

      if (!revision) {
        throw new Error(
          `policy revision ${revisionId} does not belong to policy ${policyId}`,
        );
      }

      await tx.policy.update({
        where: { id: policyId },
        data: { activeRevisionId: revisionId },
      });
    });
  }

  async loadRevisionInput(revisionId: string) {
    const revision = await this.client.policyRevision.findUnique({
      where: { id: revisionId },
      include: {
        rules: {
          orderBy: { position: "asc" },
        },
      },
    });

    if (!revision) return null;

    const snapshot: PersistedPolicyRevisionSnapshotV1 = {
      id: revision.id,
      policyId: revision.policyId,
      revisionNumber: revision.revisionNumber,
      schemaVersion: revision.schemaVersion,
      createdAt: revision.createdAt.toISOString(),
      rules: revision.rules.map((rule) => {
        if (rule.position === null) {
          throw new Error(
            `persisted policy rule ${rule.id} is missing deterministic position`,
          );
        }

        return {
          ruleCode: rule.ruleCode,
          ruleVersion: rule.ruleVersion,
          enabled: rule.enabled,
          severity: severityFromDatabase(rule.severity),
          blocking: rule.blocking,
          configJson: rule.configJson,
          scopeJson: rule.scopeJson,
          position: rule.position,
        };
      }),
    };

    return policyRevisionInputFromSnapshotV1(snapshot);
  }
}
