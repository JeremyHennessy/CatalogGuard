import {
  isExceptionActiveAt,
  type ExactRuleExceptionV1,
} from "../domain/policy/evaluator";

export type WaivableFindingV1 = Readonly<{
  id: string;
  shopId: string;
  ruleCode: string;
  resourceGid: string;
  subresourceGid?: string;
  currentStatus: string;
  latestStatus: string;
}>;

export type CreateExactWaiverDependenciesV1 = Readonly<{
  loadFinding(
    shopId: string,
    findingId: string,
  ): Promise<WaivableFindingV1 | null>;
  loadExactExceptions(
    shopId: string,
    finding: WaivableFindingV1,
  ): Promise<readonly ExactRuleExceptionV1[]>;
  persistCreate(input: {
    exception: ExactRuleExceptionV1;
    findingId: string;
    notes?: string;
    createdByActor?: string;
  }): Promise<void>;
  nextId(): string;
}>;

export type RevokeExactWaiverDependenciesV1 = Readonly<{
  loadException(
    shopId: string,
    exceptionId: string,
  ): Promise<(ExactRuleExceptionV1 & { findingId?: string }) | null>;
  persistRevoke(input: {
    shopId: string;
    exceptionId: string;
    revokedAt: string;
    revokedByActor?: string;
    revocationReason: string;
    findingId: string;
  }): Promise<void>;
}>;

function requireTrimmed(value: string, field: string) {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${field} must be non-empty`);
  }
  return trimmed;
}

function optionalTrimmed(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function timestamp(value: string, field: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${field} must be an ISO date-time`);
  }
  return parsed;
}

export async function createExactFindingWaiverV1(
  input: Readonly<{
    shopId: string;
    findingId: string;
    reason: string;
    notes?: string;
    createdAt: string;
    expiresAt?: string;
    createdByActor?: string;
  }>,
  dependencies: CreateExactWaiverDependenciesV1,
): Promise<ExactRuleExceptionV1> {
  const reason = requireTrimmed(input.reason, "waiver reason");
  const notes = optionalTrimmed(input.notes);
  const createdTimestamp = timestamp(input.createdAt, "waiver createdAt");
  const expiresAt = optionalTrimmed(input.expiresAt);

  if (expiresAt) {
    const expiryTimestamp = timestamp(expiresAt, "waiver expiresAt");
    if (expiryTimestamp <= createdTimestamp) {
      throw new Error("waiver expiresAt must be after createdAt");
    }
  }

  const finding = await dependencies.loadFinding(input.shopId, input.findingId);
  if (!finding) {
    throw new Error(`finding not found for shop: ${input.findingId}`);
  }
  if (finding.currentStatus !== "OPEN" || finding.latestStatus !== "FAIL") {
    throw new Error("only an open technical FAIL finding can be waived");
  }

  const existing = await dependencies.loadExactExceptions(
    input.shopId,
    finding,
  );
  const now = new Date(createdTimestamp);
  if (existing.some((exception) => isExceptionActiveAt(exception, now))) {
    throw new Error("an active exact waiver already exists for this finding");
  }

  const exception: ExactRuleExceptionV1 = Object.freeze({
    id: requireTrimmed(dependencies.nextId(), "exception id"),
    shopId: input.shopId,
    coverageType: "FINDING_EXACT",
    ruleCode: finding.ruleCode,
    resourceGid: finding.resourceGid,
    ...(finding.subresourceGid
      ? { subresourceGid: finding.subresourceGid }
      : {}),
    reason,
    createdAt: input.createdAt,
    ...(expiresAt ? { expiresAt } : {}),
  });

  await dependencies.persistCreate({
    exception,
    findingId: finding.id,
    notes,
    createdByActor: input.createdByActor,
  });

  return exception;
}

export async function revokeExactFindingWaiverV1(
  input: Readonly<{
    shopId: string;
    findingId: string;
    exceptionId: string;
    revokedAt: string;
    revokedByActor?: string;
    revocationReason: string;
  }>,
  dependencies: RevokeExactWaiverDependenciesV1,
) {
  const revocationReason = requireTrimmed(
    input.revocationReason,
    "revocation reason",
  );
  const revokedTimestamp = timestamp(input.revokedAt, "waiver revokedAt");
  const exception = await dependencies.loadException(
    input.shopId,
    input.exceptionId,
  );

  if (!exception) {
    throw new Error(`waiver not found for shop: ${input.exceptionId}`);
  }
  if (exception.findingId !== input.findingId) {
    throw new Error("waiver does not belong to the requested finding");
  }
  if (exception.revokedAt) {
    throw new Error("waiver is already revoked");
  }
  if (revokedTimestamp < timestamp(exception.createdAt, "waiver createdAt")) {
    throw new Error("waiver revokedAt cannot precede createdAt");
  }

  await dependencies.persistRevoke({
    shopId: input.shopId,
    exceptionId: input.exceptionId,
    revokedAt: input.revokedAt,
    revokedByActor: input.revokedByActor,
    revocationReason,
    findingId: input.findingId,
  });

  return Object.freeze({
    ...exception,
    revokedAt: input.revokedAt,
  });
}
