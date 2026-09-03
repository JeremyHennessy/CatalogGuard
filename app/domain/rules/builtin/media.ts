import {
  asObject,
  parsePositiveInteger,
  rejectUnknownKeys,
  schema,
} from "../config";
import type { RuleDefinition } from "../contracts";
import { resultForTarget } from "../contracts";
import { unavailableFieldResult } from "./shared";

type MinimumMediaConfig = {
  minimum: number;
};

export const minimumMediaRule: RuleDefinition<MinimumMediaConfig> = {
  code: "CG-MEDIA-001",
  version: 1,
  family: "MEDIA",
  target: "PRODUCT",
  configSchema: schema((input) => {
    const object = asObject(input, "CG-MEDIA-001");
    rejectUnknownKeys(object, ["minimum"], "CG-MEDIA-001");

    return {
      minimum: parsePositiveInteger(
        object.minimum,
        "CG-MEDIA-001",
        "minimum",
        1,
      ),
    };
  }),
  evaluate(target, config) {
    const mediaCount = target.product.mediaCount;

    if (mediaCount.availability !== "AVAILABLE") {
      return [
        unavailableFieldResult(
          minimumMediaRule as RuleDefinition<unknown>,
          target,
          "mediaCount",
          mediaCount,
        ),
      ];
    }

    if (!Number.isInteger(mediaCount.value) || mediaCount.value < 0) {
      return [
        resultForTarget(
          minimumMediaRule,
          target,
          "UNKNOWN",
          "Media count source value is invalid.",
          {
            reasonCode: "MEDIA_COUNT_SOURCE_INVALID",
            observed: mediaCount.value,
          },
        ),
      ];
    }

    if (mediaCount.value < config.minimum) {
      return [
        resultForTarget(
          minimumMediaRule,
          target,
          "FAIL",
          "Product has fewer media items than the configured minimum.",
          {
            reasonCode: "MEDIA_COUNT_BELOW_MINIMUM",
            observed: mediaCount.value,
            expected: { minimum: config.minimum },
          },
        ),
      ];
    }

    return [
      resultForTarget(
        minimumMediaRule,
        target,
        "PASS",
        "Product meets the configured minimum media count.",
        {
          observed: mediaCount.value,
          expected: { minimum: config.minimum },
        },
      ),
    ];
  },
};
