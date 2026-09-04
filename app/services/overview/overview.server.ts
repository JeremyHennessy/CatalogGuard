import prisma from "../../db.server";

export type OverviewScanSummaryV1 = Readonly<{
  id: string;
  scanType: string;
  startedAt: string;
  finishedAt?: string;
  productsProcessed: number;
  variantsProcessed: number;
  passCount: number;
  failCount: number;
  unknownCount: number;
  notApplicableCount: number;
  warningCount: number;
}>;

export type OverviewFindingV1 = Readonly<{
  id: string;
  ruleCode: string;
  resourceGid: string;
  subresourceGid?: string;
  classification: string;
  firstSeenAt: string;
  lastSeenAt: string;
  enforcement: string;
  severity: string;
  blocking: boolean;
  message: string;
  reasonCode?: string;
}>;

function scanSummary(row: {
  id: string;
  scanType: string;
  startedAt: Date;
  finishedAt: Date | null;
  productsProcessed: number;
  variantsProcessed: number;
  passCount: number;
  failCount: number;
  unknownCount: number;
  notApplicableCount: number;
  warningCount: number;
}): OverviewScanSummaryV1 {
  return Object.freeze({
    id: row.id,
    scanType: row.scanType,
    startedAt: row.startedAt.toISOString(),
    ...(row.finishedAt ? { finishedAt: row.finishedAt.toISOString() } : {}),
    productsProcessed: row.productsProcessed,
    variantsProcessed: row.variantsProcessed,
    passCount: row.passCount,
    failCount: row.failCount,
    unknownCount: row.unknownCount,
    notApplicableCount: row.notApplicableCount,
    warningCount: row.warningCount,
  });
}

const scanSelect = {
  id: true,
  scanType: true,
  startedAt: true,
  finishedAt: true,
  productsProcessed: true,
  variantsProcessed: true,
  passCount: true,
  failCount: true,
  unknownCount: true,
  notApplicableCount: true,
  warningCount: true,
} as const;

export async function loadCatalogGuardOverviewV1(shopId: string) {
  const [
    baselineRow,
    latestCompleteRow,
    openCount,
    baselineDebtCount,
    regressionCount,
    blockingViolationCount,
    blockingIndeterminateCount,
    waivedCount,
    findingRows,
  ] = await Promise.all([
    prisma.scan.findFirst({
      where: { shopId, scanType: "BASELINE", status: "COMPLETE" },
      orderBy: { startedAt: "desc" },
      select: scanSelect,
    }),
    prisma.scan.findFirst({
      where: { shopId, status: "COMPLETE" },
      orderBy: { startedAt: "desc" },
      select: scanSelect,
    }),
    prisma.finding.count({ where: { shopId, currentStatus: "OPEN" } }),
    prisma.finding.count({
      where: {
        shopId,
        currentStatus: "OPEN",
        classification: "BASELINE_DEBT",
      },
    }),
    prisma.finding.count({
      where: {
        shopId,
        currentStatus: "OPEN",
        classification: { in: ["NEW_REGRESSION", "REOPENED_REGRESSION"] },
      },
    }),
    prisma.finding.count({
      where: {
        shopId,
        currentStatus: "OPEN",
        latestEvaluation: {
          is: {
            enforcement: "VIOLATION",
            policyRule: { is: { blocking: true } },
          },
        },
      },
    }),
    prisma.finding.count({
      where: {
        shopId,
        currentStatus: "OPEN",
        latestEvaluation: {
          is: {
            enforcement: "INDETERMINATE",
            policyRule: { is: { blocking: true } },
          },
        },
      },
    }),
    prisma.finding.count({
      where: {
        shopId,
        currentStatus: "OPEN",
        latestEvaluation: { is: { enforcement: "WAIVED" } },
      },
    }),
    prisma.finding.findMany({
      where: { shopId, currentStatus: "OPEN" },
      orderBy: { lastSeenAt: "desc" },
      take: 10,
      select: {
        id: true,
        ruleCode: true,
        resourceGid: true,
        subresourceGid: true,
        classification: true,
        firstSeenAt: true,
        lastSeenAt: true,
        latestEvaluation: {
          select: {
            enforcement: true,
            message: true,
            reasonCode: true,
            policyRule: { select: { severity: true, blocking: true } },
          },
        },
      },
    }),
  ]);

  const findings: readonly OverviewFindingV1[] = Object.freeze(
    findingRows.map((row) =>
      Object.freeze({
        id: row.id,
        ruleCode: row.ruleCode,
        resourceGid: row.resourceGid,
        ...(row.subresourceGid ? { subresourceGid: row.subresourceGid } : {}),
        classification: row.classification,
        firstSeenAt: row.firstSeenAt.toISOString(),
        lastSeenAt: row.lastSeenAt.toISOString(),
        enforcement: row.latestEvaluation.enforcement,
        severity: row.latestEvaluation.policyRule.severity,
        blocking: row.latestEvaluation.policyRule.blocking,
        message: row.latestEvaluation.message,
        ...(row.latestEvaluation.reasonCode
          ? { reasonCode: row.latestEvaluation.reasonCode }
          : {}),
      }),
    ),
  );

  return Object.freeze({
    baseline: baselineRow ? scanSummary(baselineRow) : null,
    latestComplete: latestCompleteRow ? scanSummary(latestCompleteRow) : null,
    counts: Object.freeze({
      open: openCount,
      baselineDebt: baselineDebtCount,
      regressions: regressionCount,
      blockingViolations: blockingViolationCount,
      blockingIndeterminate: blockingIndeterminateCount,
      waived: waivedCount,
    }),
    findings,
  });
}
