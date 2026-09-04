import type { NormalizedProductV1 } from "../catalog/model";
import type {
  EvaluationContextV1,
  RuleResult,
  RuleSeverity,
  RuleStatus,
} from "../rules/contracts";
import { evaluateRule } from "../rules/engine";
import type { ValidatedPolicyRevisionV1 } from "./contracts";

export type EnforcementDisposition =
  | "COMPLIANT"
  | "VIOLATION"
  | "WAIVED"
  | "INDETERMINATE"
  | "NOT_APPLICABLE";

export type ExactRuleExceptionV1 = Readonly<{
  id: string;
  shopId: string;
  coverageType: "FINDING_EXACT";
  ruleCode: string;
  resourceGid: string;
  subresourceGid?: string;
  reason: string;
  createdAt: string;
  expiresAt?: string;
  revokedAt?: string;
}>;

export type PolicyEvaluationV1 = Readonly<{
  policyId: string;
  policyRevisionId: string;
  policyRevisionNumber: number;
  ruleCode: string;
  ruleVersion: number;
  severity: RuleSeverity;
  blocking: boolean;
  result: RuleResult;
  enforcement: EnforcementDisposition;
  evaluatedAt: string;
  exceptionId?: string;
}>;

export type PolicyEvaluationContextV1 = Omit<
  EvaluationContextV1,
  "policyRevisionId"
>;

function parseTimestamp(value: string, field: string) {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw new Error(`${field} must be an ISO date-time`);
  }

  return timestamp;
}

export function isExceptionActiveAt(
  exception: ExactRuleExceptionV1,
  observedAt: Date,
): boolean {
  const observed = observedAt.getTime();
  const created = parseTimestamp(exception.createdAt, "exception createdAt");

  if (created > observed) {
    return false;
  }

  if (exception.revokedAt) {
    parseTimestamp(exception.revokedAt, "exception revokedAt");
    return false;
  }

  if (exception.expiresAt) {
    const expires = parseTimestamp(exception.expiresAt, "exception expiresAt");

    if (expires <= observed) {
      return false;
    }
  }

  return true;
}

export function currentEnforcementForRuleStatusV1(
  status: RuleStatus,
  hasActiveExactException: boolean,
): EnforcementDisposition {
  switch (status) {
    case "PASS":
      return "COMPLIANT";
    case "NOT_APPLICABLE":
      return "NOT_APPLICABLE";
    case "UNKNOWN":
      return "INDETERMINATE";
    case "FAIL":
      return hasActiveExactException ? "WAIVED" : "VIOLATION";
  }
}

function matchesExactException(
  exception: ExactRuleExceptionV1,
  result: RuleResult,
  shopId: string,
) {
  return (
    exception.coverageType === "FINDING_EXACT" &&
    exception.shopId === shopId &&
    exception.ruleCode === result.ruleCode &&
    exception.resourceGid === result.resourceGid &&
    exception.subresourceGid === result.subresourceGid
  );
}

function activeExceptionFor(
  exceptions: readonly ExactRuleExceptionV1[],
  result: RuleResult,
  context: EvaluationContextV1,
) {
  return exceptions
    .filter(
      (exception) =>
        matchesExactException(exception, result, context.shopId) &&
        isExceptionActiveAt(exception, context.observedAt),
    )
    .sort((a, b) =>
      `${a.createdAt}|${a.id}`.localeCompare(`${b.createdAt}|${b.id}`),
    )[0];
}

function enforcementFor(
  result: RuleResult,
  context: EvaluationContextV1,
  exceptions: readonly ExactRuleExceptionV1[],
): { enforcement: EnforcementDisposition; exceptionId?: string } {
  const exception =
    result.status === "FAIL"
      ? activeExceptionFor(exceptions, result, context)
      : undefined;
  const enforcement = currentEnforcementForRuleStatusV1(
    result.status,
    Boolean(exception),
  );

  return exception
    ? { enforcement, exceptionId: exception.id }
    : { enforcement };
}

function evaluationSortKey(evaluation: PolicyEvaluationV1) {
  const result = evaluation.result;

  return [
    evaluation.ruleCode,
    String(evaluation.ruleVersion).padStart(8, "0"),
    result.resourceGid,
    result.subresourceGid ?? "",
    result.reasonCode ?? "",
    result.message,
  ].join("|");
}

export function evaluatePolicyRevisionV1(input: {
  revision: ValidatedPolicyRevisionV1;
  products: readonly NormalizedProductV1[];
  context: PolicyEvaluationContextV1;
  exceptions?: readonly ExactRuleExceptionV1[];
}): readonly PolicyEvaluationV1[] {
  const context: EvaluationContextV1 = {
    ...input.context,
    policyRevisionId: input.revision.id,
  };
  const exceptions = input.exceptions ?? [];
  const products = [...input.products].sort((a, b) =>
    a.gid.localeCompare(b.gid),
  );
  const evaluations: PolicyEvaluationV1[] = [];

  for (const entry of input.revision.rules) {
    for (const product of products) {
      const targets =
        entry.definition.target === "PRODUCT"
          ? [{ product }]
          : [...product.variants]
              .sort((a, b) => a.gid.localeCompare(b.gid))
              .map((variant) => ({ product, variant }));

      for (const target of targets) {
        const results = evaluateRule(
          entry.definition,
          target,
          entry.rule,
          context,
        );

        for (const result of results) {
          const enforcement = enforcementFor(result, context, exceptions);

          evaluations.push(
            Object.freeze({
              policyId: input.revision.policyId,
              policyRevisionId: input.revision.id,
              policyRevisionNumber: input.revision.revisionNumber,
              ruleCode: entry.rule.ruleCode,
              ruleVersion: entry.rule.ruleVersion,
              severity: entry.rule.severity,
              blocking: entry.rule.blocking,
              result,
              enforcement: enforcement.enforcement,
              evaluatedAt: context.observedAt.toISOString(),
              ...(enforcement.exceptionId
                ? { exceptionId: enforcement.exceptionId }
                : {}),
            }),
          );
        }
      }
    }
  }

  return Object.freeze(
    evaluations.sort((a, b) =>
      evaluationSortKey(a).localeCompare(evaluationSortKey(b)),
    ),
  );
}
