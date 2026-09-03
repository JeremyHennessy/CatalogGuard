import type { FieldEvidence } from "../../catalog/model";
import {
  asObject,
  parsePositiveInteger,
  rejectUnknownKeys,
  schema,
} from "../config";
import type { RuleDefinition, RuleResult } from "../contracts";
import { resultForTarget } from "../contracts";
import { unavailableFieldResult } from "./shared";

type SeoTextConfig = {
  minLength: number;
};

function seoTextSchema(ruleCode: string) {
  return schema<SeoTextConfig>((input) => {
    const object = asObject(input, ruleCode);
    rejectUnknownKeys(object, ["minLength"], ruleCode);

    return {
      minLength: parsePositiveInteger(
        object.minLength,
        ruleCode,
        "minLength",
        1,
      ),
    };
  });
}

function evaluateSeoText(
  definition: RuleDefinition<SeoTextConfig>,
  target: Parameters<typeof resultForTarget>[1],
  fieldName: string,
  label: string,
  field: FieldEvidence<string | null>,
  config: SeoTextConfig,
  reasonCode: string,
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

  const observedLength = (field.value ?? "").trim().length;

  if (observedLength < config.minLength) {
    return [
      resultForTarget(
        definition,
        target,
        "FAIL",
        `${label} is shorter than the configured minimum.`,
        {
          reasonCode,
          observed: { value: field.value, length: observedLength },
          expected: { minLength: config.minLength },
        },
      ),
    ];
  }

  return [
    resultForTarget(
      definition,
      target,
      "PASS",
      `${label} meets the configured minimum length.`,
      {
        observed: { value: field.value, length: observedLength },
        expected: { minLength: config.minLength },
      },
    ),
  ];
}

export const seoTitleRequiredRule: RuleDefinition<SeoTextConfig> = {
  code: "CG-SEO-001",
  version: 1,
  family: "SEO",
  target: "PRODUCT",
  configSchema: seoTextSchema("CG-SEO-001"),
  evaluate(target, config) {
    return evaluateSeoText(
      seoTitleRequiredRule,
      target,
      "seoTitle",
      "SEO title",
      target.product.seoTitle,
      config,
      "SEO_TITLE_TOO_SHORT",
    );
  },
};

export const seoDescriptionRequiredRule: RuleDefinition<SeoTextConfig> = {
  code: "CG-SEO-002",
  version: 1,
  family: "SEO",
  target: "PRODUCT",
  configSchema: seoTextSchema("CG-SEO-002"),
  evaluate(target, config) {
    return evaluateSeoText(
      seoDescriptionRequiredRule,
      target,
      "seoDescription",
      "SEO description",
      target.product.seoDescription,
      config,
      "SEO_DESCRIPTION_TOO_SHORT",
    );
  },
};
