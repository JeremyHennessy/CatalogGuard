import type { RuleDefinition } from "../contracts";
import { resultForTarget } from "../contracts";
import { emptyConfigSchema, unavailableFieldResult } from "./shared";

export const categoryRequiredRule: RuleDefinition<Record<string, never>> = {
  code: "CG-CAT-001",
  version: 1,
  family: "COMPLETENESS",
  target: "PRODUCT",
  configSchema: emptyConfigSchema("CG-CAT-001"),
  evaluate(target) {
    const category = target.product.categoryGid;

    if (category.availability !== "AVAILABLE") {
      return [
        unavailableFieldResult(
          categoryRequiredRule as RuleDefinition<unknown>,
          target,
          "categoryGid",
          category,
        ),
      ];
    }

    if (category.value === null || category.value.trim().length === 0) {
      return [
        resultForTarget(
          categoryRequiredRule,
          target,
          "FAIL",
          "Shopify category is required.",
          {
            reasonCode: "CATEGORY_MISSING",
            observed: category.value,
            expected: "non-empty Shopify category GID",
          },
        ),
      ];
    }

    return [
      resultForTarget(
        categoryRequiredRule,
        target,
        "PASS",
        "Shopify category is present.",
        { observed: category.value },
      ),
    ];
  },
};
