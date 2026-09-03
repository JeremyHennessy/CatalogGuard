import type { RuleDefinition } from "../contracts";
import { resultForTarget } from "../contracts";
import {
  type IdentifierNormalizationMode,
  isBlankIdentifier,
} from "../identifier-index";
import {
  asObject,
  parseStringEnum,
  rejectUnknownKeys,
  schema,
} from "../config";
import {
  emptyConfigSchema,
  unavailableFieldResult,
} from "./shared";

export const skuRequiredRule: RuleDefinition<Record<string, never>> = {
  code: "CG-SKU-001",
  version: 1,
  family: "SKU",
  target: "VARIANT",
  configSchema: emptyConfigSchema("CG-SKU-001"),
  evaluate(target) {
    const sku = target.variant!.sku;

    if (sku.availability !== "AVAILABLE") {
      return [
        unavailableFieldResult(
          skuRequiredRule as RuleDefinition<unknown>,
          target,
          "sku",
          sku,
        ),
      ];
    }

    if (isBlankIdentifier(sku.value)) {
      return [
        resultForTarget(
          skuRequiredRule,
          target,
          "FAIL",
          "SKU is required.",
          {
            reasonCode: "SKU_MISSING",
            observed: sku.value,
            expected: "non-empty SKU",
          },
        ),
      ];
    }

    return [
      resultForTarget(
        skuRequiredRule,
        target,
        "PASS",
        "SKU is present.",
        { observed: sku.value },
      ),
    ];
  },
};

type SkuUniqueConfig = {
  normalization: IdentifierNormalizationMode;
};

export const skuUniqueRule: RuleDefinition<SkuUniqueConfig> = {
  code: "CG-SKU-002",
  version: 1,
  family: "SKU",
  target: "VARIANT",
  configSchema: schema((input) => {
    const object = asObject(input, "CG-SKU-002");
    rejectUnknownKeys(object, ["normalization"], "CG-SKU-002");

    return {
      normalization: parseStringEnum(
        object.normalization,
        ["EXACT", "TRIM"] as const,
        "CG-SKU-002",
        "normalization",
        "EXACT",
      ),
    };
  }),
  evaluate(target, config, context) {
    const sku = target.variant!.sku;

    if (sku.availability !== "AVAILABLE") {
      return [
        unavailableFieldResult(
          skuUniqueRule as RuleDefinition<unknown>,
          target,
          "sku",
          sku,
        ),
      ];
    }

    if (isBlankIdentifier(sku.value)) {
      return [
        resultForTarget(
          skuUniqueRule,
          target,
          "NOT_APPLICABLE",
          "SKU uniqueness is not evaluated for an empty SKU.",
          { reasonCode: "SKU_EMPTY" },
        ),
      ];
    }

    const lookup = context.identifierIndex.lookup(
      "SKU",
      sku.value as string,
      config.normalization,
    );

    if (lookup.completeness !== "COMPLETE") {
      return [
        resultForTarget(
          skuUniqueRule,
          target,
          "UNKNOWN",
          "SKU uniqueness cannot be determined from a partial identifier index.",
          {
            reasonCode: "IDENTIFIER_INDEX_PARTIAL",
            observed: sku.value,
            evidence: { normalization: config.normalization },
          },
        ),
      ];
    }

    if (!lookup.matches.some((match) => match.variantGid === target.variant!.gid)) {
      return [
        resultForTarget(
          skuUniqueRule,
          target,
          "UNKNOWN",
          "SKU identifier index is inconsistent with the evaluated variant.",
          {
            reasonCode: "IDENTIFIER_INDEX_MISS",
            observed: sku.value,
            evidence: { normalization: config.normalization },
          },
        ),
      ];
    }

    if (lookup.matches.length > 1) {
      return [
        resultForTarget(
          skuUniqueRule,
          target,
          "FAIL",
          "SKU is used by more than one variant.",
          {
            reasonCode: "SKU_DUPLICATE",
            observed: sku.value,
            expected: "unique SKU",
            evidence: {
              normalization: config.normalization,
              variantGids: lookup.matches.map((match) => match.variantGid),
            },
          },
        ),
      ];
    }

    return [
      resultForTarget(
        skuUniqueRule,
        target,
        "PASS",
        "SKU is unique.",
        {
          observed: sku.value,
          evidence: { normalization: config.normalization },
        },
      ),
    ];
  },
};
