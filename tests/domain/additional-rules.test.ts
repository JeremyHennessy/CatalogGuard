import * as assert from "node:assert/strict";
import { test } from "node:test";
import { available, unavailable } from "../../app/domain/catalog/model";
import { categoryRequiredRule } from "../../app/domain/rules/builtin/category";
import { requiredOptionNamesRule } from "../../app/domain/rules/builtin/options";
import {
  seoDescriptionRequiredRule,
  seoTitleRequiredRule,
} from "../../app/domain/rules/builtin/seo";
import { requiredTagsRule } from "../../app/domain/rules/builtin/tags";
import { RuleConfigError } from "../../app/domain/rules/config";
import type {
  PolicyRuleInput,
  RuleDefinition,
} from "../../app/domain/rules/contracts";
import {
  evaluateRule,
  validatePolicyRule,
} from "../../app/domain/rules/engine";
import { makeContext, makeProduct, makeVariant } from "./fixtures";

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

function targetFor(product = makeProduct(), variant = product.variants[0]) {
  return { product, variant };
}

function evaluate<TConfig>(
  definition: RuleDefinition<TConfig>,
  target: ReturnType<typeof targetFor>,
  config: unknown = {},
  scope?: unknown,
) {
  const validated = validatePolicyRule(
    definition,
    policyInput(definition as RuleDefinition<unknown>, config, scope),
  );

  return evaluateRule(definition, target, validated, makeContext())[0];
}

test("SEO title rule covers boundary, failure, unknown evidence, and invalid config", () => {
  assert.equal(
    evaluate(
      seoTitleRequiredRule,
      targetFor(makeProduct({ seoTitle: available("abcd") })),
      { minLength: 4 },
    ).status,
    "PASS",
  );

  assert.equal(
    evaluate(
      seoTitleRequiredRule,
      targetFor(makeProduct({ seoTitle: available("abc") })),
      { minLength: 4 },
    ).status,
    "FAIL",
  );

  assert.equal(
    evaluate(
      seoTitleRequiredRule,
      targetFor(makeProduct({ seoTitle: available(null) })),
    ).status,
    "FAIL",
  );

  assert.equal(
    evaluate(
      seoTitleRequiredRule,
      targetFor(makeProduct({ seoTitle: unavailable("not fetched") })),
    ).status,
    "UNKNOWN",
  );

  assert.throws(
    () =>
      validatePolicyRule(
        seoTitleRequiredRule,
        policyInput(seoTitleRequiredRule, { minLength: 0 }),
      ),
    RuleConfigError,
  );
});

test("SEO description rule covers pass, fail, and unknown evidence", () => {
  assert.equal(
    evaluate(
      seoDescriptionRequiredRule,
      targetFor(makeProduct({ seoDescription: available("description") })),
      { minLength: 5 },
    ).status,
    "PASS",
  );

  assert.equal(
    evaluate(
      seoDescriptionRequiredRule,
      targetFor(makeProduct({ seoDescription: available("   ") })),
      { minLength: 1 },
    ).status,
    "FAIL",
  );

  assert.equal(
    evaluate(
      seoDescriptionRequiredRule,
      targetFor(makeProduct({ seoDescription: unavailable("not requested") })),
    ).status,
    "UNKNOWN",
  );
});

test("category rule requires an available non-empty Shopify category", () => {
  assert.equal(evaluate(categoryRequiredRule, targetFor()).status, "PASS");

  assert.equal(
    evaluate(
      categoryRequiredRule,
      targetFor(makeProduct({ categoryGid: available(null) })),
    ).status,
    "FAIL",
  );

  assert.equal(
    evaluate(
      categoryRequiredRule,
      targetFor(makeProduct({ categoryGid: available("   ") })),
    ).status,
    "FAIL",
  );

  assert.equal(
    evaluate(
      categoryRequiredRule,
      targetFor(makeProduct({ categoryGid: unavailable("not fetched") })),
    ).status,
    "UNKNOWN",
  );

  assert.throws(
    () =>
      validatePolicyRule(
        categoryRequiredRule,
        policyInput(categoryRequiredRule, { arbitrary: true }),
      ),
    RuleConfigError,
  );
});

test("required tags use exact explicit ALL or ANY matching", () => {
  assert.equal(
    evaluate(requiredTagsRule, targetFor(), {
      requiredTags: ["summer", "featured"],
      match: "ALL",
    }).status,
    "PASS",
  );

  assert.equal(
    evaluate(requiredTagsRule, targetFor(), {
      requiredTags: ["summer", "missing"],
      match: "ALL",
    }).status,
    "FAIL",
  );

  assert.equal(
    evaluate(requiredTagsRule, targetFor(), {
      requiredTags: ["missing", "featured"],
      match: "ANY",
    }).status,
    "PASS",
  );

  assert.equal(
    evaluate(
      requiredTagsRule,
      targetFor(makeProduct({ tags: unavailable("tags not fetched") })),
      { requiredTags: ["summer"] },
    ).status,
    "UNKNOWN",
  );

  assert.throws(
    () =>
      validatePolicyRule(
        requiredTagsRule,
        policyInput(requiredTagsRule, { requiredTags: [] }),
      ),
    RuleConfigError,
  );
});

test("required option names evaluate exact variant option names", () => {
  const variant = makeVariant({
    selectedOptions: available([
      { name: "Size", value: "M" },
      { name: "Color", value: "Blue" },
    ]),
  });
  const product = makeProduct({ variants: [variant] });

  assert.equal(
    evaluate(requiredOptionNamesRule, targetFor(product, variant), {
      requiredNames: ["Size", "Color"],
    }).status,
    "PASS",
  );

  assert.equal(
    evaluate(requiredOptionNamesRule, targetFor(product, variant), {
      requiredNames: ["Size", "Material"],
    }).status,
    "FAIL",
  );

  const unavailableVariant = makeVariant({
    selectedOptions: unavailable("options not fetched"),
  });
  assert.equal(
    evaluate(
      requiredOptionNamesRule,
      targetFor(
        makeProduct({ variants: [unavailableVariant] }),
        unavailableVariant,
      ),
      { requiredNames: ["Size"] },
    ).status,
    "UNKNOWN",
  );

  assert.throws(
    () =>
      validatePolicyRule(
        requiredOptionNamesRule,
        policyInput(requiredOptionNamesRule, { requiredNames: [] }),
      ),
    RuleConfigError,
  );
});

test("new rules preserve scoped NOT_APPLICABLE semantics", () => {
  const rules: readonly [RuleDefinition<unknown>, unknown][] = [
    [seoTitleRequiredRule as RuleDefinition<unknown>, {}],
    [seoDescriptionRequiredRule as RuleDefinition<unknown>, {}],
    [categoryRequiredRule, {}],
    [requiredTagsRule as RuleDefinition<unknown>, { requiredTags: ["summer"] }],
    [
      requiredOptionNamesRule as RuleDefinition<unknown>,
      { requiredNames: ["Size"] },
    ],
  ];

  for (const [rule, config] of rules) {
    const validated = validatePolicyRule(
      rule,
      policyInput(rule, config, { statuses: ["DRAFT"] }),
    );
    const result = evaluateRule(rule, targetFor(), validated, makeContext())[0];
    assert.equal(result.status, "NOT_APPLICABLE", rule.code);
  }
});
