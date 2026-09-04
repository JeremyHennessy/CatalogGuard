import type { Prisma } from "@prisma/client";
import prisma from "../../db.server";
import { currentEnforcementForRuleStatusV1 } from "../../domain/policy/evaluator";
import type { RuleStatus } from "../../domain/rules/contracts";

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

function ruleStatus(value: string): RuleStatus {
  if (
    value === "PASS" ||
    value === "FAIL" ||
    value === "NOT_APPLICABLE" ||
    value === "UNKNOWN"
  ) {
    return value;
  }

  throw new Error(`unsupported persisted rule status: ${value}`);
}

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

function activeExactExceptionWhere(
  observedAt: Date,
): Prisma.RuleExceptionWhereInput {
  return {
    coverageType: "FINDING_EXACT",
    createdAt: { lte: observedAt },
    revokedAt: null,
    OR: [{ expiresAt: null }, { expiresAt: { gt: observedAt } }],
  };
}

export async function loadCatalogGuardOverviewV1(
  shopId: string,
  observedAt = new Date(),
) {
  const activeExceptionWhere = activeExactExceptionWhere(observedAt);
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
            status: "FAIL",
            policyRule: { is: { blocking: true } },
          },
        },
        exceptions: { none: activeExceptionWhere },
      },
    }),
    prisma.finding.count({
      where: {
        shopId,
        currentStatus: "OPEN",
        latestEvaluation: {
          is: {
            status: "UNKNOWN",
            policyRule: { is: { blocking: true } },
          },
        },
      },
    }),
    prisma.finding.count({
      where: {
        shopId,
        currentStatus: "OPEN",
        latestEvaluation: { is: { status: "FAIL" } },
        exceptions: { some: activeExceptionWhere },
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
            status: true,
            message: true,
            reasonCode: true,
            policyRule: { select: { severity: true, blocking: true } },
          },
        },
        exceptions: {
          where: activeExceptionWhere,
          take: 1,
          select: { id: true },
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
        enforcement: currentEnforcementForRuleStatusV1(
          ruleStatus(row.latestEvaluation.status),
          row.exceptions.length > 0,
        ),
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
