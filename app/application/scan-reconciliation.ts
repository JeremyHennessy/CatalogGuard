import { createHash } from "node:crypto";
import {
  findingKeyFor,
  reconcileFindingsV1,
  type FindingChangeCause,
  type FindingStateV1,
} from "../domain/findings/lifecycle";
import type { PolicyEvaluationV1 } from "../domain/policy/evaluator";
import { canonicalJsonStringify } from "../persistence/json";

export type PolicyScanDescriptorV1 = Readonly<{
  id: string;
  shopId: string;
  scanType: string;
  policyRevisionId: string;
  apiVersion: string;
  engineVersion: string;
  normalizationVersion: string;
  startedAt: string;
  finishedAt: string;
  sourceWatermark?: string;
  productsExpected?: number;
  productsProcessed: number;
  variantsProcessed: number;
}>;

export type ScanReconciliationInputV1 = Readonly<{
  scan: PolicyScanDescriptorV1;
  evaluations: readonly PolicyEvaluationV1[];
  previousFindings: readonly FindingStateV1[];
  baseline: boolean;
  changeCause?: FindingChangeCause;
  changeCauseByFindingKey?: ReadonlyMap<string, FindingChangeCause>;
}>;

export type PlannedEvaluationV1 = Readonly<{
  id: string;
  findingKey: string;
  evaluation: PolicyEvaluationV1;
}>;

export type PlannedFindingV1 = Readonly<{
  id: string;
  state: FindingStateV1;
  latestEvaluationId: string;
  resourceType: "PRODUCT" | "VARIANT";
}>;

export type PlannedFindingEventV1 = Readonly<{
  id: string;
  findingId: string;
  findingKey: string;
  eventType: "CREATED" | "RESOLVED" | "REOPENED";
  occurredAt: string;
  policyRevisionId: string;
  evaluationId: string;
  exceptionId?: string;
}>;

export type ScanPersistenceCountsV1 = Readonly<{
  passCount: number;
  failCount: number;
  unknownCount: number;
  notApplicableCount: number;
  warningCount: number;
}>;

export type ScanPersistencePlanV1 = Readonly<{
  inputFingerprint: string;
  scan: PolicyScanDescriptorV1;
  evaluations: readonly PlannedEvaluationV1[];
  findings: readonly PlannedFindingV1[];
  findingEvents: readonly PlannedFindingEventV1[];
  counts: ScanPersistenceCountsV1;
}>;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stableId(prefix: string, value: unknown) {
  return `${prefix}_${sha256(canonicalJsonStringify(value)).slice(0, 40)}`;
}

function findingKeyForEvaluation(shopId: string, evaluation: PolicyEvaluationV1) {
  return findingKeyFor({
    shopId,
    ruleCode: evaluation.result.ruleCode,
    resourceGid: evaluation.result.resourceGid,
    ...(evaluation.result.subresourceGid
      ? { subresourceGid: evaluation.result.subresourceGid }
      : {}),
  });
}

function sortedEvaluations(evaluations: readonly PolicyEvaluationV1[]) {
  return [...evaluations].sort((a, b) =>
    canonicalJsonStringify(a).localeCompare(canonicalJsonStringify(b)),
  );
}

function changeCauseEntries(
  map: ReadonlyMap<string, FindingChangeCause> | undefined,
) {
  return map
    ? [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
    : undefined;
}

export function scanInputFingerprintV1(input: {
  scan: PolicyScanDescriptorV1;
  evaluations: readonly PolicyEvaluationV1[];
  baseline: boolean;
  changeCause?: FindingChangeCause;
  changeCauseByFindingKey?: ReadonlyMap<string, FindingChangeCause>;
}) {
  return sha256(
    canonicalJsonStringify({
      scan: input.scan,
      evaluations: sortedEvaluations(input.evaluations),
      baseline: input.baseline,
      changeCause: input.changeCause,
      changeCauseByFindingKey: changeCauseEntries(
        input.changeCauseByFindingKey,
      ),
    }),
  );
}

function countEvaluations(
  evaluations: readonly PolicyEvaluationV1[],
): ScanPersistenceCountsV1 {
  let passCount = 0;
  let failCount = 0;
  let unknownCount = 0;
  let notApplicableCount = 0;
  let warningCount = 0;

  for (const evaluation of evaluations) {
    switch (evaluation.result.status) {
      case "PASS":
        passCount += 1;
        break;
      case "FAIL":
        failCount += 1;
        if (evaluation.severity === "WARNING") warningCount += 1;
        break;
      case "UNKNOWN":
        unknownCount += 1;
        break;
      case "NOT_APPLICABLE":
        notApplicableCount += 1;
        break;
    }
  }

  return Object.freeze({
    passCount,
    failCount,
    unknownCount,
    notApplicableCount,
    warningCount,
  });
}

export function buildScanPersistencePlanV1(
  input: ScanReconciliationInputV1,
): ScanPersistencePlanV1 {
  const evaluations = sortedEvaluations(input.evaluations);

  for (const evaluation of evaluations) {
    if (evaluation.policyRevisionId !== input.scan.policyRevisionId) {
      throw new Error(
        `evaluation policy revision ${evaluation.policyRevisionId} does not match scan revision ${input.scan.policyRevisionId}`,
      );
    }
  }

  const plannedEvaluations = evaluations.map((evaluation, index) => {
    const findingKey = findingKeyForEvaluation(input.scan.shopId, evaluation);

    return Object.freeze({
      id: stableId("evaluation", {
        scanId: input.scan.id,
        index,
        evaluation,
      }),
      findingKey,
      evaluation,
    });
  });
  const reconciliation = reconcileFindingsV1({
    shopId: input.scan.shopId,
    previous: input.previousFindings,
    evaluations,
    baseline: input.baseline,
    changeCause: input.changeCause,
    changeCauseByFindingKey: input.changeCauseByFindingKey,
  });
  const latestEvaluationByFindingKey = new Map<
    string,
    PlannedEvaluationV1
  >();
  const evaluationByFindingAndTime = new Map<string, PlannedEvaluationV1>();

  for (const planned of plannedEvaluations) {
    const current = latestEvaluationByFindingKey.get(planned.findingKey);
    if (
      !current ||
      planned.evaluation.evaluatedAt >= current.evaluation.evaluatedAt
    ) {
      latestEvaluationByFindingKey.set(planned.findingKey, planned);
    }

    evaluationByFindingAndTime.set(
      `${planned.findingKey}|${planned.evaluation.evaluatedAt}`,
      planned,
    );
  }

  const findings = reconciliation.findings.map((state) => {
    const latest = latestEvaluationByFindingKey.get(state.findingKey);
    if (!latest) {
      throw new Error(`finding ${state.findingKey} has no evaluation in this scan`);
    }

    return Object.freeze({
      id: stableId("finding", {
        shopId: state.shopId,
        findingKey: state.findingKey,
      }),
      state,
      latestEvaluationId: latest.id,
      resourceType: latest.evaluation.result.subresourceGid
        ? ("VARIANT" as const)
        : ("PRODUCT" as const),
    });
  });
  const findingIdByKey = new Map(
    findings.map((finding) => [finding.state.findingKey, finding.id]),
  );
  const findingEvents = reconciliation.events.map((event) => {
    const evaluation = evaluationByFindingAndTime.get(
      `${event.findingKey}|${event.occurredAt}`,
    );
    const findingId = findingIdByKey.get(event.findingKey);

    if (!evaluation || !findingId) {
      throw new Error(
        `finding event ${event.eventType} cannot be linked to persisted evidence`,
      );
    }

    return Object.freeze({
      id: stableId("finding_event", {
        scanId: input.scan.id,
        findingKey: event.findingKey,
        eventType: event.eventType,
        occurredAt: event.occurredAt,
      }),
      findingId,
      findingKey: event.findingKey,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      policyRevisionId: event.policyRevisionId,
      evaluationId: evaluation.id,
      ...(evaluation.evaluation.exceptionId
        ? { exceptionId: evaluation.evaluation.exceptionId }
        : {}),
    });
  });

  return Object.freeze({
    inputFingerprint: scanInputFingerprintV1(input),
    scan: input.scan,
    evaluations: Object.freeze(plannedEvaluations),
    findings: Object.freeze(findings),
    findingEvents: Object.freeze(findingEvents),
    counts: countEvaluations(evaluations),
  });
}
