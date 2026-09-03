import type { PolicyEvaluationV1 } from "./evaluator";

export type PreflightOutcome =
  | "PASS"
  | "PASS_WITH_WAIVERS"
  | "FAIL"
  | "INDETERMINATE";

export type PreflightSummaryV1 = Readonly<{
  outcome: PreflightOutcome;
  blockingViolationCount: number;
  blockingIndeterminateCount: number;
  blockingWaiverCount: number;
  nonBlockingIssueCount: number;
}>;

export function aggregatePreflightV1(
  evaluations: readonly PolicyEvaluationV1[],
): PreflightSummaryV1 {
  let blockingViolationCount = 0;
  let blockingIndeterminateCount = 0;
  let blockingWaiverCount = 0;
  let nonBlockingIssueCount = 0;

  for (const evaluation of evaluations) {
    if (!evaluation.blocking) {
      if (
        evaluation.enforcement === "VIOLATION" ||
        evaluation.enforcement === "WAIVED" ||
        evaluation.enforcement === "INDETERMINATE"
      ) {
        nonBlockingIssueCount += 1;
      }
      continue;
    }

    if (evaluation.enforcement === "VIOLATION") {
      blockingViolationCount += 1;
    } else if (evaluation.enforcement === "INDETERMINATE") {
      blockingIndeterminateCount += 1;
    } else if (evaluation.enforcement === "WAIVED") {
      blockingWaiverCount += 1;
    }
  }

  const outcome: PreflightOutcome =
    blockingViolationCount > 0
      ? "FAIL"
      : blockingIndeterminateCount > 0
        ? "INDETERMINATE"
        : blockingWaiverCount > 0
          ? "PASS_WITH_WAIVERS"
          : "PASS";

  return Object.freeze({
    outcome,
    blockingViolationCount,
    blockingIndeterminateCount,
    blockingWaiverCount,
    nonBlockingIssueCount,
  });
}
