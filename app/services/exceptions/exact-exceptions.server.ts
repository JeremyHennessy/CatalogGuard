import prisma from "../../db.server";
import type { ExactRuleExceptionV1 } from "../../domain/policy/evaluator";

export async function loadExactRuleExceptionsForEvaluationV1(
  shopId: string,
): Promise<readonly ExactRuleExceptionV1[]> {
  const rows = await prisma.ruleException.findMany({
    where: {
      shopId,
      coverageType: "FINDING_EXACT",
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  return Object.freeze(
    rows.map((row) =>
      Object.freeze({
        id: row.id,
        shopId: row.shopId,
        coverageType: "FINDING_EXACT" as const,
        ruleCode: row.ruleCode,
        resourceGid: row.resourceGid,
        ...(row.subresourceGid
          ? { subresourceGid: row.subresourceGid }
          : {}),
        reason: row.reason,
        createdAt: row.createdAt.toISOString(),
        ...(row.expiresAt ? { expiresAt: row.expiresAt.toISOString() } : {}),
        ...(row.revokedAt ? { revokedAt: row.revokedAt.toISOString() } : {}),
      }),
    ),
  );
}
