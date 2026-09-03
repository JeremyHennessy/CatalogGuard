import {
  RuleConfigError,
  asObject,
  rejectUnknownKeys,
  schema,
} from "../config";
import type { RuleDefinition } from "../contracts";
import { resultForTarget } from "../contracts";
import { unavailableFieldResult } from "./shared";

type RequiredOptionNamesConfig = {
  requiredNames: readonly string[];
};

export const requiredOptionNamesRule: RuleDefinition<RequiredOptionNamesConfig> = {
  code: "CG-OPT-001",
  version: 1,
  family: "OPTIONS",
  target: "VARIANT",
  configSchema: schema((input) => {
    const object = asObject(input, "CG-OPT-001");
    rejectUnknownKeys(object, ["requiredNames"], "CG-OPT-001");

    if (!Array.isArray(object.requiredNames) || object.requiredNames.length === 0) {
      throw new RuleConfigError(
        "CG-OPT-001",
        "requiredNames must be a non-empty array",
      );
    }

    const requiredNames = object.requiredNames.map((name) => {
      if (typeof name !== "string" || name.trim().length === 0) {
        throw new RuleConfigError(
          "CG-OPT-001",
          "requiredNames entries must be non-empty strings",
        );
      }

      return name;
    });

    return { requiredNames: [...new Set(requiredNames)] };
  }),
  evaluate(target, config) {
    const selectedOptions = target.variant!.selectedOptions;

    if (selectedOptions.availability !== "AVAILABLE") {
      return [
        unavailableFieldResult(
          requiredOptionNamesRule as RuleDefinition<unknown>,
          target,
          "selectedOptions",
          selectedOptions,
        ),
      ];
    }

    const observedNames = [...new Set(selectedOptions.value.map((option) => option.name))];
    const missingNames = config.requiredNames.filter(
      (name) => !observedNames.includes(name),
    );

    if (missingNames.length > 0) {
      return [
        resultForTarget(
          requiredOptionNamesRule,
          target,
          "FAIL",
          "Variant is missing one or more required option names.",
          {
            reasonCode: "REQUIRED_OPTION_NAMES_MISSING",
            observed: { optionNames: observedNames },
            expected: { requiredNames: config.requiredNames },
            evidence: { missingNames },
          },
        ),
      ];
    }

    return [
      resultForTarget(
        requiredOptionNamesRule,
        target,
        "PASS",
        "Variant contains all required option names.",
        {
          observed: { optionNames: observedNames },
          expected: { requiredNames: config.requiredNames },
        },
      ),
    ];
  },
};
