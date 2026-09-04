import * as assert from "node:assert/strict";
import { test } from "node:test";
import { establishDevBaselineV1 } from "../../app/application/establish-dev-baseline";
import { devValidationPolicyRevisionInputV1 } from "../../app/domain/policy/dev-validation-template";
import { validatePolicyRevisionV1 } from "../../app/domain/policy/contracts";
import { createBuiltinRuleRegistry } from "../../app/domain/rules/registry";

function validatedRevision(shopId: string, createdAt: string) {
  return validatePolicyRevisionV1(
    createBuiltinRuleRegistry(),
    devValidationPolicyRevisionInputV1({ shopId, createdAt }),
  );
}

test("existing baseline exits before policy, exceptions, or scan execution", async () => {
  let ensurePolicyCalls = 0;
  let loadExceptionCalls = 0;
  let runScanCalls = 0;

  const result = await establishDevBaselineV1({
    admin: { marker: "admin" },
    shopId: "shop_a",
    apiVersion: "2026-07",
    engineVersion: "catalogguard-policy-v1",
    now: () => "2026-09-04T10:00:00.000Z",
    loadOverview: async () => ({ baseline: { id: "baseline-existing" } }),
    ensurePolicy: async () => {
      ensurePolicyCalls += 1;
      return validatedRevision("shop_a", "2026-09-04T10:00:00.000Z");
    },
    loadExceptions: async () => {
      loadExceptionCalls += 1;
      return [];
    },
    runScan: async () => {
      runScanCalls += 1;
      return { status: "PERSISTED" };
    },
  });

  assert.deepEqual(result, {
    status: "ALREADY_ESTABLISHED",
    scanId: "baseline-existing",
  });
  assert.equal(ensurePolicyCalls, 0);
  assert.equal(loadExceptionCalls, 0);
  assert.equal(runScanCalls, 0);
});

test("missing baseline executes one deterministic baseline scan", async () => {
  const createdAt = "2026-09-04T10:00:00.000Z";
  const revision = validatedRevision("shop_a", createdAt);
  const calls: string[] = [];

  const result = await establishDevBaselineV1({
    admin: { marker: "admin" },
    shopId: "shop_a",
    apiVersion: "2026-07",
    engineVersion: "catalogguard-policy-v1",
    now: () => createdAt,
    loadOverview: async () => {
      calls.push("overview");
      return { baseline: null };
    },
    ensurePolicy: async (input) => {
      calls.push("policy");
      assert.deepEqual(input, { shopId: "shop_a", createdAt });
      return revision;
    },
    loadExceptions: async (shopId) => {
      calls.push("exceptions");
      assert.equal(shopId, "shop_a");
      return [];
    },
    runScan: async (input) => {
      calls.push("scan");
      assert.equal(input.scanId, "shop_a:baseline:dev-v1");
      assert.equal(input.scanType, "BASELINE");
      assert.equal(input.baseline, true);
      assert.equal(input.startedAt, createdAt);
      assert.equal(input.observedAt, createdAt);
      assert.equal(input.finishedAt, createdAt);
      assert.equal(input.revision.revisionId, revision.revisionId);
      return { status: "PERSISTED" as const };
    },
  });

  assert.deepEqual(calls, ["overview", "policy", "exceptions", "scan"]);
  assert.equal(result.status, "ESTABLISHED");
  assert.equal(result.scanId, "shop_a:baseline:dev-v1");
  if (result.status === "ESTABLISHED") {
    assert.deepEqual(result.scanResult, { status: "PERSISTED" });
  }
});
