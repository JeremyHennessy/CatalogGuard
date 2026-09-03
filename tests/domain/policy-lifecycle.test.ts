import * as assert from "node:assert/strict";
import { test } from "node:test";
import { available, unavailable } from "../../app/domain/catalog/model";
import {
  findingKeyFor,
  reconcileFindingsV1,
  transitionFindingV1,
  type FindingStateV1,
} from "../../app/domain/findings/lifecycle";
import {
  POLICY_SCHEMA_VERSION,
  validatePolicyRevisionV1,
  type PolicyRevisionInputV1,
} from "../../app/domain/policy/contracts";
import {
  evaluatePolicyRevisionV1,
  type ExactRuleExceptionV1,
  type PolicyEvaluationContextV1,
} from "../../app/domain/policy/evaluator";
import { aggregatePreflightV1 } from "../../app/domain/policy/preflight";
import { minimumPriceRule } from "../../app/domain/rules/builtin/pricing";
import { skuRequiredRule } from "../../app/domain/rules/builtin/sku";
import type {
  PolicyRuleInput,
  RuleDefinition,
} from "../../app/domain/rules/contracts";
import { createBuiltinRuleRegistry } from "../../app/domain/rules/registry";
import { makeContext, makeProduct, makeVariant } from "./fixtures";

const SHOP_ID = "gid://shopify/Shop/1";

function policyRule<TConfig>(
  definition: RuleDefinition<TConfig>,
  config: unknown = {},
  overrides: Partial<PolicyRuleInput> = {},
): PolicyRuleInput {
  return {
    ruleCode: definition.code,
    ruleVersion: definition.version,
    enabled: true,
    severity: "ERROR",
    blocking: true,
    config,
    ...overrides,
  };
}

function policyRevision(
  rules: readonly PolicyRuleInput[],
  overrides: Partial<PolicyRevisionInputV1> = {},
): PolicyRevisionInputV1 {
  return {
    schemaVersion: POLICY_SCHEMA_VERSION,
    id: "policy-revision-1",
    policyId: "policy-1",
    revisionNumber: 1,
    createdAt: "2026-09-03T14:00:00.000Z",
    rules,
    ...overrides,
  };
}

function contextFor(
  variants = [makeVariant()],
  observedAt = "2026-09-03T14:00:00.000Z",
): PolicyEvaluationContextV1 {
  const context = makeContext(variants);

  return {
    shopId: context.shopId,
    observedAt: new Date(observedAt),
    apiVersion: context.apiVersion,
    normalizationVersion: context.normalizationVersion,
    identifierIndex: context.identifierIndex,
  };
}

function evaluateSku(input: {
  variant: ReturnType<typeof makeVariant>;
  observedAt?: string;
  revision?: PolicyRevisionInputV1;
  exceptions?: readonly ExactRuleExceptionV1[];
}) {
  const revision = validatePolicyRevisionV1(
    createBuiltinRuleRegistry(),
    input.revision ?? policyRevision([policyRule(skuRequiredRule)]),
  );
  const product = makeProduct({ variants: [input.variant] });

  return evaluatePolicyRevisionV1({
    revision,
    products: [product],
    context: contextFor([input.variant], input.observedAt),
    exceptions: input.exceptions,
  })[0];
}

function exactException(
  evaluation: ReturnType<typeof evaluateSku>,
  overrides: Partial<ExactRuleExceptionV1> = {},
): ExactRuleExceptionV1 {
  return {
    id: "exception-1",
    shopId: SHOP_ID,
    coverageType: "FINDING_EXACT",
    ruleCode: evaluation.result.ruleCode,
    resourceGid: evaluation.result.resourceGid,
    ...(evaluation.result.subresourceGid
      ? { subresourceGid: evaluation.result.subresourceGid }
      : {}),
    reason: "Approved launch exception",
    createdAt: "2026-09-03T13:00:00.000Z",
    ...overrides,
  };
}

test("policy revision validation is immutable and rejects duplicate rule identities", () => {
  const registry = createBuiltinRuleRegistry();
  const revision = validatePolicyRevisionV1(
    registry,
    policyRevision([
      policyRule(skuRequiredRule, {}, { severity: "WARNING", blocking: true }),
    ]),
  );

  assert.equal(revision.rules[0].rule.severity, "WARNING");
  assert.equal(revision.rules[0].rule.blocking, true);
  assert.equal(Object.isFrozen(revision), true);
  assert.equal(Object.isFrozen(revision.rules), true);
  assert.equal(Object.isFrozen(revision.rules[0].rule), true);

  assert.throws(
    () =>
      validatePolicyRevisionV1(
        registry,
        policyRevision([
          policyRule(skuRequiredRule),
          policyRule(skuRequiredRule),
        ]),
      ),
    /duplicate policy rule/,
  );
});

test("policy orchestration is deterministic and keeps enforcement separate from rule status", () => {
  const registry = createBuiltinRuleRegistry();
  const revision = validatePolicyRevisionV1(
    registry,
    policyRevision([
      policyRule(minimumPriceRule, { minimum: "5.00" }),
      policyRule(skuRequiredRule),
    ]),
  );
  const variantB = makeVariant({
    gid: "gid://shopify/ProductVariant/202",
    productGid: "gid://shopify/Product/2",
    sku: available("SKU-B"),
  });
  const variantA = makeVariant({
    gid: "gid://shopify/ProductVariant/101",
    productGid: "gid://shopify/Product/1",
    sku: available("SKU-A"),
  });
  const productB = makeProduct({
    gid: variantB.productGid,
    variants: [variantB],
  });
  const productA = makeProduct({
    gid: variantA.productGid,
    variants: [variantA],
  });
  const context = contextFor([variantA, variantB]);

  const first = evaluatePolicyRevisionV1({
    revision,
    products: [productB, productA],
    context,
  });
  const second = evaluatePolicyRevisionV1({
    revision,
    products: [productA, productB],
    context,
  });

  assert.deepEqual(first, second);
  assert.deepEqual(
    first.map((evaluation) => evaluation.enforcement),
    ["COMPLIANT", "COMPLIANT", "COMPLIANT", "COMPLIANT"],
  );
  assert.ok(first.every((evaluation) => evaluation.result.status === "PASS"));
});

test("baseline failure creates BASELINE_DEBT", () => {
  const evaluation = evaluateSku({
    variant: makeVariant({ sku: available(null) }),
  });
  const transition = transitionFindingV1({
    shopId: SHOP_ID,
    evaluation,
    baseline: true,
    changeCause: "UNKNOWN",
  });

  assert.equal(transition.finding?.currentStatus, "OPEN");
  assert.equal(transition.finding?.classification, "BASELINE_DEBT");
  assert.equal(transition.events[0].eventType, "CREATED");
});

test("post-baseline data failure creates NEW_REGRESSION", () => {
  const evaluation = evaluateSku({
    variant: makeVariant({ sku: available(null) }),
  });
  const transition = transitionFindingV1({
    shopId: SHOP_ID,
    evaluation,
    baseline: false,
    changeCause: "DATA_CHANGE",
  });

  assert.equal(transition.finding?.classification, "NEW_REGRESSION");
});

test("PASS resolves an open finding without erasing first-seen history", () => {
  const failed = evaluateSku({
    variant: makeVariant({ sku: available(null) }),
    observedAt: "2026-09-03T14:00:00.000Z",
  });
  const opened = transitionFindingV1({
    shopId: SHOP_ID,
    evaluation: failed,
    baseline: true,
    changeCause: "UNKNOWN",
  }).finding!;
  const passed = evaluateSku({
    variant: makeVariant({ sku: available("SKU-RECOVERED") }),
    observedAt: "2026-09-03T15:00:00.000Z",
  });
  const resolved = transitionFindingV1({
    shopId: SHOP_ID,
    previous: opened,
    evaluation: passed,
    baseline: false,
    changeCause: "DATA_CHANGE",
  });

  assert.equal(resolved.finding?.currentStatus, "RESOLVED");
  assert.equal(resolved.finding?.firstSeenAt, opened.firstSeenAt);
  assert.equal(resolved.finding?.resolvedAt, passed.evaluatedAt);
  assert.equal(resolved.events[0].eventType, "RESOLVED");
});

test("a resolved finding that fails again is REOPENED_REGRESSION", () => {
  const initialFailure = evaluateSku({
    variant: makeVariant({ sku: available(null) }),
    observedAt: "2026-09-03T14:00:00.000Z",
  });
  const opened = transitionFindingV1({
    shopId: SHOP_ID,
    evaluation: initialFailure,
    baseline: true,
    changeCause: "UNKNOWN",
  }).finding!;
  const passed = evaluateSku({
    variant: makeVariant({ sku: available("SKU-OK") }),
    observedAt: "2026-09-03T15:00:00.000Z",
  });
  const resolved = transitionFindingV1({
    shopId: SHOP_ID,
    previous: opened,
    evaluation: passed,
    baseline: false,
    changeCause: "DATA_CHANGE",
  }).finding!;
  const failedAgain = evaluateSku({
    variant: makeVariant({ sku: available(null) }),
    observedAt: "2026-09-03T16:00:00.000Z",
  });
  const reopened = transitionFindingV1({
    shopId: SHOP_ID,
    previous: resolved,
    evaluation: failedAgain,
    baseline: false,
    changeCause: "DATA_CHANGE",
  });

  assert.equal(reopened.finding?.currentStatus, "OPEN");
  assert.equal(reopened.finding?.classification, "REOPENED_REGRESSION");
  assert.equal(reopened.finding?.reopenedCount, 1);
  assert.equal(reopened.events[0].eventType, "REOPENED");
});

test("exact exception waives enforcement but never rewrites technical FAIL", () => {
  const failed = evaluateSku({
    variant: makeVariant({ sku: available(null) }),
  });
  const exception = exactException(failed);
  const waived = evaluateSku({
    variant: makeVariant({ sku: available(null) }),
    exceptions: [exception],
  });

  assert.equal(waived.result.status, "FAIL");
  assert.equal(waived.enforcement, "WAIVED");
  assert.equal(waived.exceptionId, exception.id);
  assert.equal(aggregatePreflightV1([waived]).outcome, "PASS_WITH_WAIVERS");
});

test("expired and revoked exceptions return a continuing FAIL to VIOLATION", () => {
  const failed = evaluateSku({
    variant: makeVariant({ sku: available(null) }),
  });
  const expired = exactException(failed, {
    expiresAt: "2026-09-03T13:30:00.000Z",
  });
  const revoked = exactException(failed, {
    id: "exception-2",
    revokedAt: "2026-09-03T13:30:00.000Z",
  });

  assert.equal(
    evaluateSku({
      variant: makeVariant({ sku: available(null) }),
      exceptions: [expired],
    }).enforcement,
    "VIOLATION",
  );
  assert.equal(
    evaluateSku({
      variant: makeVariant({ sku: available(null) }),
      exceptions: [revoked],
    }).enforcement,
    "VIOLATION",
  );
});

test("policy threshold change is classified separately from a data regression", () => {
  const registry = createBuiltinRuleRegistry();
  const variant = makeVariant({ price: available("10.00") });
  const product = makeProduct({ variants: [variant] });
  const revision1 = validatePolicyRevisionV1(
    registry,
    policyRevision([policyRule(minimumPriceRule, { minimum: "5.00" })]),
  );
  const revision2 = validatePolicyRevisionV1(
    registry,
    policyRevision([policyRule(minimumPriceRule, { minimum: "15.00" })], {
      id: "policy-revision-2",
      revisionNumber: 2,
      createdAt: "2026-09-03T15:00:00.000Z",
    }),
  );

  const before = evaluatePolicyRevisionV1({
    revision: revision1,
    products: [product],
    context: contextFor([variant], "2026-09-03T14:00:00.000Z"),
  })[0];
  const after = evaluatePolicyRevisionV1({
    revision: revision2,
    products: [product],
    context: contextFor([variant], "2026-09-03T15:00:00.000Z"),
  })[0];

  assert.equal(before.result.status, "PASS");
  assert.equal(after.result.status, "FAIL");

  const transition = transitionFindingV1({
    shopId: SHOP_ID,
    evaluation: after,
    baseline: false,
    changeCause: "POLICY_CHANGE",
  });

  assert.equal(transition.finding?.classification, "POLICY_CHANGE_FAILURE");
});

test("UNKNOWN remains indeterminate, does not resolve debt, and recovers to PASS", () => {
  const failed = evaluateSku({
    variant: makeVariant({ sku: available(null) }),
    observedAt: "2026-09-03T14:00:00.000Z",
  });
  const opened = transitionFindingV1({
    shopId: SHOP_ID,
    evaluation: failed,
    baseline: true,
    changeCause: "UNKNOWN",
  }).finding!;
  const unknown = evaluateSku({
    variant: makeVariant({ sku: unavailable("read failed") }),
    observedAt: "2026-09-03T15:00:00.000Z",
  });
  const duringUnknown = transitionFindingV1({
    shopId: SHOP_ID,
    previous: opened,
    evaluation: unknown,
    baseline: false,
    changeCause: "UNKNOWN",
  });
  const recovered = evaluateSku({
    variant: makeVariant({ sku: available("SKU-RECOVERED") }),
    observedAt: "2026-09-03T16:00:00.000Z",
  });
  const resolved = transitionFindingV1({
    shopId: SHOP_ID,
    previous: duringUnknown.finding,
    evaluation: recovered,
    baseline: false,
    changeCause: "DATA_CHANGE",
  });

  assert.equal(unknown.result.status, "UNKNOWN");
  assert.equal(unknown.enforcement, "INDETERMINATE");
  assert.equal(aggregatePreflightV1([unknown]).outcome, "INDETERMINATE");
  assert.equal(duringUnknown.finding?.currentStatus, "OPEN");
  assert.equal(duringUnknown.events.length, 0);
  assert.equal(recovered.result.status, "PASS");
  assert.equal(aggregatePreflightV1([recovered]).outcome, "PASS");
  assert.equal(resolved.finding?.currentStatus, "RESOLVED");
});

test("full reconciliation produces the same finding state as incremental application", () => {
  const missingVariant = makeVariant({ sku: available(null) });
  const failed = evaluateSku({
    variant: missingVariant,
    observedAt: "2026-09-03T14:00:00.000Z",
  });
  const prior = transitionFindingV1({
    shopId: SHOP_ID,
    evaluation: failed,
    baseline: true,
    changeCause: "UNKNOWN",
  }).finding!;
  const recovered = evaluateSku({
    variant: makeVariant({ sku: available("SKU-RECOVERED") }),
    observedAt: "2026-09-03T15:00:00.000Z",
  });
  const secondVariant = makeVariant({
    gid: "gid://shopify/ProductVariant/202",
    productGid: "gid://shopify/Product/2",
    sku: available(null),
  });
  const secondProduct = makeProduct({
    gid: secondVariant.productGid,
    variants: [secondVariant],
  });
  const revision = validatePolicyRevisionV1(
    createBuiltinRuleRegistry(),
    policyRevision([policyRule(skuRequiredRule)]),
  );
  const secondFailure = evaluatePolicyRevisionV1({
    revision,
    products: [secondProduct],
    context: contextFor([secondVariant], "2026-09-03T15:00:00.000Z"),
  })[0];
  const evaluations = [recovered, secondFailure];
  const full = reconcileFindingsV1({
    shopId: SHOP_ID,
    previous: [prior],
    evaluations,
    baseline: false,
    changeCause: "DATA_CHANGE",
  });

  let incremental: readonly FindingStateV1[] = [prior];
  for (const evaluation of evaluations) {
    incremental = reconcileFindingsV1({
      shopId: SHOP_ID,
      previous: incremental,
      evaluations: [evaluation],
      baseline: false,
      changeCause: "DATA_CHANGE",
    }).findings;
  }

  assert.deepEqual(full.findings, incremental);
  assert.equal(full.findings.length, 2);
  assert.equal(
    full.findings.find(
      (finding) =>
        finding.findingKey ===
        findingKeyFor({
          shopId: SHOP_ID,
          ruleCode: recovered.result.ruleCode,
          resourceGid: recovered.result.resourceGid,
          subresourceGid: recovered.result.subresourceGid,
        }),
    )?.currentStatus,
    "RESOLVED",
  );
});

test("preflight outcome precedence follows blocking enforcement semantics", () => {
  const blockingViolation = evaluateSku({
    variant: makeVariant({ sku: available(null) }),
  });
  const nonBlockingRevision = policyRevision([
    policyRule(skuRequiredRule, {}, { blocking: false, severity: "CRITICAL" }),
  ]);
  const nonBlockingFailure = evaluateSku({
    variant: makeVariant({ sku: available(null) }),
    revision: nonBlockingRevision,
  });

  assert.equal(aggregatePreflightV1([nonBlockingFailure]).outcome, "PASS");
  assert.equal(
    aggregatePreflightV1([nonBlockingFailure]).nonBlockingIssueCount,
    1,
  );
  assert.equal(aggregatePreflightV1([blockingViolation]).outcome, "FAIL");
});
