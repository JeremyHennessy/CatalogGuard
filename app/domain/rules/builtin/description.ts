import type { RuleDefinition } from "../contracts";
import { resultForTarget } from "../contracts";
import {
  asObject,
  parsePositiveInteger,
  rejectUnknownKeys,
  schema,
} from "../config";
import { unavailableFieldResult } from "./shared";

type DescriptionRequiredConfig = {
  minLength: number;
};

export const descriptionRequiredRule: RuleDefinition<DescriptionRequiredConfig> =
  {
    code: "CG-DESC-001",
    version: 1,
    family: "COMPLETENESS",
    target: "PRODUCT",
    configSchema: schema((input) => {
      const object = asObject(input, "CG-DESC-001");
      rejectUnknownKeys(object, ["minLength"], "CG-DESC-001");

      return {
        minLength: parsePositiveInteger(
          object.minLength,
          "CG-DESC-001",
          "minLength",
          1,
        ),
      };
    }),
    evaluate(target, config) {
      const description = target.product.descriptionText;

      if (description.availability !== "AVAILABLE") {
        return [
          unavailableFieldResult(
            descriptionRequiredRule as RuleDefinition<unknown>,
            target,
            "descriptionText",
            description,
          ),
        ];
      }

      const observedLength = description.value.trim().length;

      if (observedLength < config.minLength) {
        return [
          resultForTarget(
            descriptionRequiredRule,
            target,
            "FAIL",
            "Product description is shorter than the configured minimum.",
            {
              reasonCode: "DESCRIPTION_TOO_SHORT",
              observed: { length: observedLength },
              expected: { minLength: config.minLength },
            },
          ),
        ];
      }

      return [
        resultForTarget(
          descriptionRequiredRule,
          target,
          "PASS",
          "Product description meets the configured minimum length.",
          {
            observed: { length: observedLength },
            expected: { minLength: config.minLength },
          },
        ),
      ];
    },
  };
