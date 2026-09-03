import type { RuleDefinition } from "../contracts";
import { resultForTarget } from "../contracts";
import {
  asObject,
  isNonNegativeDecimal,
  parseNonNegativeDecimal,
  rejectUnknownKeys,
  schema,
} from "../config";
import { compareDecimalStrings } from "../decimal";
import {
  emptyConfigSchema,
  unavailableFieldResult,
} from "./shared";

type MinimumPriceConfig = {
  minimum: string;
};

export const minimumPriceRule: RuleDefinition<MinimumPriceConfig> = {
  code: "CG-PRICE-001",
  version: 1,
  family: "PRICING",
  target: "VARIANT",
  configSchema: schema((input) => {
    const object = asObject(input, "CG-PRICE-001");
    rejectUnknownKeys(object, ["minimum"], "CG-PRICE-001");

    return {
      minimum: parseNonNegativeDecimal(
        object.minimum,
        "CG-PRICE-001",
        "minimum",
      ),
    };
  }),
  evaluate(target, config) {
    const price = target.variant!.price;

    if (price.availability !== "AVAILABLE") {
      return [
        unavailableFieldResult(
          minimumPriceRule as RuleDefinition<unknown>,
          target,
          "price",
          price,
        ),
      ];
    }

    if (!isNonNegativeDecimal(price.value)) {
      return [
        resultForTarget(
          minimumPriceRule,
          target,
          "UNKNOWN",
          "Price source value is not a valid non-negative decimal.",
          {
            reasonCode: "PRICE_SOURCE_INVALID",
            observed: price.value,
          },
        ),
      ];
    }

    if (compareDecimalStrings(price.value, config.minimum) < 0) {
      return [
        resultForTarget(
          minimumPriceRule,
          target,
          "FAIL",
          "Price is below the configured minimum.",
          {
            reasonCode: "PRICE_BELOW_MINIMUM",
            observed: price.value,
            expected: { minimum: config.minimum },
          },
        ),
      ];
    }

    return [
      resultForTarget(
        minimumPriceRule,
        target,
        "PASS",
        "Price meets the configured minimum.",
        {
          observed: price.value,
          expected: { minimum: config.minimum },
        },
      ),
    ];
  },
};

export const compareAtRelationshipRule: RuleDefinition<Record<string, never>> =
  {
    code: "CG-PRICE-002",
    version: 1,
    family: "PRICING",
    target: "VARIANT",
    configSchema: emptyConfigSchema("CG-PRICE-002"),
    evaluate(target) {
      const price = target.variant!.price;
      const compareAt = target.variant!.compareAtPrice;

      if (compareAt.availability !== "AVAILABLE") {
        return [
          unavailableFieldResult(
            compareAtRelationshipRule as RuleDefinition<unknown>,
            target,
            "compareAtPrice",
            compareAt,
          ),
        ];
      }

      if (compareAt.value === null) {
        return [
          resultForTarget(
            compareAtRelationshipRule,
            target,
            "NOT_APPLICABLE",
            "Compare-at relationship is not applicable when no compare-at price is set.",
            { reasonCode: "COMPARE_AT_NOT_SET" },
          ),
        ];
      }

      if (price.availability !== "AVAILABLE") {
        return [
          unavailableFieldResult(
            compareAtRelationshipRule as RuleDefinition<unknown>,
            target,
            "price",
            price,
          ),
        ];
      }

      if (
        !isNonNegativeDecimal(price.value) ||
        !isNonNegativeDecimal(compareAt.value)
      ) {
        return [
          resultForTarget(
            compareAtRelationshipRule,
            target,
            "UNKNOWN",
            "Pricing source value is not a valid non-negative decimal.",
            {
              reasonCode: "PRICE_SOURCE_INVALID",
              observed: {
                price: price.value,
                compareAtPrice: compareAt.value,
              },
            },
          ),
        ];
      }

      if (compareDecimalStrings(compareAt.value, price.value) <= 0) {
        return [
          resultForTarget(
            compareAtRelationshipRule,
            target,
            "FAIL",
            "Compare-at price must be greater than price when present.",
            {
              reasonCode: "COMPARE_AT_NOT_GREATER",
              observed: {
                price: price.value,
                compareAtPrice: compareAt.value,
              },
              expected: "compareAtPrice > price",
            },
          ),
        ];
      }

      return [
        resultForTarget(
          compareAtRelationshipRule,
          target,
          "PASS",
          "Compare-at price is greater than price.",
          {
            observed: {
              price: price.value,
              compareAtPrice: compareAt.value,
            },
          },
        ),
      ];
    },
  };
