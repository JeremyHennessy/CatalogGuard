import * as assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPreflightEvidencePlanV1,
  preflightInputFingerprintV1,
  type MaterializedPreflightTargetV1,
  type PreflightRunDescriptorV1,
} from "../../app/application/preflight-evidence";
import type { PolicyEvaluationV1 } from "../../app/domain/policy/evaluator";

const run: PreflightRunDescriptorV1 = Object.freeze({
  id: "preflight-1",
  scanId: "scan-preflight-1",
  shopId: "gid://shopify/Shop/1",
  policyRevisionId: "policy-revision-1",
  targetType: "PRODUCT_SET",
  status: "COMPLETE",
  targetDefinition: Object.freeze({
    targetType: "PRODUCT_SET",
    productGids: Object.freeze([
      "gid://shopify/Product/1",
      "gid://shopify/Product/2",
    ]),
  }),
  createdAt: "2026-09-04T13:00:00.000Z",
  completedAt: "2026-09-04T13:01:00.000Z",
  sourceFreshnessAt: "2026-09-04T13:00:30.000Z",
});

function target(input: {
  resourceType: "PRODUCT" | "VARIANT";
  resourceGid: string;
  fingerprint?: string;
}): MaterializedPreflightTargetV1 {
  return Object.freeze({
    resourceType: input.resourceType,
    resourceGid: input.resourceGid,
    resourceFingerprint:
      input.fingerprint ?? `${input.resourceGid}:fingerprint`,
  });
}

function evaluation(input: {
  productGid: string;
  variantGid?: string;
  status?: "PASS" | "FAIL" | "UNKNOWN" | "NOT_APPLICABLE";
  policyRevisionId?: string;
}): PolicyEvaluationV1 {
  const status = input.status ?? "PASS";

  return Object.freeze({
    policyId: "policy-1",
    policyRevisionId: input.policyRevisionId ?? run.policyRevisionId,
    policyRevisionNumber: 1,
    ruleCode: "CG-SKU-001",
    ruleVersion: 1,
    severity: "CRITICAL",
    blocking: true,
    result: Object.freeze({
      status,
      ruleCode: "CG-SKU-001",
      ruleVersion: 1,
      resourceGid: input.productGid,
      ...(input.variantGid ? { subresourceGid: input.variantGid } : {}),
      message: `${status} fixture`,
    }),
    enforcement:
      status === "PASS"
        ? "COMPLIANT"
        : status === "FAIL"
          ? "VIOLATION"
          : status === "UNKNOWN"
            ? "INDETERMINATE"
            : "NOT_APPLICABLE",
    evaluatedAt: "2026-09-04T13:00:30.000Z",
  });
}

test("preflight evidence plan is deterministic regardless of target and evaluation order", () => {
  const firstEvaluation = evaluation({
    productGid: "gid://shopify/Product/2",
    variantGid: "gid://shopify/ProductVariant/22",
    status: "FAIL",
  });
  const secondEvaluation = evaluation({
    productGid: "gid://shopify/Product/1",
    variantGid: "gid://shopify/ProductVariant/11",
  });
  const firstTargets = Object.freeze([
    target({
      resourceType: "VARIANT",
      resourceGid: "gid://shopify/ProductVariant/22",
    }),
    target({
      resourceType: "VARIANT",
      resourceGid: "gid://shopify/ProductVariant/11",
    }),
  ]);
  const secondTargets = Object.freeze([...firstTargets].reverse());

  const first = buildPreflightEvidencePlanV1({
    run,
    targets: firstTargets,
    evaluations: [firstEvaluation, secondEvaluation],
  });
  const second = buildPreflightEvidencePlanV1({
    run,
    targets: secondTargets,
    evaluations: [secondEvaluation, firstEvaluation],
  });

  assert.deepEqual(first, second);
  assert.equal(first.summary.outcome, "FAIL");
  assert.equal(first.summary.blockingViolationCount, 1);
  assert.equal(first.targets[0].resourceGid, "gid://shopify/ProductVariant/11");
});

test("preflight fingerprint changes when target evidence changes", () => {
  const item = evaluation({
    productGid: "gid://shopify/Product/1",
    variantGid: "gid://shopify/ProductVariant/11",
  });
  const targets = [
    target({
      resourceType: "VARIANT",
      resourceGid: "gid://shopify/ProductVariant/11",
    }),
  ];

  const first = preflightInputFingerprintV1({
    run,
    targets,
    evaluations: [item],
  });
  const second = preflightInputFingerprintV1({
    run,
    targets: [
      target({
        resourceType: "VARIANT",
        resourceGid: "gid://shopify/ProductVariant/11",
        fingerprint: "changed-source-fingerprint",
      }),
    ],
    evaluations: [item],
  });

  assert.notEqual(first, second);
});

test("preflight evidence rejects evaluations from a different policy revision", () => {
  assert.throws(
    () =>
      buildPreflightEvidencePlanV1({
        run,
        targets: [
          target({
            resourceType: "VARIANT",
            resourceGid: "gid://shopify/ProductVariant/11",
          }),
        ],
        evaluations: [
          evaluation({
            productGid: "gid://shopify/Product/1",
            variantGid: "gid://shopify/ProductVariant/11",
            policyRevisionId: "policy-revision-other",
          }),
        ],
      }),
    /does not match preflight revision/,
  );
});

test("preflight evidence rejects unmaterialized evaluation targets", () => {
  assert.throws(
    () =>
      buildPreflightEvidencePlanV1({
        run,
        targets: [
          target({
            resourceType: "VARIANT",
            resourceGid: "gid://shopify/ProductVariant/11",
          }),
        ],
        evaluations: [
          evaluation({
            productGid: "gid://shopify/Product/2",
            variantGid: "gid://shopify/ProductVariant/22",
          }),
        ],
      }),
    /was not materialized/,
  );
});

test("preflight evidence rejects ambiguous empty target materialization", () => {
  assert.throws(
    () => buildPreflightEvidencePlanV1({ run, targets: [], evaluations: [] }),
    /must materialize at least one target resource/,
  );
});
