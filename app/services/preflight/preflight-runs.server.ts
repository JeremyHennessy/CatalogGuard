import type { PreflightRunEvidenceDetailV1 } from "../../application/preflight-evidence-export";
import prisma from "../../db.server";

const PREFLIGHT_RUN_LIMIT = 50;
const PREFLIGHT_TARGET_PREVIEW_LIMIT = 8;

export type PreflightPolicyChoiceV1 = Readonly<{
  id: string;
  name: string;
  activeRevisionId: string;
  activeRevisionNumber: number;
  activeRevisionCreatedAt: string;
}>;

export type PreflightRunListItemV1 = Readonly<{
  id: string;
  scanId: string;
  targetType: string;
  status: string;
  outcome?: string;
  targetDefinitionJson: string;
  sourceFreshnessAt?: string;
  blockingViolationCount: number;
  waiverCount: number;
  indeterminateBlockingCount: number;
  createdAt: string;
  completedAt?: string;
  policyRevision: Readonly<{
    id: string;
    revisionNumber: number;
    nameSnapshot: string;
  }>;
  targets: readonly Readonly<{
    resourceType: string;
    resourceGid: string;
    resourceFingerprint: string;
  }>[];
  targetCount: number;
  targetsTruncated: boolean;
}>;

export async function loadPreflightPolicyChoicesV1(shopId: string) {
  const rows = await prisma.policy.findMany({
    where: { shopId, status: "ACTIVE" },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      activeRevisionId: true,
      revisions: {
        orderBy: { revisionNumber: "desc" },
        select: {
          id: true,
          revisionNumber: true,
          createdAt: true,
        },
      },
    },
  });

  return Object.freeze(
    rows.flatMap((row) => {
      if (!row.activeRevisionId) return [];

      const activeRevision = row.revisions.find(
        (revision) => revision.id === row.activeRevisionId,
      );
      if (!activeRevision) {
        throw new Error(
          "active policy revision is missing from policy history",
        );
      }

      return [
        Object.freeze({
          id: row.id,
          name: row.name,
          activeRevisionId: row.activeRevisionId,
          activeRevisionNumber: activeRevision.revisionNumber,
          activeRevisionCreatedAt: activeRevision.createdAt.toISOString(),
        }) satisfies PreflightPolicyChoiceV1,
      ];
    }),
  );
}

export async function loadRecentPreflightRunsV1(shopId: string) {
  const rows = await prisma.preflightRun.findMany({
    where: { shopId },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: PREFLIGHT_RUN_LIMIT,
    select: {
      id: true,
      scanId: true,
      targetType: true,
      status: true,
      outcome: true,
      targetDefinitionJson: true,
      sourceFreshnessAt: true,
      blockingViolationCount: true,
      waiverCount: true,
      indeterminateBlockingCount: true,
      createdAt: true,
      completedAt: true,
      policyRevision: {
        select: {
          id: true,
          revisionNumber: true,
          nameSnapshot: true,
        },
      },
      targets: {
        orderBy: [{ resourceType: "asc" }, { resourceGid: "asc" }],
        take: PREFLIGHT_TARGET_PREVIEW_LIMIT,
        select: {
          resourceType: true,
          resourceGid: true,
          resourceFingerprint: true,
        },
      },
      _count: { select: { targets: true } },
    },
  });

  const items: readonly PreflightRunListItemV1[] = Object.freeze(
    rows.map((row) =>
      Object.freeze({
        id: row.id,
        scanId: row.scanId,
        targetType: row.targetType,
        status: row.status,
        ...(row.outcome ? { outcome: row.outcome } : {}),
        targetDefinitionJson: row.targetDefinitionJson,
        ...(row.sourceFreshnessAt
          ? { sourceFreshnessAt: row.sourceFreshnessAt.toISOString() }
          : {}),
        blockingViolationCount: row.blockingViolationCount,
        waiverCount: row.waiverCount,
        indeterminateBlockingCount: row.indeterminateBlockingCount,
        createdAt: row.createdAt.toISOString(),
        ...(row.completedAt
          ? { completedAt: row.completedAt.toISOString() }
          : {}),
        policyRevision: Object.freeze({
          id: row.policyRevision.id,
          revisionNumber: row.policyRevision.revisionNumber,
          nameSnapshot: row.policyRevision.nameSnapshot,
        }),
        targets: Object.freeze(
          row.targets.map((target) =>
            Object.freeze({
              resourceType: target.resourceType,
              resourceGid: target.resourceGid,
              resourceFingerprint: target.resourceFingerprint,
            }),
          ),
        ),
        targetCount: row._count.targets,
        targetsTruncated: row._count.targets > row.targets.length,
      }),
    ),
  );

  return Object.freeze({
    total: items.length,
    limit: PREFLIGHT_RUN_LIMIT,
    items,
  });
}

function optionalIso(value: Date | null) {
  return value ? value.toISOString() : undefined;
}

function optionalText(value: string | null) {
  return value ?? undefined;
}

export async function loadPreflightRunDetailV1(
  shopId: string,
  preflightRunId: string,
): Promise<PreflightRunEvidenceDetailV1 | null> {
  const row = await prisma.preflightRun.findFirst({
    where: { id: preflightRunId, shopId },
    select: {
      id: true,
      shopId: true,
      scanId: true,
      policyRevisionId: true,
      targetType: true,
      status: true,
      outcome: true,
      targetDefinitionJson: true,
      sourceFreshnessAt: true,
      blockingViolationCount: true,
      waiverCount: true,
      indeterminateBlockingCount: true,
      createdByActor: true,
      createdAt: true,
      completedAt: true,
      policyRevision: {
        select: {
          id: true,
          revisionNumber: true,
          nameSnapshot: true,
          descriptionSnapshot: true,
          schemaVersion: true,
          createdAt: true,
          createdByActor: true,
          changeSummary: true,
        },
      },
      scan: {
        select: {
          id: true,
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
          passCount: true,
          failCount: true,
          unknownCount: true,
          notApplicableCount: true,
          warningCount: true,
          errorSummary: true,
          metadataJson: true,
          evaluations: {
            orderBy: [
              { ruleCode: "asc" },
              { resourceGid: "asc" },
              { subresourceGid: "asc" },
              { id: "asc" },
            ],
            select: {
              id: true,
              scanId: true,
              policyRevisionId: true,
              policyRuleId: true,
              exceptionId: true,
              ruleCode: true,
              ruleVersion: true,
              resourceGid: true,
              subresourceGid: true,
              status: true,
              enforcement: true,
              observedJson: true,
              expectedJson: true,
              message: true,
              reasonCode: true,
              evidenceJson: true,
              evaluatedAt: true,
              policyRule: {
                select: {
                  id: true,
                  severity: true,
                  blocking: true,
                  configJson: true,
                  scopeJson: true,
                  merchantLabel: true,
                  merchantNotes: true,
                },
              },
              exception: {
                select: {
                  id: true,
                  reason: true,
                  createdAt: true,
                  expiresAt: true,
                  revokedAt: true,
                },
              },
            },
          },
        },
      },
      targets: {
        orderBy: [{ resourceType: "asc" }, { resourceGid: "asc" }],
        select: {
          resourceType: true,
          resourceGid: true,
          resourceFingerprint: true,
        },
      },
    },
  });

  if (!row) return null;

  if (
    row.scan.id !== row.scanId ||
    row.scan.shopId !== row.shopId ||
    row.scan.policyRevisionId !== row.policyRevisionId ||
    row.policyRevision.id !== row.policyRevisionId
  ) {
    throw new Error("preflight detail evidence has inconsistent identities");
  }

  const finishedAt = optionalIso(row.scan.finishedAt);
  const sourceWatermark = optionalText(row.scan.sourceWatermark);
  const errorSummary = optionalText(row.scan.errorSummary);
  const metadataJson = optionalText(row.scan.metadataJson);

  return Object.freeze({
    id: row.id,
    shopId: row.shopId,
    scanId: row.scanId,
    policyRevisionId: row.policyRevisionId,
    targetType: row.targetType,
    status: row.status,
    ...(row.outcome ? { outcome: row.outcome } : {}),
    targetDefinitionJson: row.targetDefinitionJson,
    ...(row.sourceFreshnessAt
      ? { sourceFreshnessAt: row.sourceFreshnessAt.toISOString() }
      : {}),
    blockingViolationCount: row.blockingViolationCount,
    waiverCount: row.waiverCount,
    indeterminateBlockingCount: row.indeterminateBlockingCount,
    ...(row.createdByActor ? { createdByActor: row.createdByActor } : {}),
    createdAt: row.createdAt.toISOString(),
    ...(row.completedAt ? { completedAt: row.completedAt.toISOString() } : {}),
    policyRevision: Object.freeze({
      id: row.policyRevision.id,
      revisionNumber: row.policyRevision.revisionNumber,
      nameSnapshot: row.policyRevision.nameSnapshot,
      ...(row.policyRevision.descriptionSnapshot
        ? { descriptionSnapshot: row.policyRevision.descriptionSnapshot }
        : {}),
      schemaVersion: row.policyRevision.schemaVersion,
      createdAt: row.policyRevision.createdAt.toISOString(),
      ...(row.policyRevision.createdByActor
        ? { createdByActor: row.policyRevision.createdByActor }
        : {}),
      ...(row.policyRevision.changeSummary
        ? { changeSummary: row.policyRevision.changeSummary }
        : {}),
    }),
    scan: Object.freeze({
      id: row.scan.id,
      shopId: row.scan.shopId,
      scanType: row.scan.scanType,
      status: row.scan.status,
      policyRevisionId: row.scan.policyRevisionId,
      apiVersion: row.scan.apiVersion,
      engineVersion: row.scan.engineVersion,
      normalizationVersion: row.scan.normalizationVersion,
      startedAt: row.scan.startedAt.toISOString(),
      ...(finishedAt ? { finishedAt } : {}),
      ...(sourceWatermark ? { sourceWatermark } : {}),
      ...(row.scan.productsExpected !== null
        ? { productsExpected: row.scan.productsExpected }
        : {}),
      productsProcessed: row.scan.productsProcessed,
      variantsProcessed: row.scan.variantsProcessed,
      passCount: row.scan.passCount,
      failCount: row.scan.failCount,
      unknownCount: row.scan.unknownCount,
      notApplicableCount: row.scan.notApplicableCount,
      warningCount: row.scan.warningCount,
      ...(errorSummary ? { errorSummary } : {}),
      ...(metadataJson ? { metadataJson } : {}),
    }),
    targets: Object.freeze(
      row.targets.map((target) =>
        Object.freeze({
          resourceType: target.resourceType,
          resourceGid: target.resourceGid,
          resourceFingerprint: target.resourceFingerprint,
        }),
      ),
    ),
    evaluations: Object.freeze(
      row.scan.evaluations.map((evaluation) =>
        Object.freeze({
          id: evaluation.id,
          scanId: evaluation.scanId,
          policyRevisionId: evaluation.policyRevisionId,
          policyRuleId: evaluation.policyRuleId,
          ...(evaluation.exceptionId
            ? { exceptionId: evaluation.exceptionId }
            : {}),
          ruleCode: evaluation.ruleCode,
          ruleVersion: evaluation.ruleVersion,
          resourceGid: evaluation.resourceGid,
          ...(evaluation.subresourceGid
            ? { subresourceGid: evaluation.subresourceGid }
            : {}),
          status: evaluation.status,
          enforcement: evaluation.enforcement,
          ...(evaluation.observedJson
            ? { observedJson: evaluation.observedJson }
            : {}),
          ...(evaluation.expectedJson
            ? { expectedJson: evaluation.expectedJson }
            : {}),
          message: evaluation.message,
          ...(evaluation.reasonCode
            ? { reasonCode: evaluation.reasonCode }
            : {}),
          ...(evaluation.evidenceJson
            ? { evidenceJson: evaluation.evidenceJson }
            : {}),
          evaluatedAt: evaluation.evaluatedAt.toISOString(),
          policyRule: Object.freeze({
            id: evaluation.policyRule.id,
            severity: evaluation.policyRule.severity,
            blocking: evaluation.policyRule.blocking,
            configJson: evaluation.policyRule.configJson,
            scopeJson: evaluation.policyRule.scopeJson,
            ...(evaluation.policyRule.merchantLabel
              ? { merchantLabel: evaluation.policyRule.merchantLabel }
              : {}),
            ...(evaluation.policyRule.merchantNotes
              ? { merchantNotes: evaluation.policyRule.merchantNotes }
              : {}),
          }),
          ...(evaluation.exception
            ? {
                exception: Object.freeze({
                  id: evaluation.exception.id,
                  reason: evaluation.exception.reason,
                  createdAt: evaluation.exception.createdAt.toISOString(),
                  ...(evaluation.exception.expiresAt
                    ? {
                        expiresAt: evaluation.exception.expiresAt.toISOString(),
                      }
                    : {}),
                  ...(evaluation.exception.revokedAt
                    ? {
                        revokedAt: evaluation.exception.revokedAt.toISOString(),
                      }
                    : {}),
                }),
              }
            : {}),
        }),
      ),
    ),
  });
}
