import prisma from "../../db.server";
import {
  currentEnforcementForRuleStatusV1,
  isExceptionActiveAt,
  type ExactRuleExceptionV1,
} from "../../domain/policy/evaluator";
import type { RuleStatus } from "../../domain/rules/contracts";

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

export async function loadFindingExceptionStateV1(
  shopId: string,
  findingId: string,
  observedAt = new Date(),
) {
  const finding = await prisma.finding.findFirst({
    where: { id: findingId, shopId },
    select: {
      id: true,
      latestEvaluation: {
        select: { status: true, enforcement: true },
      },
      exceptions: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          shopId: true,
          coverageType: true,
          ruleCode: true,
          resourceGid: true,
          subresourceGid: true,
          reason: true,
          notes: true,
          createdByActor: true,
          createdAt: true,
          expiresAt: true,
          revokedAt: true,
          revokedByActor: true,
          revocationReason: true,
        },
      },
    },
  });

  if (!finding) return null;

  const history = Object.freeze(
    finding.exceptions.map((row) => {
      const exception: ExactRuleExceptionV1 = Object.freeze({
        id: row.id,
        shopId: row.shopId,
        coverageType: "FINDING_EXACT" as const,
        ruleCode: row.ruleCode,
        resourceGid: row.resourceGid,
        ...(row.subresourceGid ? { subresourceGid: row.subresourceGid } : {}),
        reason: row.reason,
        createdAt: row.createdAt.toISOString(),
        ...(row.expiresAt ? { expiresAt: row.expiresAt.toISOString() } : {}),
        ...(row.revokedAt ? { revokedAt: row.revokedAt.toISOString() } : {}),
      });
      const active =
        row.coverageType === "FINDING_EXACT" &&
        isExceptionActiveAt(exception, observedAt);

      return Object.freeze({
        ...exception,
        active,
        ...(row.notes ? { notes: row.notes } : {}),
        ...(row.createdByActor ? { createdByActor: row.createdByActor } : {}),
        ...(row.revokedByActor ? { revokedByActor: row.revokedByActor } : {}),
        ...(row.revocationReason
          ? { revocationReason: row.revocationReason }
          : {}),
      });
    }),
  );
  const active = history.find((exception) => exception.active) ?? null;
  const technicalStatus = ruleStatus(finding.latestEvaluation.status);
  const effectiveEnforcement = currentEnforcementForRuleStatusV1(
    technicalStatus,
    Boolean(active),
  );

  return Object.freeze({
    latestTechnicalStatus: technicalStatus,
    persistedEvaluationEnforcement: finding.latestEvaluation.enforcement,
    effectiveEnforcement,
    active,
    history,
  });
}
