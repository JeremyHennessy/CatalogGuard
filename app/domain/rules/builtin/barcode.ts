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

export const barcodeRequiredRule: RuleDefinition<Record<string, never>> = {
  code: "CG-BARCODE-001",
  version: 1,
  family: "BARCODE",
  target: "VARIANT",
  configSchema: emptyConfigSchema("CG-BARCODE-001"),
  evaluate(target) {
    const barcode = target.variant!.barcode;

    if (barcode.availability !== "AVAILABLE") {
      return [
        unavailableFieldResult(
          barcodeRequiredRule as RuleDefinition<unknown>,
          target,
          "barcode",
          barcode,
        ),
      ];
    }

    if (isBlankIdentifier(barcode.value)) {
      return [
        resultForTarget(
          barcodeRequiredRule,
          target,
          "FAIL",
          "Barcode is required.",
          {
            reasonCode: "BARCODE_MISSING",
            observed: barcode.value,
            expected: "non-empty barcode",
          },
        ),
      ];
    }

    return [
      resultForTarget(
        barcodeRequiredRule,
        target,
        "PASS",
        "Barcode is present.",
        { observed: barcode.value },
      ),
    ];
  },
};

type BarcodeUniqueConfig = {
  normalization: IdentifierNormalizationMode;
};

export const barcodeUniqueRule: RuleDefinition<BarcodeUniqueConfig> = {
  code: "CG-BARCODE-002",
  version: 1,
  family: "BARCODE",
  target: "VARIANT",
  configSchema: schema((input) => {
    const object = asObject(input, "CG-BARCODE-002");
    rejectUnknownKeys(object, ["normalization"], "CG-BARCODE-002");

    return {
      normalization: parseStringEnum(
        object.normalization,
        ["EXACT", "TRIM"] as const,
        "CG-BARCODE-002",
        "normalization",
        "EXACT",
      ),
    };
  }),
  evaluate(target, config, context) {
    const barcode = target.variant!.barcode;

    if (barcode.availability !== "AVAILABLE") {
      return [
        unavailableFieldResult(
          barcodeUniqueRule as RuleDefinition<unknown>,
          target,
          "barcode",
          barcode,
        ),
      ];
    }

    if (isBlankIdentifier(barcode.value)) {
      return [
        resultForTarget(
          barcodeUniqueRule,
          target,
          "NOT_APPLICABLE",
          "Barcode uniqueness is not evaluated for an empty barcode.",
          { reasonCode: "BARCODE_EMPTY" },
        ),
      ];
    }

    const lookup = context.identifierIndex.lookup(
      "BARCODE",
      barcode.value as string,
      config.normalization,
    );

    if (lookup.completeness !== "COMPLETE") {
      return [
        resultForTarget(
          barcodeUniqueRule,
          target,
          "UNKNOWN",
          "Barcode uniqueness cannot be determined from a partial identifier index.",
          {
            reasonCode: "IDENTIFIER_INDEX_PARTIAL",
            observed: barcode.value,
            evidence: { normalization: config.normalization },
          },
        ),
      ];
    }

    if (!lookup.matches.some((match) => match.variantGid === target.variant!.gid)) {
      return [
        resultForTarget(
          barcodeUniqueRule,
          target,
          "UNKNOWN",
          "Barcode identifier index is inconsistent with the evaluated variant.",
          {
            reasonCode: "IDENTIFIER_INDEX_MISS",
            observed: barcode.value,
            evidence: { normalization: config.normalization },
          },
        ),
      ];
    }

    if (lookup.matches.length > 1) {
      return [
        resultForTarget(
          barcodeUniqueRule,
          target,
          "FAIL",
          "Barcode is used by more than one variant.",
          {
            reasonCode: "BARCODE_DUPLICATE",
            observed: barcode.value,
            expected: "unique barcode",
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
        barcodeUniqueRule,
        target,
        "PASS",
        "Barcode is unique.",
        {
          observed: barcode.value,
          evidence: { normalization: config.normalization },
        },
      ),
    ];
  },
};
