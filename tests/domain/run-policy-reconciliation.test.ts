import * as assert from "node:assert/strict";
import { test } from "node:test";
import { runPolicyReconciliationV1 } from "../../app/application/run-policy-reconciliation";
import { validatePolicyRevisionV1 } from "../../app/domain/policy/contracts";
import { devValidationPolicyRevisionInputV1 } from "../../app/domain/policy/dev-validation-template";
import { createBuiltinRuleRegistry } from "../../app/domain/rules/registry";

const revision = validatePolicyRevisionV1(
  createBuiltinRuleRegistry(),
  devValidationPolicyRevisionInputV1({
    shopId: "shop_a",
    createdAt: "2026-09-04T10:00:00.000Z",
  }),
);

test("explicit policy reconciliation uses the exact active revision and POLICY_CHANGE cause", async () => {
  const scans: unknown[] = [];
  const result = await runPolicyReconciliationV1(
    {
      admin: { kind: "admin" },
      shopId: "shop_a",
      policyId: revision.policyId,
      expectedRevisionId: revision.id,
      apiVersion: "2026-07",
      engineVersion: "catalogguard-policy-v1",
      now: () => "2026-09-04T13:00:00.000Z",
      nextScanId: () => "scan_policy_change_1",
      loadActiveRevision: async () => revision,
      loadExceptions: async () => [],
      runScan: async (input) => {
        scans.push(input);
        return { complete: true };
      },
    },
  );

  assert.equal(result.scanId, "scan_policy_change_1");
  assert.equal(result.policyRevisionId, revision.id);
  assert.equal(scans.length, 1);
  const scan = scans[0] as {
    scanType: string;
    baseline: boolean;
    changeCause: string;
    revision: { id: string };
    observedAt: string;
  };
  assert.equal(scan.scanType, "RECONCILIATION");
  assert.equal(scan.baseline, false);
  assert.equal(scan.changeCause, "POLICY_CHANGE");
  assert.equal(scan.revision.id, revision.id);
  assert.equal(scan.observedAt, "2026-09-04T13:00:00.000Z");
});

test("stale reconciliation page does not run against a different active revision", async () => {
  let scans = 0;
  await assert.rejects(
    () =>
      runPolicyReconciliationV1({
        admin: {},
        shopId: "shop_a",
        policyId: revision.policyId,
        expectedRevisionId: "stale-revision",
        apiVersion: "2026-07",
        engineVersion: "catalogguard-policy-v1",
        now: () => "2026-09-04T13:00:00.000Z",
        nextScanId: () => "scan_should_not_run",
        loadActiveRevision: async () => revision,
        loadExceptions: async () => [],
        runScan: async () => {
          scans += 1;
          return {};
        },
      }),
    /active policy revision changed/,
  );
  assert.equal(scans, 0);
});
