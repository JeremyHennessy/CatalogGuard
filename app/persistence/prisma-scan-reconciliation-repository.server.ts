import type { Prisma, PrismaClient } from "@prisma/client";
import prisma from "../db.server";
import {
  buildScanPersistencePlanV1,
  scanInputFingerprintV1,
} from "../application/scan-reconciliation";
import {
  findingKeyFor,
  type FindingClassification,
  type FindingStateV1,
  type FindingStatus,
} from "../domain/findings/lifecycle";
import { canonicalJsonStringify, parseCanonicalJson } from "./json";
import type {
  PersistPolicyScanInputV1,
  PersistPolicyScanResultV1,
  ScanReconciliationRepository,
} from "./scan-reconciliation-repository";

function dateFromIso(value: string, field: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error(`${field} must be an ISO date-time`);
  }
  return date;
}

function findingStatusFromDatabase(value: string): FindingStatus {
  if (value === "OPEN" || value === "RESOLVED") return value;
  throw new Error(`unsupported persisted finding status: ${value}`);
}

function findingClassificationFromDatabase(
  value: string,
): FindingClassification {
  if (
    value === "BASELINE_DEBT" ||
    value === "NEW_REGRESSION" ||
    value === "REOPENED_REGRESSION" ||
    value === "POLICY_CHANGE_FAILURE" ||
    value === "UNKNOWN_CAUSE"
  ) {
    return value;
  }

  throw new Error(`unsupported persisted finding classification: ${value}`);
}

function optionalCanonicalJson(value: unknown) {
  return value === undefined ? null : canonicalJsonStringify(value);
}

function metadataFingerprint(value: string | null) {
  if (!value) return null;
  const parsed = parseCanonicalJson(value);

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed) ||
    typeof (parsed as Record<string, unknown>).inputFingerprint !== "string"
  ) {
    throw new Error("persisted scan metadata is missing inputFingerprint");
  }

  return (parsed as Record<string, unknown>).inputFingerprint as string;
}

function previousFinding(row: {
  findingKey: string;
  shopId: string;
  ruleCode: string;
  resourceGid: string;
  subresourceGid: string | null;
  currentStatus: string;
  classification: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  resolvedAt: Date | null;
  reopenedCount: number;
}): FindingStateV1 {
  return Object.freeze({
    findingKey: row.findingKey,
    shopId: row.shopId,
    ruleCode: row.ruleCode,
    resourceGid: row.resourceGid,
    ...(row.subresourceGid ? { subresourceGid: row.subresourceGid } : {}),
    currentStatus: findingStatusFromDatabase(row.currentStatus),
    classification: findingClassificationFromDatabase(row.classification),
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    ...(row.resolvedAt ? { resolvedAt: row.resolvedAt.toISOString() } : {}),
    reopenedCount: row.reopenedCount,
  });
}

function policyRuleKey(ruleCode: string, ruleVersion: number) {
  return `${ruleCode}@${ruleVersion}`;
}

function touchedFindingKeys(input: PersistPolicyScanInputV1) {
  return [
    ...new Set(
      input.evaluations.map((evaluation) =>
        findingKeyFor({
          shopId: input.scan.shopId,
          ruleCode: evaluation.result.ruleCode,
          resourceGid: evaluation.result.resourceGid,
          ...(evaluation.result.subresourceGid
            ? { subresourceGid: evaluation.result.subresourceGid }
            : {}),
        }),
      ),
    ),
  ];
}

async function validatePersistedException(
  tx: Prisma.TransactionClient,
  input: PersistPolicyScanInputV1,
  exceptionId: string,
  evaluation: PersistPolicyScanInputV1["evaluations"][number],
) {
  const exception = await tx.ruleException.findUnique({
    where: { id: exceptionId },
    select: {
      id: true,
      shopId: true,
      ruleCode: true,
      resourceGid: true,
      subresourceGid: true,
    },
  });

  if (!exception) {
    throw new Error(`persisted exception not found: ${exceptionId}`);
  }

  if (
    exception.shopId !== input.scan.shopId ||
    exception.ruleCode !== evaluation.ruleCode ||
    exception.resourceGid !== evaluation.result.resourceGid ||
    (exception.subresourceGid ?? undefined) !==
      evaluation.result.subresourceGid
  ) {
    throw new Error(
      `persisted exception ${exceptionId} does not exactly match evaluation evidence`,
    );
  }
}

export class PrismaScanReconciliationRepository
  implements ScanReconciliationRepository
{
  constructor(private readonly client: PrismaClient = prisma) {}

  async persistPolicyScan(
    input: PersistPolicyScanInputV1,
  ): Promise<PersistPolicyScanResultV1> {
    const expectedFingerprint = scanInputFingerprintV1(input);

    return this.client.$transaction(async (tx) => {
      const existingScan = await tx.scan.findUnique({
        where: { id: input.scan.id },
        select: {
          id: true,
          shopId: true,
          policyRevisionId: true,
          status: true,
          metadataJson: true,
        },
      });

      if (existingScan) {
        if (
          existingScan.shopId !== input.scan.shopId ||
          existingScan.policyRevisionId !== input.scan.policyRevisionId ||
          metadataFingerprint(existingScan.metadataJson) !== expectedFingerprint
        ) {
          throw new Error(
            `scan id ${input.scan.id} already exists with different immutable input`,
          );
        }

        if (existingScan.status !== "COMPLETE") {
          throw new Error(
            `scan id ${input.scan.id} exists but is not complete; manual recovery is required`,
          );
        }

        return Object.freeze({
          status: "ALREADY_PERSISTED" as const,
          scanId: input.scan.id,
          inputFingerprint: expectedFingerprint,
          evaluationCount: input.evaluations.length,
          findingCount: 0,
          findingEventCount: 0,
        });
      }

      const previousRows = await tx.finding.findMany({
        where: {
          shopId: input.scan.shopId,
          findingKey: { in: touchedFindingKeys(input) },
        },
      });
      const plan = buildScanPersistencePlanV1({
        ...input,
        previousFindings: previousRows.map(previousFinding),
      });
      const policyRules = await tx.policyRule.findMany({
        where: { policyRevisionId: input.scan.policyRevisionId },
        select: { id: true, ruleCode: true, ruleVersion: true },
      });
      const policyRuleIdByKey = new Map(
        policyRules.map((rule) => [
          policyRuleKey(rule.ruleCode, rule.ruleVersion),
          rule.id,
        ]),
      );

      for (const planned of plan.evaluations) {
        const ruleId = policyRuleIdByKey.get(
          policyRuleKey(
            planned.evaluation.ruleCode,
            planned.evaluation.ruleVersion,
          ),
        );
        if (!ruleId) {
          throw new Error(
            `policy revision ${input.scan.policyRevisionId} does not contain ${planned.evaluation.ruleCode}@${planned.evaluation.ruleVersion}`,
          );
        }

        if (planned.evaluation.exceptionId) {
          await validatePersistedException(
            tx,
            input,
            planned.evaluation.exceptionId,
            planned.evaluation,
          );
        }
      }

      await tx.scan.create({
        data: {
          id: input.scan.id,
          scanType: input.scan.scanType,
          status: "RUNNING",
          apiVersion: input.scan.apiVersion,
          engineVersion: input.scan.engineVersion,
          normalizationVersion: input.scan.normalizationVersion,
          startedAt: dateFromIso(input.scan.startedAt, "scan startedAt"),
          sourceWatermark: input.scan.sourceWatermark,
          productsExpected: input.scan.productsExpected,
          productsProcessed: input.scan.productsProcessed,
          variantsProcessed: input.scan.variantsProcessed,
          metadataJson: canonicalJsonStringify({
            inputFingerprint: plan.inputFingerprint,
          }),
          shop: { connect: { id: input.scan.shopId } },
          policyRevision: { connect: { id: input.scan.policyRevisionId } },
        },
      });

      for (const planned of plan.evaluations) {
        const evaluation = planned.evaluation;
        const policyRuleId = policyRuleIdByKey.get(
          policyRuleKey(evaluation.ruleCode, evaluation.ruleVersion),
        );
        if (!policyRuleId) {
          throw new Error("policy rule disappeared during transaction");
        }

        await tx.evaluation.create({
          data: {
            id: planned.id,
            ruleCode: evaluation.ruleCode,
            ruleVersion: evaluation.ruleVersion,
            resourceGid: evaluation.result.resourceGid,
            subresourceGid: evaluation.result.subresourceGid,
            status: evaluation.result.status,
            enforcement: evaluation.enforcement,
            observedJson: optionalCanonicalJson(evaluation.result.observed),
            expectedJson: optionalCanonicalJson(evaluation.result.expected),
            message: evaluation.result.message,
            reasonCode: evaluation.result.reasonCode,
            evidenceJson: optionalCanonicalJson(evaluation.result.evidence),
            evaluatedAt: dateFromIso(evaluation.evaluatedAt, "evaluation evaluatedAt"),
            scan: { connect: { id: input.scan.id } },
            policyRevision: {
              connect: { id: input.scan.policyRevisionId },
            },
            policyRule: { connect: { id: policyRuleId } },
            ...(evaluation.exceptionId
              ? { exception: { connect: { id: evaluation.exceptionId } } }
              : {}),
          },
        });
      }

      const existingByKey = new Map(
        previousRows.map((row) => [row.findingKey, row]),
      );
      const plannedFindingByKey = new Map(
        plan.findings.map((finding) => [finding.state.findingKey, finding]),
      );

      for (const planned of plan.findings) {
        const existing = existingByKey.get(planned.state.findingKey);
        const state = planned.state;

        if (existing) {
          if (existing.id !== planned.id) {
            throw new Error(
              `persisted finding ${state.findingKey} has non-deterministic identity`,
            );
          }

          await tx.finding.update({
            where: { id: existing.id },
            data: {
              currentStatus: state.currentStatus,
              classification: state.classification,
              firstSeenAt: dateFromIso(state.firstSeenAt, "finding firstSeenAt"),
              lastSeenAt: dateFromIso(state.lastSeenAt, "finding lastSeenAt"),
              resolvedAt: state.resolvedAt
                ? dateFromIso(state.resolvedAt, "finding resolvedAt")
                : null,
              reopenedCount: state.reopenedCount,
              latestEvaluation: {
                connect: { id: planned.latestEvaluationId },
              },
            },
          });
        } else {
          await tx.finding.create({
            data: {
              id: planned.id,
              findingKey: state.findingKey,
              ruleCode: state.ruleCode,
              resourceType: planned.resourceType,
              resourceGid: state.resourceGid,
              subresourceGid: state.subresourceGid,
              currentStatus: state.currentStatus,
              classification: state.classification,
              firstSeenAt: dateFromIso(state.firstSeenAt, "finding firstSeenAt"),
              lastSeenAt: dateFromIso(state.lastSeenAt, "finding lastSeenAt"),
              resolvedAt: state.resolvedAt
                ? dateFromIso(state.resolvedAt, "finding resolvedAt")
                : null,
              reopenedCount: state.reopenedCount,
              shop: { connect: { id: input.scan.shopId } },
              latestEvaluation: {
                connect: { id: planned.latestEvaluationId },
              },
            },
          });
        }
      }

      for (const event of plan.findingEvents) {
        await tx.findingEvent.create({
          data: {
            id: event.id,
            eventType: event.eventType,
            createdAt: dateFromIso(event.occurredAt, "finding event occurredAt"),
            metadataJson: canonicalJsonStringify({
              policyRevisionId: event.policyRevisionId,
            }),
            finding: { connect: { id: event.findingId } },
            scan: { connect: { id: input.scan.id } },
            evaluation: { connect: { id: event.evaluationId } },
            ...(event.exceptionId
              ? { exception: { connect: { id: event.exceptionId } } }
              : {}),
          },
        });
      }

      for (const planned of plan.evaluations) {
        const exceptionId = planned.evaluation.exceptionId;
        const finding = plannedFindingByKey.get(planned.findingKey);
        if (!exceptionId || !finding) continue;

        const exception = await tx.ruleException.findUnique({
          where: { id: exceptionId },
          select: { findingId: true },
        });

        if (exception?.findingId && exception.findingId !== finding.id) {
          throw new Error(
            `exception ${exceptionId} is already linked to a different finding`,
          );
        }

        if (!exception?.findingId) {
          await tx.ruleException.update({
            where: { id: exceptionId },
            data: { finding: { connect: { id: finding.id } } },
          });
        }
      }

      await tx.scan.update({
        where: { id: input.scan.id },
        data: {
          status: "COMPLETE",
          finishedAt: dateFromIso(input.scan.finishedAt, "scan finishedAt"),
          passCount: plan.counts.passCount,
          failCount: plan.counts.failCount,
          unknownCount: plan.counts.unknownCount,
          notApplicableCount: plan.counts.notApplicableCount,
          warningCount: plan.counts.warningCount,
          metadataJson: canonicalJsonStringify({
            inputFingerprint: plan.inputFingerprint,
            findingCount: plan.findings.length,
            findingEventCount: plan.findingEvents.length,
          }),
        },
      });

      return Object.freeze({
        status: "PERSISTED" as const,
        scanId: input.scan.id,
        inputFingerprint: plan.inputFingerprint,
        evaluationCount: plan.evaluations.length,
        findingCount: plan.findings.length,
        findingEventCount: plan.findingEvents.length,
      });
    });
  }
}
