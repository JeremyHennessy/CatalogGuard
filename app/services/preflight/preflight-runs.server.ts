import prisma from "../../db.server";

const PREFLIGHT_RUN_LIMIT = 50;
const PREFLIGHT_TARGET_PREVIEW_LIMIT = 8;

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
        ...(row.completedAt ? { completedAt: row.completedAt.toISOString() } : {}),
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
