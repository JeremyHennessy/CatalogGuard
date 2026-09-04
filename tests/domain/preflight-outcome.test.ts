import * as assert from "node:assert/strict";
import { test } from "node:test";
import type { PolicyEvaluationV1 } from "../../app/domain/policy/evaluator";
import { summarizePreflightEvaluationsV1 } from "../../app/domain/preflight/outcome";

function evaluation(input: {
  status: "PASS" | "FAIL" | "UNKNOWN" | "NOT_APPLICABLE";
  enforcement:
    | "COMPLIANT"
    | "VIOLATION"
    | "WAIVED"
    | "INDETERMINATE"
    | "NOT_APPLICABLE";
  blocking: boolean;
  ruleCode?: string;
}): PolicyEvaluationV1 {
  return Object.freeze({
    policyId: "policy-1",
    policyRevisionId: "policy-revision-1",
    policyRevisionNumber: 1,
    ruleCode: input.ruleCode ?? "CG-SKU-001",
    ruleVersion: 1,
    severity: input.blocking ? "CRITICAL" : "WARNING",
    blocking: input.blocking,
    result: Object.freeze({
      status: input.status,
      ruleCode: input.ruleCode ?? "CG-SKU-001",
      ruleVersion: 1,
      resourceGid: "gid://shopify/Product/1",
      subresourceGid: "gid://shopify/ProductVariant/1",
      message: `${input.status} fixture`,
    }),
    enforcement: input.enforcement,
    evaluatedAt: "2026-09-04T13:30:00.000Z",
  });
}

test("blocking violations make preflight fail", () => {
  const summary = summarizePreflightEvaluationsV1([
    evaluation({ status: "PASS", enforcement: "COMPLIANT", blocking: true }),
    evaluation({ status: "FAIL", enforcement: "VIOLATION", blocking: true }),
  ]);

  assert.equal(summary.outcome, "FAIL");
  assert.equal(summary.blockingViolationCount, 1);
  assert.equal(summary.indeterminateBlockingCount, 0);
});

test("blocking unknowns make preflight indeterminate when no violation exists", () => {
  const summary = summarizePreflightEvaluationsV1([
    evaluation({ status: "UNKNOWN", enforcement: "INDETERMINATE", blocking: true }),
  ]);

  assert.equal(summary.outcome, "INDETERMINATE");
  assert.equal(summary.indeterminateBlockingCount, 1);
});

test("only waived blocking failures produce pass with waivers", () => {
  const summary = summarizePreflightEvaluationsV1([
    evaluation({ status: "FAIL", enforcement: "WAIVED", blocking: true }),
    evaluation({ status: "PASS", enforcement: "COMPLIANT", blocking: true }),
  ]);

  assert.equal(summary.outcome, "PASS_WITH_WAIVERS");
  assert.equal(summary.failCount, 1);
  assert.equal(summary.waiverCount, 1);
  assert.equal(summary.blockingWaiverCount, 1);
});

test("non-blocking violations do not block a preflight pass", () => {
  const summary = summarizePreflightEvaluationsV1([
    evaluation({ status: "FAIL", enforcement: "VIOLATION", blocking: false }),
    evaluation({ status: "PASS", enforcement: "COMPLIANT", blocking: true }),
  ]);

  assert.equal(summary.outcome, "PASS");
  assert.equal(summary.nonBlockingViolationCount, 1);
  assert.equal(summary.blockingViolationCount, 0);
});

test("blocking violation outranks blocking indeterminate and waiver states", () => {
  const summary = summarizePreflightEvaluationsV1([
    evaluation({ status: "UNKNOWN", enforcement: "INDETERMINATE", blocking: true }),
    evaluation({ status: "FAIL", enforcement: "WAIVED", blocking: true }),
    evaluation({ status: "FAIL", enforcement: "VIOLATION", blocking: true }),
  ]);

  assert.equal(summary.outcome, "FAIL");
  assert.equal(summary.blockingViolationCount, 1);
  assert.equal(summary.indeterminateBlockingCount, 1);
  assert.equal(summary.blockingWaiverCount, 1);
});
