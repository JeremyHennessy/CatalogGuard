import { randomUUID } from "node:crypto";
import prisma from "../../db.server";
import {
  createExactFindingWaiverV1,
  revokeExactFindingWaiverV1,
  type WaivableFindingV1,
} from "../../application/exact-exception-management";
import type { ExactRuleExceptionV1 } from "../../domain/policy/evaluator";

function mapException(row: {
  id: string;
  shopId: string;
  ruleCode: string;
  resourceGid: string;
  subresourceGid: string | null;
  reason: string;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
}): ExactRuleExceptionV1 {
  return Object.freeze({
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
}

async function loadWaivableFinding(shopId: string, findingId: string) {
  const row = await prisma.finding.findFirst({
    where: { id: findingId, shopId },
    select: {
      id: true,
      shopId: true,
      ruleCode: true,
      resourceGid: true,
      subresourceGid: true,
      currentStatus: true,
      latestEvaluation: { select: { status: true } },
    },
  });

  if (!row) return null;

  return Object.freeze({
    id: row.id,
    shopId: row.shopId,
    ruleCode: row.ruleCode,
    resourceGid: row.resourceGid,
    ...(row.subresourceGid ? { subresourceGid: row.subresourceGid } : {}),
    currentStatus: row.currentStatus,
    latestStatus: row.latestEvaluation.status,
  }) satisfies WaivableFindingV1;
}

async function loadExactExceptionsForFinding(
  shopId: string,
  finding: WaivableFindingV1,
) {
  const rows = await prisma.ruleException.findMany({
    where: {
      shopId,
      coverageType: "FINDING_EXACT",
      ruleCode: finding.ruleCode,
      resourceGid: finding.resourceGid,
      subresourceGid: finding.subresourceGid ?? null,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  return Object.freeze(rows.map(mapException));
}

export async function createExactFindingWaiverForShopV1(input: {
  shopId: string;
  findingId: string;
  reason: string;
  notes?: string;
  createdAt: string;
  expiresAt?: string;
  createdByActor?: string;
}) {
  return createExactFindingWaiverV1(input, {
    loadFinding: loadWaivableFinding,
    loadExactExceptions: loadExactExceptionsForFinding,
    nextId: () => `exception_${randomUUID()}`,
    persistCreate: async ({
      exception,
      findingId,
      notes,
      createdByActor,
    }) => {
      await prisma.$transaction(async (tx) => {
        await tx.ruleException.create({
          data: {
            id: exception.id,
            shopId: exception.shopId,
            findingId,
            ruleCode: exception.ruleCode,
            resourceGid: exception.resourceGid,
            subresourceGid: exception.subresourceGid,
            coverageType: exception.coverageType,
            reason: exception.reason,
            notes,
            createdByActor,
            createdAt: new Date(exception.createdAt),
            expiresAt: exception.expiresAt
              ? new Date(exception.expiresAt)
              : null,
          },
        });
        await tx.findingEvent.create({
          data: {
            id: `finding-event_${randomUUID()}`,
            findingId,
            eventType: "EXCEPTION_CREATED",
            exceptionId: exception.id,
            createdAt: new Date(exception.createdAt),
          },
        });
      });
    },
  });
}

export async function revokeExactFindingWaiverForShopV1(input: {
  shopId: string;
  exceptionId: string;
  revokedAt: string;
  revokedByActor?: string;
  revocationReason: string;
}) {
  return revokeExactFindingWaiverV1(input, {
    loadException: async (shopId, exceptionId) => {
      const row = await prisma.ruleException.findFirst({
        where: { id: exceptionId, shopId },
        select: {
          id: true,
          shopId: true,
          findingId: true,
          ruleCode: true,
          resourceGid: true,
          subresourceGid: true,
          reason: true,
          createdAt: true,
          expiresAt: true,
          revokedAt: true,
        },
      });
      if (!row) return null;

      return Object.freeze({
        ...mapException(row),
        ...(row.findingId ? { findingId: row.findingId } : {}),
      });
    },
    persistRevoke: async ({
      shopId,
      exceptionId,
      revokedAt,
      revokedByActor,
      revocationReason,
      findingId,
    }) => {
      await prisma.$transaction(async (tx) => {
        const result = await tx.ruleException.updateMany({
          where: { id: exceptionId, shopId, revokedAt: null },
          data: {
            revokedAt: new Date(revokedAt),
            revokedByActor,
            revocationReason,
          },
        });
        if (result.count !== 1) {
          throw new Error("waiver changed before revocation could be persisted");
        }

        if (findingId) {
          await tx.findingEvent.create({
            data: {
              id: `finding-event_${randomUUID()}`,
              findingId,
              eventType: "EXCEPTION_REVOKED",
              exceptionId,
              createdAt: new Date(revokedAt),
            },
          });
        }
      });
    },
  });
}
