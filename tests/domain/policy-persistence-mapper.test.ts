import * as assert from "node:assert/strict";
import { test } from "node:test";
import {
  validatePolicyRevisionV1,
  type PolicyRevisionInputV1,
} from "../../app/domain/policy/contracts";
import { minimumPriceRule } from "../../app/domain/rules/builtin/pricing";
import { createBuiltinRuleRegistry } from "../../app/domain/rules/registry";
import {
  canonicalJsonStringify,
  parseCanonicalJson,
} from "../../app/persistence/json";
import {
  policyRevisionInputFromSnapshotV1,
  snapshotValidatedPolicyRevisionV1,
} from "../../app/persistence/policy-mapper";

test("canonical JSON is stable across object key ordering", () => {
  const first = canonicalJsonStringify({
    z: 2,
    a: { beta: true, alpha: [3, 2, 1] },
  });
  const second = canonicalJsonStringify({
    a: { alpha: [3, 2, 1], beta: true },
    z: 2,
  });

  assert.equal(first, second);
  assert.equal(first, '{"a":{"alpha":[3,2,1],"beta":true},"z":2}');
  assert.deepEqual(parseCanonicalJson(first), {
    a: { alpha: [3, 2, 1], beta: true },
    z: 2,
  });
});

test("canonical JSON rejects non-JSON top-level and array values", () => {
  assert.throws(() => canonicalJsonStringify(undefined), /undefined/);
  assert.throws(() => canonicalJsonStringify([undefined]), /undefined/);
  assert.throws(() => canonicalJsonStringify(Number.NaN), /non-finite/);
  assert.throws(() => parseCanonicalJson('{"z":2,"a":1}'), /canonical/);
});

test("policy snapshots round-trip normalized rule config, scope, identity, and order", () => {
  const input: PolicyRevisionInputV1 = {
    schemaVersion: 1,
    id: "policy-revision-2",
    policyId: "policy-1",
    revisionNumber: 2,
    createdAt: "2026-09-03T16:00:00.000Z",
    rules: [
      {
        ruleCode: minimumPriceRule.code,
        ruleVersion: minimumPriceRule.version,
        enabled: true,
        severity: "ERROR",
        blocking: true,
        config: { minimum: "5.00" },
        scope: {
          productTypes: ["snowboard"],
          vendors: ["Vendor B", "Vendor A"],
        },
      },
    ],
  };
  const validated = validatePolicyRevisionV1(
    createBuiltinRuleRegistry(),
    input,
  );
  const snapshot = snapshotValidatedPolicyRevisionV1(validated);

  assert.equal(snapshot.id, input.id);
  assert.equal(snapshot.policyId, input.policyId);
  assert.equal(snapshot.revisionNumber, input.revisionNumber);
  assert.equal(snapshot.createdAt, input.createdAt);
  assert.equal(snapshot.rules[0].position, 0);
  assert.equal(snapshot.rules[0].configJson, '{"minimum":"5.00"}');
  assert.equal(
    snapshot.rules[0].scopeJson,
    '{"productTypes":["snowboard"],"vendors":["Vendor B","Vendor A"]}',
  );

  const reconstructed = policyRevisionInputFromSnapshotV1(snapshot);
  const revalidated = validatePolicyRevisionV1(
    createBuiltinRuleRegistry(),
    reconstructed,
  );

  assert.equal(revalidated.id, validated.id);
  assert.equal(revalidated.policyId, validated.policyId);
  assert.equal(revalidated.revisionNumber, validated.revisionNumber);
  assert.deepEqual(revalidated.rules[0].rule, validated.rules[0].rule);
});
