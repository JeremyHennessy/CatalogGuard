import * as assert from "node:assert/strict";
import { test } from "node:test";
import { currentEnforcementForRuleStatusV1 } from "../../app/domain/policy/evaluator";

test("current enforcement derives from technical status and active exact waiver", () => {
  assert.equal(currentEnforcementForRuleStatusV1("PASS", false), "COMPLIANT");
  assert.equal(currentEnforcementForRuleStatusV1("PASS", true), "COMPLIANT");
  assert.equal(currentEnforcementForRuleStatusV1("FAIL", false), "VIOLATION");
  assert.equal(currentEnforcementForRuleStatusV1("FAIL", true), "WAIVED");
  assert.equal(
    currentEnforcementForRuleStatusV1("UNKNOWN", false),
    "INDETERMINATE",
  );
  assert.equal(
    currentEnforcementForRuleStatusV1("UNKNOWN", true),
    "INDETERMINATE",
  );
  assert.equal(
    currentEnforcementForRuleStatusV1("NOT_APPLICABLE", false),
    "NOT_APPLICABLE",
  );
});

test("revoking or expiring a waiver restores violation for a technical FAIL", () => {
  const whileActive = currentEnforcementForRuleStatusV1("FAIL", true);
  const afterInactive = currentEnforcementForRuleStatusV1("FAIL", false);

  assert.equal(whileActive, "WAIVED");
  assert.equal(afterInactive, "VIOLATION");
});
