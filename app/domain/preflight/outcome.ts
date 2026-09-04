import type { PolicyEvaluationV1 } from "../policy/evaluator";

export type PreflightOutcomeV1 =
  | "PASS"
  | "PASS_WITH_WAIVERS"
  | "FAIL"
  | "INDETERMINATE";

export type PreflightEvaluationSummaryV1 = Readonly<{
  outcome: PreflightOutcomeV1;
  evaluationCount: number;
  passCount: number;
  failCount: number;
  unknownCount: number;
  notApplicableCount: number;
  nonBlockingViolationCount: number;
  blockingViolationCount: number;
  waiverCount: number;
  blockingWaiverCount: number;
  indeterminateBlockingCount: number;
}>;

function zeroSummary(): PreflightEvaluationSummaryV1 {
  return Object.freeze({
    outcome: "PASS",
    evaluationCount: 0,
    passCount: 0,
    failCount: 0,
    unknownCount: 0,
    notApplicableCount: 0,
    nonBlockingViolationCount: 0,
    blockingViolationCount: 0,
    waiverCount: 0,
    blockingWaiverCount: 0,
    indeterminateBlockingCount: 0,
  });
}

export function preflightOutcomeFromCountsV1(input: {
  blockingViolationCount: number;
  indeterminateBlockingCount: number;
  blockingWaiverCount: number;
}): PreflightOutcomeV1 {
  if (input.blockingViolationCount > 0) {
    return "FAIL";
  }

  if (input.indeterminateBlockingCount > 0) {
    return "INDETERMINATE";
  }

  if (input.blockingWaiverCount > 0) {
    return "PASS_WITH_WAIVERS";
  }

  return "PASS";
}

export function summarizePreflightEvaluationsV1(
  evaluations: readonly PolicyEvaluationV1[],
): PreflightEvaluationSummaryV1 {
  const summary = { ...zeroSummary() };

  for (const evaluation of evaluations) {
    summary.evaluationCount += 1;

    switch (evaluation.result.status) {
      case "PASS":
        summary.passCount += 1;
        break;
      case "FAIL":
        summary.failCount += 1;
        break;
      case "UNKNOWN":
        summary.unknownCount += 1;
        break;
      case "NOT_APPLICABLE":
        summary.notApplicableCount += 1;
        break;
    }

    if (evaluation.enforcement === "WAIVED") {
      summary.waiverCount += 1;
      if (evaluation.blocking) {
        summary.blockingWaiverCount += 1;
      }
    }

    if (evaluation.blocking && evaluation.enforcement === "VIOLATION") {
      summary.blockingViolationCount += 1;
    }

    if (!evaluation.blocking && evaluation.enforcement === "VIOLATION") {
      summary.nonBlockingViolationCount += 1;
    }

    if (
      evaluation.blocking &&
      (evaluation.enforcement === "INDETERMINATE" ||
        evaluation.result.status === "UNKNOWN")
    ) {
      summary.indeterminateBlockingCount += 1;
    }
  }

  summary.outcome = preflightOutcomeFromCountsV1(summary);

  return Object.freeze(summary);
}
