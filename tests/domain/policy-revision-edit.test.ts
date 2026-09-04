import * as assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildNextPolicyRevisionInputV1,
  nextPolicyRevisionIdV1,
} from "../../app/application/policy-revision-edit";
import { devValidationPolicyRevisionInputV1 } from "../../app/domain/policy/dev-validation-template";

const CREATED_AT = "2026-09-04T12:00:00.000Z";

test("next policy revision preserves config/scope and changes only controlled fields", () => {
  const current = devValidationPolicyRevisionInputV1({
    shopId: "shop_a",
    createdAt: "2026-09-04T10:00:00.000Z",
  });

  const next = buildNextPolicyRevisionInputV1({
    current,
    createdAt: CREATED_AT,
    edits: [
      {
        ruleCode: "CG-SKU-001",
        ruleVersion: 1,
        enabled: false,
        severity: "WARNING",
        blocking: false,
      },
    ],
  });

  assert.equal(next.revisionNumber, 2);
  assert.equal(next.id, `${current.policyId}:r2`);
  assert.equal(next.createdAt, CREATED_AT);
  assert.equal(next.policyId, current.policyId);
  assert.equal(next.rules.length, current.rules.length);

  const requiredBefore = current.rules[0];
  const requiredAfter = next.rules[0];
  assert.equal(requiredAfter.enabled, false);
  assert.equal(requiredAfter.severity, "WARNING");
  assert.equal(requiredAfter.blocking, false);
  assert.deepEqual(requiredAfter.config, requiredBefore.config);
  assert.deepEqual(requiredAfter.scope, requiredBefore.scope);

  const uniqueBefore = current.rules[1];
  const uniqueAfter = next.rules[1];
  assert.deepEqual(uniqueAfter, uniqueBefore);
});

test("policy revision edit rejects duplicate or unknown rule targets", () => {
  const current = devValidationPolicyRevisionInputV1({
    shopId: "shop_a",
    createdAt: "2026-09-04T10:00:00.000Z",
  });
  const duplicate = {
    ruleCode: "CG-SKU-001",
    ruleVersion: 1,
    enabled: true,
    severity: "CRITICAL" as const,
    blocking: true,
  };

  assert.throws(
    () =>
      buildNextPolicyRevisionInputV1({
        current,
        createdAt: CREATED_AT,
        edits: [duplicate, duplicate],
      }),
    /duplicate policy rule edit/,
  );

  assert.throws(
    () =>
      buildNextPolicyRevisionInputV1({
        current,
        createdAt: CREATED_AT,
        edits: [
          {
            ...duplicate,
            ruleCode: "CG-NOT-REAL",
          },
        ],
      }),
    /does not match active revision/,
  );
});

test("policy revision ids are deterministic by logical policy and revision number", () => {
  assert.equal(nextPolicyRevisionIdV1("policy_a", 2), "policy_a:r2");
  assert.throws(() => nextPolicyRevisionIdV1("", 2), /policyId/);
  assert.throws(() => nextPolicyRevisionIdV1("policy_a", 0), /positive integer/);
});
