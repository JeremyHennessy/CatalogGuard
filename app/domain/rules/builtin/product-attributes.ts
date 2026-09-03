import type { FieldEvidence } from "../../catalog/model";
import {
  RuleConfigError,
  asObject,
  rejectUnknownKeys,
  schema,
} from "../config";
import type { RuleDefinition, RuleResult } from "../contracts";
import { resultForTarget } from "../contracts";
import { unavailableFieldResult } from "./shared";

type RequiredAllowedTextConfig = {
  allowedValues?: readonly string[];
};

function requiredAllowedTextSchema(ruleCode: string) {
  return schema<RequiredAllowedTextConfig>((input) => {
    const object = asObject(input, ruleCode);
    rejectUnknownKeys(object, ["allowedValues"], ruleCode);

    if (object.allowedValues === undefined) return {};

    if (
      !Array.isArray(object.allowedValues) ||
      object.allowedValues.length === 0
    ) {
      throw new RuleConfigError(
        ruleCode,
        "allowedValues must be a non-empty array when provided",
      );
    }

    const values = object.allowedValues.map((value) => {
      if (typeof value !== "string" || value.trim().length === 0) {
        throw new RuleConfigError(
          ruleCode,
          "allowedValues entries must be non-empty strings",
        );
      }
      return value;
    });

    return { allowedValues: [...new Set(values)] };
  });
}

function evaluateRequiredAllowedText(
  definition: RuleDefinition<RequiredAllowedTextConfig>,
  target: Parameters<typeof resultForTarget>[1],
  fieldName: string,
  label: string,
  field: FieldEvidence<string>,
  config: RequiredAllowedTextConfig,
  reasonPrefix: string,
): RuleResult[] {
  if (field.availability !== "AVAILABLE") {
    return [
      unavailableFieldResult(
        definition as RuleDefinition<unknown>,
        target,
        fieldName,
        field,
      ),
    ];
  }

  if (field.value.trim().length === 0) {
    return [
      resultForTarget(definition, target, "FAIL", `${label} is required.`, {
        reasonCode: `${reasonPrefix}_MISSING`,
        observed: field.value,
        expected: `non-empty ${label.toLowerCase()}`,
      }),
    ];
  }

  if (config.allowedValues && !config.allowedValues.includes(field.value)) {
    return [
      resultForTarget(
        definition,
        target,
        "FAIL",
        `${label} is not in the configured allowed values.`,
        {
          reasonCode: `${reasonPrefix}_NOT_ALLOWED`,
          observed: field.value,
          expected: { allowedValues: config.allowedValues },
        },
      ),
    ];
  }

  return [
    resultForTarget(definition, target, "PASS", `${label} is valid.`, {
      observed: field.value,
      ...(config.allowedValues
        ? { expected: { allowedValues: config.allowedValues } }
        : {}),
    }),
  ];
}

export const vendorRequiredRule: RuleDefinition<RequiredAllowedTextConfig> = {
  code: "CG-VENDOR-001",
  version: 1,
  family: "COMPLETENESS",
  target: "PRODUCT",
  configSchema: requiredAllowedTextSchema("CG-VENDOR-001"),
  evaluate(target, config) {
    return evaluateRequiredAllowedText(
      vendorRequiredRule,
      target,
      "vendor",
      "Vendor",
      target.product.vendor,
      config,
      "VENDOR",
    );
  },
};

export const productTypeRequiredRule: RuleDefinition<RequiredAllowedTextConfig> =
  {
    code: "CG-TYPE-001",
    version: 1,
    family: "COMPLETENESS",
    target: "PRODUCT",
    configSchema: requiredAllowedTextSchema("CG-TYPE-001"),
    evaluate(target, config) {
      return evaluateRequiredAllowedText(
        productTypeRequiredRule,
        target,
        "productType",
        "Product type",
        target.product.productType,
        config,
        "PRODUCT_TYPE",
      );
    },
  };
