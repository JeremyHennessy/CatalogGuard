import prisma from "../../db.server";

const FINDINGS_PAGE_LIMIT = 250;

export type FindingListItemV1 = Readonly<{
  id: string;
  ruleCode: string;
  resourceType: string;
  resourceGid: string;
  subresourceGid?: string;
  classification: string;
  currentStatus: string;
  firstSeenAt: string;
  lastSeenAt: string;
  reopenedCount: number;
  evaluation: Readonly<{
    status: string;
    enforcement: string;
    message: string;
    reasonCode?: string;
    evaluatedAt: string;
    severity: string;
    blocking: boolean;
  }>;
}>;

export type FindingHistoryEventV1 = Readonly<{
  id: string;
  eventType: string;
  createdAt: string;
  scanId?: string;
  evaluationId?: string;
  exceptionId?: string;
  metadataJson?: string;
  evaluation?: Readonly<{
    status: string;
    enforcement: string;
    message: string;
    reasonCode?: string;
    evaluatedAt: string;
  }>;
  exception?: Readonly<{
    reason: string;
    createdAt: string;
    expiresAt?: string;
    revokedAt?: string;
  }>;
}>;

export type FindingDetailV1 = FindingListItemV1 &
  Readonly<{
    findingKey: string;
    fieldKey?: string;
    resolvedAt?: string;
    latestEvaluation: Readonly<{
      id: string;
      scanId: string;
      policyRevisionId: string;
      ruleVersion: number;
      status: string;
      enforcement: string;
      observedJson?: string;
      expectedJson?: string;
      evidenceJson?: string;
      message: string;
      reasonCode?: string;
      evaluatedAt: string;
      severity: string;
      blocking: boolean;
      merchantLabel?: string;
      merchantNotes?: string;
      exceptionId?: string;
    }>;
    history: readonly FindingHistoryEventV1[];
  }>;

const findingListSelect = {
  id: true,
  ruleCode: true,
  resourceType: true,
  resourceGid: true,
  subresourceGid: true,
  classification: true,
  currentStatus: true,
  firstSeenAt: true,
  lastSeenAt: true,
  reopenedCount: true,
  latestEvaluation: {
    select: {
      status: true,
      enforcement: true,
      message: true,
      reasonCode: true,
      evaluatedAt: true,
      policyRule: { select: { severity: true, blocking: true } },
    },
  },
} as const;

function mapListItem(row: {
  id: string;
  ruleCode: string;
  resourceType: string;
  resourceGid: string;
  subresourceGid: string | null;
  classification: string;
  currentStatus: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  reopenedCount: number;
  latestEvaluation: {
    status: string;
    enforcement: string;
    message: string;
    reasonCode: string | null;
    evaluatedAt: Date;
    policyRule: { severity: string; blocking: boolean };
  };
}): FindingListItemV1 {
  return Object.freeze({
    id: row.id,
    ruleCode: row.ruleCode,
    resourceType: row.resourceType,
    resourceGid: row.resourceGid,
    ...(row.subresourceGid ? { subresourceGid: row.subresourceGid } : {}),
    classification: row.classification,
    currentStatus: row.currentStatus,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    reopenedCount: row.reopenedCount,
    evaluation: Object.freeze({
      status: row.latestEvaluation.status,
      enforcement: row.latestEvaluation.enforcement,
      message: row.latestEvaluation.message,
      ...(row.latestEvaluation.reasonCode
        ? { reasonCode: row.latestEvaluation.reasonCode }
        : {}),
      evaluatedAt: row.latestEvaluation.evaluatedAt.toISOString(),
      severity: row.latestEvaluation.policyRule.severity,
      blocking: row.latestEvaluation.policyRule.blocking,
    }),
  });
}

export async function loadOpenFindingsV1(shopId: string) {
  const [total, rows] = await Promise.all([
    prisma.finding.count({ where: { shopId, currentStatus: "OPEN" } }),
    prisma.finding.findMany({
      where: { shopId, currentStatus: "OPEN" },
      orderBy: [{ lastSeenAt: "desc" }, { ruleCode: "asc" }],
      take: FINDINGS_PAGE_LIMIT,
      select: findingListSelect,
    }),
  ]);

  return Object.freeze({
    total,
    truncated: total > rows.length,
    items: Object.freeze(rows.map(mapListItem)),
  });
}

export async function loadFindingDetailV1(shopId: string, findingId: string) {
  const row = await prisma.finding.findFirst({
    where: { id: findingId, shopId },
    select: {
      ...findingListSelect,
      findingKey: true,
      fieldKey: true,
      resolvedAt: true,
      latestEvaluation: {
        select: {
          id: true,
          scanId: true,
          policyRevisionId: true,
          ruleVersion: true,
          status: true,
          enforcement: true,
          observedJson: true,
          expectedJson: true,
          evidenceJson: true,
          message: true,
          reasonCode: true,
          evaluatedAt: true,
          exceptionId: true,
          policyRule: {
            select: {
              severity: true,
              blocking: true,
              merchantLabel: true,
              merchantNotes: true,
            },
          },
        },
      },
      events: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          eventType: true,
          createdAt: true,
          scanId: true,
          evaluationId: true,
          exceptionId: true,
          metadataJson: true,
          evaluation: {
            select: {
              status: true,
              enforcement: true,
              message: true,
              reasonCode: true,
              evaluatedAt: true,
            },
          },
          exception: {
            select: {
              reason: true,
              createdAt: true,
              expiresAt: true,
              revokedAt: true,
            },
          },
        },
      },
    },
  });

  if (!row) return null;

  const listItem = mapListItem(row);
  const latest = row.latestEvaluation;
  const history = Object.freeze(
    row.events.map((event) =>
      Object.freeze({
        id: event.id,
        eventType: event.eventType,
        createdAt: event.createdAt.toISOString(),
        ...(event.scanId ? { scanId: event.scanId } : {}),
        ...(event.evaluationId ? { evaluationId: event.evaluationId } : {}),
        ...(event.exceptionId ? { exceptionId: event.exceptionId } : {}),
        ...(event.metadataJson ? { metadataJson: event.metadataJson } : {}),
        ...(event.evaluation
          ? {
              evaluation: Object.freeze({
                status: event.evaluation.status,
                enforcement: event.evaluation.enforcement,
                message: event.evaluation.message,
                ...(event.evaluation.reasonCode
                  ? { reasonCode: event.evaluation.reasonCode }
                  : {}),
                evaluatedAt: event.evaluation.evaluatedAt.toISOString(),
              }),
            }
          : {}),
        ...(event.exception
          ? {
              exception: Object.freeze({
                reason: event.exception.reason,
                createdAt: event.exception.createdAt.toISOString(),
                ...(event.exception.expiresAt
                  ? { expiresAt: event.exception.expiresAt.toISOString() }
                  : {}),
                ...(event.exception.revokedAt
                  ? { revokedAt: event.exception.revokedAt.toISOString() }
                  : {}),
              }),
            }
          : {}),
      }),
    ),
  );

  return Object.freeze({
    ...listItem,
    findingKey: row.findingKey,
    ...(row.fieldKey ? { fieldKey: row.fieldKey } : {}),
    ...(row.resolvedAt ? { resolvedAt: row.resolvedAt.toISOString() } : {}),
    latestEvaluation: Object.freeze({
      id: latest.id,
      scanId: latest.scanId,
      policyRevisionId: latest.policyRevisionId,
      ruleVersion: latest.ruleVersion,
      status: latest.status,
      enforcement: latest.enforcement,
      ...(latest.observedJson ? { observedJson: latest.observedJson } : {}),
      ...(latest.expectedJson ? { expectedJson: latest.expectedJson } : {}),
      ...(latest.evidenceJson ? { evidenceJson: latest.evidenceJson } : {}),
      message: latest.message,
      ...(latest.reasonCode ? { reasonCode: latest.reasonCode } : {}),
      evaluatedAt: latest.evaluatedAt.toISOString(),
      severity: latest.policyRule.severity,
      blocking: latest.policyRule.blocking,
      ...(latest.policyRule.merchantLabel
        ? { merchantLabel: latest.policyRule.merchantLabel }
        : {}),
      ...(latest.policyRule.merchantNotes
        ? { merchantNotes: latest.policyRule.merchantNotes }
        : {}),
      ...(latest.exceptionId ? { exceptionId: latest.exceptionId } : {}),
    }),
    history,
  }) satisfies FindingDetailV1;
}
