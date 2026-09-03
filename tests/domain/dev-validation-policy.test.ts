import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertDevValidationPolicyRevisionV1,
  developmentBaselineScanIdV1,
  devValidationPolicyIdentityV1,
  devValidationPolicyRevisionInputV1,
} from "../../app/domain/policy/dev-validation-template";
import { validatePolicyRevisionV1 } from "../../app/domain/policy/contracts";
import { createBuiltinRuleRegistry } from "../../app/domain/rules/registry";

test("dev validation policy uses stable per-shop evidence identities", () => {
  const first = devValidationPolicyIdentityV1("shop_a");
  const second = devValidationPolicyIdentityV1("shop_a");
  const other = devValidationPolicyIdentityV1("shop_b");

  assert.deepEqual(first, second);
  assert.notEqual(first.policyId, other.policyId);
  assert.equal(developmentBaselineScanIdV1("shop_a"), "shop_a:baseline:dev-v1");
});

test("dev validation policy is ACTIVE-only SKU required and unique", () => {
  const registry = createBuiltinRuleRegistry();
  const revision = validatePolicyRevisionV1(
    registry,
    devValidationPolicyRevisionInputV1({
      shopId: "shop_a",
      createdAt: "2026-09-03T19:00:00.000Z",
    }),
  );

  assert.doesNotThrow(() => assertDevValidationPolicyRevisionV1(revision));
  assert.equal(revision.rules.length, 2);

  const required = revision.rules.find(
    (entry) => entry.rule.ruleCode === "CG-SKU-001",
  );
  const unique = revision.rules.find(
    (entry) => entry.rule.ruleCode === "CG-SKU-002",
  );

  assert.ok(required);
  assert.ok(unique);
  assert.equal(required.rule.severity, "CRITICAL");
  assert.equal(required.rule.blocking, true);
  assert.deepEqual(required.rule.scope.statuses, ["ACTIVE"]);
  assert.equal(unique.rule.severity, "CRITICAL");
  assert.equal(unique.rule.blocking, true);
  assert.deepEqual(unique.rule.scope.statuses, ["ACTIVE"]);
  assert.deepEqual(unique.rule.config, { normalization: "EXACT" });
});

test("dev validation assertion rejects drift in merchant semantics", () => {
  const registry = createBuiltinRuleRegistry();
  const input = devValidationPolicyRevisionInputV1({
    shopId: "shop_a",
    createdAt: "2026-09-03T19:00:00.000Z",
  });
  const drifted = {
    ...input,
    rules: input.rules.map((rule) =>
      rule.ruleCode === "CG-SKU-001" ? { ...rule, blocking: false } : rule,
    ),
  };
  const revision = validatePolicyRevisionV1(registry, drifted);

  assert.throws(
    () => assertDevValidationPolicyRevisionV1(revision),
    /enabled, CRITICAL, and blocking/,
  );
});
