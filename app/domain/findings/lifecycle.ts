import type { PolicyEvaluationV1 } from "../policy/evaluator";

export type FindingStatus = "OPEN" | "RESOLVED";
export type FindingClassification =
  | "BASELINE_DEBT"
  | "NEW_REGRESSION"
  | "REOPENED_REGRESSION"
  | "POLICY_CHANGE_FAILURE"
  | "UNKNOWN_CAUSE";
export type FindingChangeCause = "DATA_CHANGE" | "POLICY_CHANGE" | "UNKNOWN";
export type FindingEventType = "CREATED" | "RESOLVED" | "REOPENED";

export type FindingStateV1 = Readonly<{
  findingKey: string;
  shopId: string;
  ruleCode: string;
  resourceGid: string;
  subresourceGid?: string;
  currentStatus: FindingStatus;
  classification: FindingClassification;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt?: string;
  reopenedCount: number;
}>;

export type FindingEventV1 = Readonly<{
  findingKey: string;
  eventType: FindingEventType;
  occurredAt: string;
  policyRevisionId: string;
}>;

export function findingKeyFor(input: {
  shopId: string;
  ruleCode: string;
  resourceGid: string;
  subresourceGid?: string;
}) {
  return JSON.stringify([
    "finding-v1",
    input.shopId,
    input.ruleCode,
    input.resourceGid,
    input.subresourceGid ?? null,
  ]);
}

function classificationForNewFailure(input: {
  baseline: boolean;
  changeCause: FindingChangeCause;
}): FindingClassification {
  if (input.baseline) {
    return "BASELINE_DEBT";
  }

  if (input.changeCause === "POLICY_CHANGE") {
    return "POLICY_CHANGE_FAILURE";
  }

  if (input.changeCause === "DATA_CHANGE") {
    return "NEW_REGRESSION";
  }

  return "UNKNOWN_CAUSE";
}

function classificationForReopen(
  changeCause: FindingChangeCause,
): FindingClassification {
  return changeCause === "POLICY_CHANGE"
    ? "POLICY_CHANGE_FAILURE"
    : "REOPENED_REGRESSION";
}

function eventFor(
  findingKey: string,
  eventType: FindingEventType,
  evaluation: PolicyEvaluationV1,
): FindingEventV1 {
  return Object.freeze({
    findingKey,
    eventType,
    occurredAt: evaluation.evaluatedAt,
    policyRevisionId: evaluation.policyRevisionId,
  });
}

export function transitionFindingV1(input: {
  shopId: string;
  previous?: FindingStateV1;
  evaluation: PolicyEvaluationV1;
  baseline: boolean;
  changeCause: FindingChangeCause;
}): Readonly<{
  finding?: FindingStateV1;
  events: readonly FindingEventV1[];
}> {
  const result = input.evaluation.result;
  const findingKey = findingKeyFor({
    shopId: input.shopId,
    ruleCode: result.ruleCode,
    resourceGid: result.resourceGid,
    ...(result.subresourceGid ? { subresourceGid: result.subresourceGid } : {}),
  });
  const previous = input.previous;

  if (previous && previous.findingKey !== findingKey) {
    throw new Error("previous finding identity does not match evaluation");
  }

  if (result.status === "FAIL") {
    if (!previous) {
      const finding = Object.freeze({
        findingKey,
        shopId: input.shopId,
        ruleCode: result.ruleCode,
        resourceGid: result.resourceGid,
        ...(result.subresourceGid
          ? { subresourceGid: result.subresourceGid }
          : {}),
        currentStatus: "OPEN" as const,
        classification: classificationForNewFailure(input),
        firstSeenAt: input.evaluation.evaluatedAt,
        lastSeenAt: input.evaluation.evaluatedAt,
        reopenedCount: 0,
      });

      return Object.freeze({
        finding,
        events: Object.freeze([
          eventFor(findingKey, "CREATED", input.evaluation),
        ]),
      });
    }

    if (previous.currentStatus === "RESOLVED") {
      const finding = Object.freeze({
        ...previous,
        currentStatus: "OPEN" as const,
        classification: classificationForReopen(input.changeCause),
        lastSeenAt: input.evaluation.evaluatedAt,
        reopenedCount: previous.reopenedCount + 1,
        resolvedAt: undefined,
      });

      return Object.freeze({
        finding,
        events: Object.freeze([
          eventFor(findingKey, "REOPENED", input.evaluation),
        ]),
      });
    }

    return Object.freeze({
      finding: Object.freeze({
        ...previous,
        lastSeenAt: input.evaluation.evaluatedAt,
      }),
      events: Object.freeze([]),
    });
  }

  if (result.status === "PASS" && previous?.currentStatus === "OPEN") {
    const finding = Object.freeze({
      ...previous,
      currentStatus: "RESOLVED" as const,
      resolvedAt: input.evaluation.evaluatedAt,
    });

    return Object.freeze({
      finding,
      events: Object.freeze([
        eventFor(findingKey, "RESOLVED", input.evaluation),
      ]),
    });
  }

  return Object.freeze({
    ...(previous ? { finding: previous } : {}),
    events: Object.freeze([]),
  });
}

export function reconcileFindingsV1(input: {
  shopId: string;
  previous: readonly FindingStateV1[];
  evaluations: readonly PolicyEvaluationV1[];
  baseline: boolean;
  changeCause?: FindingChangeCause;
  changeCauseByFindingKey?: ReadonlyMap<string, FindingChangeCause>;
}): Readonly<{
  findings: readonly FindingStateV1[];
  events: readonly FindingEventV1[];
}> {
  const findings = new Map(
    input.previous.map((finding) => [finding.findingKey, finding]),
  );
  const events: FindingEventV1[] = [];
  const evaluations = [...input.evaluations].sort((a, b) => {
    const aKey = findingKeyFor({
      shopId: input.shopId,
      ruleCode: a.result.ruleCode,
      resourceGid: a.result.resourceGid,
      ...(a.result.subresourceGid
        ? { subresourceGid: a.result.subresourceGid }
        : {}),
    });
    const bKey = findingKeyFor({
      shopId: input.shopId,
      ruleCode: b.result.ruleCode,
      resourceGid: b.result.resourceGid,
      ...(b.result.subresourceGid
        ? { subresourceGid: b.result.subresourceGid }
        : {}),
    });

    return aKey.localeCompare(bKey);
  });

  for (const evaluation of evaluations) {
    const key = findingKeyFor({
      shopId: input.shopId,
      ruleCode: evaluation.result.ruleCode,
      resourceGid: evaluation.result.resourceGid,
      ...(evaluation.result.subresourceGid
        ? { subresourceGid: evaluation.result.subresourceGid }
        : {}),
    });
    const transition = transitionFindingV1({
      shopId: input.shopId,
      previous: findings.get(key),
      evaluation,
      baseline: input.baseline,
      changeCause:
        input.changeCauseByFindingKey?.get(key) ??
        input.changeCause ??
        "UNKNOWN",
    });

    if (transition.finding) {
      findings.set(key, transition.finding);
    }

    events.push(...transition.events);
  }

  return Object.freeze({
    findings: Object.freeze(
      [...findings.values()].sort((a, b) =>
        a.findingKey.localeCompare(b.findingKey),
      ),
    ),
    events: Object.freeze(events),
  });
}
