import * as assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildScanPersistencePlanV1,
  scanInputFingerprintV1,
  type PolicyScanDescriptorV1,
} from "../../app/application/scan-reconciliation";
import type { FindingStateV1 } from "../../app/domain/findings/lifecycle";
import type { PolicyEvaluationV1 } from "../../app/domain/policy/evaluator";

const scan: PolicyScanDescriptorV1 = {
  id: "scan-1",
  shopId: "gid://shopify/Shop/1",
  scanType: "FULL",
  policyRevisionId: "policy-revision-1",
  apiVersion: "2026-07",
  engineVersion: "engine-v1",
  normalizationVersion: "catalog-v1",
  startedAt: "2026-09-03T16:00:00.000Z",
  finishedAt: "2026-09-03T16:01:00.000Z",
  productsProcessed: 2,
  variantsProcessed: 2,
};

function evaluation(input: {
  resourceGid: string;
  subresourceGid?: string;
  status?: "PASS" | "FAIL" | "UNKNOWN" | "NOT_APPLICABLE";
  evaluatedAt?: string;
  ruleCode?: string;
  policyRevisionId?: string;
}): PolicyEvaluationV1 {
  const status = input.status ?? "FAIL";

  return {
    policyId: "policy-1",
    policyRevisionId: input.policyRevisionId ?? scan.policyRevisionId,
    policyRevisionNumber: 1,
    ruleCode: input.ruleCode ?? "CG-SKU-001",
    ruleVersion: 1,
    severity: "ERROR",
    blocking: true,
    result: {
      status,
      ruleCode: input.ruleCode ?? "CG-SKU-001",
      ruleVersion: 1,
      resourceGid: input.resourceGid,
      ...(input.subresourceGid ? { subresourceGid: input.subresourceGid } : {}),
      message: `${status} fixture`,
    },
    enforcement:
      status === "PASS"
        ? "COMPLIANT"
        : status === "FAIL"
          ? "VIOLATION"
          : status === "UNKNOWN"
            ? "INDETERMINATE"
            : "NOT_APPLICABLE",
    evaluatedAt: input.evaluatedAt ?? "2026-09-03T16:00:30.000Z",
  };
}

test("scan persistence plan is deterministic regardless of evaluation input order", () => {
  const firstEvaluation = evaluation({
    resourceGid: "gid://shopify/Product/2",
    subresourceGid: "gid://shopify/ProductVariant/22",
  });
  const secondEvaluation = evaluation({
    resourceGid: "gid://shopify/Product/1",
    subresourceGid: "gid://shopify/ProductVariant/11",
  });
  const first = buildScanPersistencePlanV1({
    scan,
    evaluations: [firstEvaluation, secondEvaluation],
    previousFindings: [],
    baseline: true,
  });
  const second = buildScanPersistencePlanV1({
    scan,
    evaluations: [secondEvaluation, firstEvaluation],
    previousFindings: [],
    baseline: true,
  });

  assert.deepEqual(first, second);
  assert.equal(first.findings.length, 2);
  assert.equal(first.findingEvents.length, 2);
  assert.ok(
    first.findings.every(
      (finding) => finding.state.classification === "BASELINE_DEBT",
    ),
  );
  assert.ok(
    first.findingEvents.every((event) => event.eventType === "CREATED"),
  );
});

test("scan fingerprint changes when immutable scan input changes", () => {
  const item = evaluation({
    resourceGid: "gid://shopify/Product/1",
    subresourceGid: "gid://shopify/ProductVariant/11",
  });
  const first = scanInputFingerprintV1({
    scan,
    evaluations: [item],
    baseline: true,
  });
  const second = scanInputFingerprintV1({
    scan,
    evaluations: [item],
    baseline: false,
    changeCause: "DATA_CHANGE",
  });

  assert.notEqual(first, second);
});

test("PASS produces a deterministic resolution plan for an existing open finding", () => {
  const pass = evaluation({
    resourceGid: "gid://shopify/Product/1",
    subresourceGid: "gid://shopify/ProductVariant/11",
    status: "PASS",
    evaluatedAt: "2026-09-03T16:00:30.000Z",
  });
  const findingKey = JSON.stringify([
    "finding-v1",
    scan.shopId,
    pass.ruleCode,
    pass.result.resourceGid,
    pass.result.subresourceGid,
  ]);
  const previous: FindingStateV1 = {
    findingKey,
    shopId: scan.shopId,
    ruleCode: pass.ruleCode,
    resourceGid: pass.result.resourceGid,
    subresourceGid: pass.result.subresourceGid,
    currentStatus: "OPEN",
    classification: "BASELINE_DEBT",
    firstSeenAt: "2026-09-03T15:00:00.000Z",
    lastSeenAt: "2026-09-03T15:00:00.000Z",
    reopenedCount: 0,
  };
  const plan = buildScanPersistencePlanV1({
    scan,
    evaluations: [pass],
    previousFindings: [previous],
    baseline: false,
    changeCause: "DATA_CHANGE",
  });

  assert.equal(plan.findings.length, 1);
  assert.equal(plan.findings[0].state.currentStatus, "RESOLVED");
  assert.equal(plan.findings[0].state.firstSeenAt, previous.firstSeenAt);
  assert.equal(plan.findingEvents.length, 1);
  assert.equal(plan.findingEvents[0].eventType, "RESOLVED");
  assert.equal(plan.findingEvents[0].evaluationId, plan.evaluations[0].id);
});

test("scan plan rejects evaluations from a different policy revision", () => {
  assert.throws(
    () =>
      buildScanPersistencePlanV1({
        scan,
        evaluations: [
          evaluation({
            resourceGid: "gid://shopify/Product/1",
            policyRevisionId: "policy-revision-other",
          }),
        ],
        previousFindings: [],
        baseline: false,
      }),
    /does not match scan revision/,
  );
});
