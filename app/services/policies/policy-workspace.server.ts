import prisma from "../../db.server";
import {
  saveMerchantPolicyRevisionV1,
  type SaveMerchantPolicyRevisionInputV1,
} from "../../application/save-policy-revision";
import type { RuleSeverity } from "../../domain/rules/contracts";
import { PrismaPolicyRepository } from "../../persistence/prisma-policy-repository.server";

export type PolicyRuleWorkspaceItemV1 = Readonly<{
  ruleCode: string;
  ruleVersion: number;
  enabled: boolean;
  severity: RuleSeverity;
  blocking: boolean;
  configJson: string;
  scopeJson: string;
  position: number;
}>;

function severity(value: string): RuleSeverity {
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

export async function loadPoliciesForShopV1(shopId: string) {
  const rows = await prisma.policy.findMany({
    where: { shopId },
    orderBy: [{ status: "asc" }, { name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      activeRevisionId: true,
      revisions: {
        orderBy: { revisionNumber: "desc" },
        take: 1,
        select: {
          id: true,
          revisionNumber: true,
          createdAt: true,
        },
      },
      _count: { select: { revisions: true } },
    },
  });

  return Object.freeze(
    rows.map((row) => {
      const latest = row.revisions[0];
      return Object.freeze({
        id: row.id,
        name: row.name,
        ...(row.description ? { description: row.description } : {}),
        status: row.status,
        ...(row.activeRevisionId
          ? { activeRevisionId: row.activeRevisionId }
          : {}),
        revisionCount: row._count.revisions,
        ...(latest
          ? {
              latestRevision: Object.freeze({
                id: latest.id,
                revisionNumber: latest.revisionNumber,
                createdAt: latest.createdAt.toISOString(),
              }),
            }
          : {}),
      });
    }),
  );
}

export async function loadPolicyWorkspaceForShopV1(
  shopId: string,
  policyId: string,
) {
  const row = await prisma.policy.findFirst({
    where: { id: policyId, shopId },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      activeRevisionId: true,
      revisions: {
        orderBy: { revisionNumber: "desc" },
        select: {
          id: true,
          revisionNumber: true,
          nameSnapshot: true,
          descriptionSnapshot: true,
          createdAt: true,
          createdByActor: true,
          changeSummary: true,
          rules: {
            orderBy: { position: "asc" },
            select: {
              ruleCode: true,
              ruleVersion: true,
              enabled: true,
              severity: true,
              blocking: true,
              configJson: true,
              scopeJson: true,
              position: true,
            },
          },
        },
      },
    },
  });

  if (!row) return null;
  const active = row.revisions.find(
    (revision) => revision.id === row.activeRevisionId,
  );
  if (row.activeRevisionId && !active) {
    throw new Error("active policy revision is missing from policy history");
  }

  const mapRules = (
    rules: (typeof row.revisions)[number]["rules"],
  ): readonly PolicyRuleWorkspaceItemV1[] =>
    Object.freeze(
      rules.map((rule) => {
        if (rule.position === null) {
          throw new Error(
            `persisted policy rule ${rule.ruleCode} is missing position`,
          );
        }
        return Object.freeze({
          ruleCode: rule.ruleCode,
          ruleVersion: rule.ruleVersion,
          enabled: rule.enabled,
          severity: severity(rule.severity),
          blocking: rule.blocking,
          configJson: rule.configJson,
          scopeJson: rule.scopeJson,
          position: rule.position,
        }) satisfies PolicyRuleWorkspaceItemV1;
      }),
    );

  return Object.freeze({
    id: row.id,
    name: row.name,
    ...(row.description ? { description: row.description } : {}),
    status: row.status,
    ...(row.activeRevisionId ? { activeRevisionId: row.activeRevisionId } : {}),
    ...(active
      ? {
          activeRevision: Object.freeze({
            id: active.id,
            revisionNumber: active.revisionNumber,
            createdAt: active.createdAt.toISOString(),
            rules: mapRules(active.rules),
          }),
        }
      : {}),
    revisions: Object.freeze(
      row.revisions.map((revision) =>
        Object.freeze({
          id: revision.id,
          revisionNumber: revision.revisionNumber,
          nameSnapshot: revision.nameSnapshot,
          ...(revision.descriptionSnapshot
            ? { descriptionSnapshot: revision.descriptionSnapshot }
            : {}),
          createdAt: revision.createdAt.toISOString(),
          ...(revision.createdByActor
            ? { createdByActor: revision.createdByActor }
            : {}),
          ...(revision.changeSummary
            ? { changeSummary: revision.changeSummary }
            : {}),
          rules: mapRules(revision.rules),
        }),
      ),
    ),
  });
}

export async function savePolicyRevisionForShopV1(
  input: SaveMerchantPolicyRevisionInputV1,
) {
  const repository = new PrismaPolicyRepository();

  return saveMerchantPolicyRevisionV1(input, {
    loadActivePolicy: async (shopId, policyId) => {
      const policy = await prisma.policy.findFirst({
        where: { id: policyId, shopId },
        select: {
          id: true,
          shopId: true,
          name: true,
          description: true,
          activeRevisionId: true,
        },
      });
      if (!policy?.activeRevisionId) return null;

      const activeRevision = await repository.loadRevisionInput(
        policy.activeRevisionId,
      );
      if (!activeRevision) {
        throw new Error("active policy revision could not be loaded");
      }

      return Object.freeze({
        shopId: policy.shopId,
        policyId: policy.id,
        name: policy.name,
        ...(policy.description ? { description: policy.description } : {}),
        activeRevisionId: policy.activeRevisionId,
        activeRevision,
      });
    },
    appendAndActivate: (write) => repository.appendAndActivateRevision(write),
  });
}
