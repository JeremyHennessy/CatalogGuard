import * as assert from "node:assert/strict";
import { test } from "node:test";
import {
  available,
  unavailable,
} from "../../app/domain/catalog/model";
import {
  evaluateRule,
  validatePolicyRule,
} from "../../app/domain/rules/engine";
import type {
  PolicyRuleInput,
  RuleDefinition,
  RuleStatus,
} from "../../app/domain/rules/contracts";
import {
  RuleConfigError,
} from "../../app/domain/rules/config";
import {
  createBuiltinRuleRegistry,
  RuleRegistry,
} from "../../app/domain/rules/registry";
import {
  skuRequiredRule,
  skuUniqueRule,
} from "../../app/domain/rules/builtin/sku";
import {
  barcodeRequiredRule,
  barcodeUniqueRule,
} from "../../app/domain/rules/builtin/barcode";
import {
  compareAtRelationshipRule,
  minimumPriceRule,
} from "../../app/domain/rules/builtin/pricing";
import {
  descriptionRequiredRule,
} from "../../app/domain/rules/builtin/description";
import {
  makeContext,
  makeProduct,
  makeVariant,
} from "./fixtures";

function policyInput(
  definition: RuleDefinition<unknown>,
  config: unknown = {},
  scope?: unknown,
): PolicyRuleInput {
  return {
    ruleCode: definition.code,
    ruleVersion: definition.version,
    enabled: true,
    severity: "ERROR",
    blocking: true,
    config,
    scope,
  };
}

function evaluate<TConfig>(
  definition: RuleDefinition<TConfig>,
  target: ReturnType<typeof targetFor>,
  config: unknown = {},
  scope?: unknown,
  context = makeContext(target.variant ? [target.variant] : undefined),
) {
  const validated = validatePolicyRule(
    definition,
    policyInput(definition as RuleDefinition<unknown>, config, scope),
  );

  return evaluateRule(definition, target, validated, context)[0];
}

function targetFor(
  product = makeProduct(),
  variant = product.variants[0],
) {
  return { product, variant };
}

test("builtin registry contains stable unique rule identities", () => {
  const registry = createBuiltinRuleRegistry();
  const codes = registry.list().map((rule) => `${rule.code}@${rule.version}`);

  assert.deepEqual(codes, [
    "CG-BARCODE-001@1",
    "CG-BARCODE-002@1",
    "CG-DESC-001@1",
    "CG-PRICE-001@1",
    "CG-PRICE-002@1",
    "CG-SKU-001@1",
    "CG-SKU-002@1",
  ]);

  assert.throws(
    () => new RuleRegistry().register(skuRequiredRule).register(skuRequiredRule),
    /duplicate rule definition/,
  );
});

test("severity and blocking remain policy metadata, not rule status", () => {
  const validated = validatePolicyRule(
    skuRequiredRule,
    {
      ...policyInput(skuRequiredRule),
      severity: "WARNING",
      blocking: true,
    },
  );

  assert.equal(validated.severity, "WARNING");
  assert.equal(validated.blocking, true);
});

test("SKU required returns PASS, FAIL, UNKNOWN, and scoped NOT_APPLICABLE", () => {
  const passing = makeVariant({ sku: available("SKU-001") });
  assert.equal(
    evaluate(skuRequiredRule, targetFor(makeProduct({ variants: [passing] }), passing))
      .status,
    "PASS",
  );

  const failing = makeVariant({ sku: available("   ") });
  assert.equal(
    evaluate(skuRequiredRule, targetFor(makeProduct({ variants: [failing] }), failing))
      .status,
    "FAIL",
  );

  const unknown = makeVariant({ sku: unavailable("sku field missing") });
  assert.equal(
    evaluate(skuRequiredRule, targetFor(makeProduct({ variants: [unknown] }), unknown))
      .status,
    "UNKNOWN",
  );

  assert.equal(
    evaluate(
      skuRequiredRule,
      targetFor(),
      {},
      { statuses: ["DRAFT"] },
    ).status,
    "NOT_APPLICABLE",
  );
});

test("SKU uniqueness uses explicit store-wide index semantics", () => {
  const v1 = makeVariant({ gid: "v1", sku: available("SKU-1") });
  const v2 = makeVariant({ gid: "v2", sku: available("SKU-1") });
  const product = makeProduct({ variants: [v1, v2] });
  const context = makeContext([v1, v2]);

  assert.equal(
    evaluate(
      skuUniqueRule,
      targetFor(product, v1),
      { normalization: "EXACT" },
      undefined,
      context,
    ).status,
    "FAIL",
  );

  const uniqueContext = makeContext([v1]);
  assert.equal(
    evaluate(
      skuUniqueRule,
      targetFor(makeProduct({ variants: [v1] }), v1),
      { normalization: "EXACT" },
      undefined,
      uniqueContext,
    ).status,
    "PASS",
  );

  const empty = makeVariant({ sku: available(null) });
  assert.equal(
    evaluate(skuUniqueRule, targetFor(makeProduct({ variants: [empty] }), empty))
      .status,
    "NOT_APPLICABLE",
  );

  const partialContext = makeContext([v1], "PARTIAL");
  assert.equal(
    evaluate(
      skuUniqueRule,
      targetFor(makeProduct({ variants: [v1] }), v1),
      {},
      undefined,
      partialContext,
    ).status,
    "UNKNOWN",
  );
});

test("barcode required and unique preserve missing-data semantics", () => {
  const missing = makeVariant({ barcode: available(null) });
  assert.equal(
    evaluate(
      barcodeRequiredRule,
      targetFor(makeProduct({ variants: [missing] }), missing),
    ).status,
    "FAIL",
  );

  const unknown = makeVariant({ barcode: unavailable("not requested") });
  assert.equal(
    evaluate(
      barcodeRequiredRule,
      targetFor(makeProduct({ variants: [unknown] }), unknown),
    ).status,
    "UNKNOWN",
  );

  const v1 = makeVariant({ gid: "v1", barcode: available("111") });
  const v2 = makeVariant({ gid: "v2", barcode: available("111") });
  const context = makeContext([v1, v2]);

  assert.equal(
    evaluate(
      barcodeUniqueRule,
      targetFor(makeProduct({ variants: [v1, v2] }), v1),
      {},
      undefined,
      context,
    ).status,
    "FAIL",
  );
});

test("minimum price uses decimal-string comparison without floating-point coercion", () => {
  const pass = makeVariant({ price: available("10.10") });
  assert.equal(
    evaluate(
      minimumPriceRule,
      targetFor(makeProduct({ variants: [pass] }), pass),
      { minimum: "10.1" },
    ).status,
    "PASS",
  );

  const fail = makeVariant({ price: available("9.99") });
  assert.equal(
    evaluate(
      minimumPriceRule,
      targetFor(makeProduct({ variants: [fail] }), fail),
      { minimum: "10.00" },
    ).status,
    "FAIL",
  );

  const unknown = makeVariant({ price: unavailable("price fetch failed") });
  assert.equal(
    evaluate(
      minimumPriceRule,
      targetFor(makeProduct({ variants: [unknown] }), unknown),
      { minimum: "1.00" },
    ).status,
    "UNKNOWN",
  );

  assert.throws(
    () =>
      validatePolicyRule(
        minimumPriceRule,
        policyInput(minimumPriceRule, { minimum: -1 }),
      ),
    RuleConfigError,
  );
});

test("compare-at relationship distinguishes not-applicable from failure", () => {
  const noCompare = makeVariant({ compareAtPrice: available(null) });
  assert.equal(
    evaluate(
      compareAtRelationshipRule,
      targetFor(makeProduct({ variants: [noCompare] }), noCompare),
    ).status,
    "NOT_APPLICABLE",
  );

  const pass = makeVariant({
    price: available("10.00"),
    compareAtPrice: available("10.01"),
  });
  assert.equal(
    evaluate(
      compareAtRelationshipRule,
      targetFor(makeProduct({ variants: [pass] }), pass),
    ).status,
    "PASS",
  );

  const fail = makeVariant({
    price: available("10.00"),
    compareAtPrice: available("10.00"),
  });
  assert.equal(
    evaluate(
      compareAtRelationshipRule,
      targetFor(makeProduct({ variants: [fail] }), fail),
    ).status,
    "FAIL",
  );

  const unknown = makeVariant({
    compareAtPrice: unavailable("not requested"),
  });
  assert.equal(
    evaluate(
      compareAtRelationshipRule,
      targetFor(makeProduct({ variants: [unknown] }), unknown),
    ).status,
    "UNKNOWN",
  );
});

test("description rule evaluates normalized plain text length", () => {
  assert.equal(
    evaluate(
      descriptionRequiredRule,
      targetFor(makeProduct({ descriptionText: available("abcd") })),
      { minLength: 4 },
    ).status,
    "PASS",
  );

  assert.equal(
    evaluate(
      descriptionRequiredRule,
      targetFor(makeProduct({ descriptionText: available("   ") })),
      { minLength: 1 },
    ).status,
    "FAIL",
  );

  assert.equal(
    evaluate(
      descriptionRequiredRule,
      targetFor(makeProduct({ descriptionText: unavailable("not fetched") })),
      { minLength: 1 },
    ).status,
    "UNKNOWN",
  );

  assert.throws(
    () =>
      validatePolicyRule(
        descriptionRequiredRule,
        policyInput(descriptionRequiredRule, {
          minLength: 0,
          extra: true,
        }),
      ),
    RuleConfigError,
  );
});

test("scope uncertainty maps to UNKNOWN before rule condition", () => {
  const product = makeProduct({ vendor: unavailable("vendor unavailable") });
  const result = evaluate(
    skuRequiredRule,
    targetFor(product),
    {},
    { vendors: ["Example Vendor"] },
  );

  assert.equal(result.status, "UNKNOWN");
  assert.match(result.reasonCode ?? "", /^SCOPE_/);
});

test("disabled rules return NOT_APPLICABLE without executing condition", () => {
  const validated = validatePolicyRule(skuRequiredRule, {
    ...policyInput(skuRequiredRule),
    enabled: false,
  });

  const result = evaluateRule(
    skuRequiredRule,
    targetFor(),
    validated,
    makeContext(),
  )[0];

  assert.equal(result.status, "NOT_APPLICABLE");
  assert.equal(result.reasonCode, "RULE_DISABLED");
});

test("rule exceptions degrade to UNKNOWN instead of creating false failures", () => {
  const explodingRule: RuleDefinition<Record<string, never>> = {
    code: "CG-TEST-001",
    version: 1,
    family: "TEST",
    target: "PRODUCT",
    configSchema: { parse: () => ({}) },
    evaluate() {
      throw new TypeError("boom");
    },
  };

  const validated = validatePolicyRule(
    explodingRule,
    policyInput(explodingRule),
  );

  const result = evaluateRule(
    explodingRule,
    targetFor(),
    validated,
    makeContext(),
  )[0];

  assert.equal(result.status, "UNKNOWN");
  assert.equal(result.reasonCode, "RULE_EXCEPTION");
  assert.deepEqual(result.evidence, { errorName: "TypeError" });
});

test("every first-slice rule returns scoped NOT_APPLICABLE", () => {
  const rules: readonly [RuleDefinition<unknown>, unknown][] = [
    [skuRequiredRule, {}],
    [skuUniqueRule as RuleDefinition<unknown>, {}],
    [barcodeRequiredRule, {}],
    [barcodeUniqueRule as RuleDefinition<unknown>, {}],
    [minimumPriceRule as RuleDefinition<unknown>, { minimum: "1.00" }],
    [compareAtRelationshipRule, {}],
    [descriptionRequiredRule as RuleDefinition<unknown>, { minLength: 1 }],
  ];

  const statuses: RuleStatus[] = rules.map(([rule, config]) => {
    const validated = validatePolicyRule(
      rule,
      policyInput(rule, config, { statuses: ["DRAFT"] }),
    );
    return evaluateRule(rule, targetFor(), validated, makeContext())[0].status;
  });

  assert.deepEqual(statuses, Array(rules.length).fill("NOT_APPLICABLE"));
});
