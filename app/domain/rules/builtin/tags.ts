import {
  RuleConfigError,
  asObject,
  parseStringEnum,
  rejectUnknownKeys,
  schema,
} from "../config";
import type { RuleDefinition } from "../contracts";
import { resultForTarget } from "../contracts";
import { unavailableFieldResult } from "./shared";

type RequiredTagsConfig = {
  requiredTags: readonly string[];
  match: "ALL" | "ANY";
};

export const requiredTagsRule: RuleDefinition<RequiredTagsConfig> = {
  code: "CG-TAG-001",
  version: 1,
  family: "COMPLETENESS",
  target: "PRODUCT",
  configSchema: schema((input) => {
    const object = asObject(input, "CG-TAG-001");
    rejectUnknownKeys(object, ["requiredTags", "match"], "CG-TAG-001");

    if (
      !Array.isArray(object.requiredTags) ||
      object.requiredTags.length === 0
    ) {
      throw new RuleConfigError(
        "CG-TAG-001",
        "requiredTags must be a non-empty array",
      );
    }

    const requiredTags = object.requiredTags.map((tag) => {
      if (typeof tag !== "string" || tag.trim().length === 0) {
        throw new RuleConfigError(
          "CG-TAG-001",
          "requiredTags entries must be non-empty strings",
        );
      }

      return tag;
    });

    return {
      requiredTags: [...new Set(requiredTags)],
      match: parseStringEnum(
        object.match,
        ["ALL", "ANY"] as const,
        "CG-TAG-001",
        "match",
        "ALL",
      ),
    };
  }),
  evaluate(target, config) {
    const tags = target.product.tags;

    if (tags.availability !== "AVAILABLE") {
      return [
        unavailableFieldResult(
          requiredTagsRule as RuleDefinition<unknown>,
          target,
          "tags",
          tags,
        ),
      ];
    }

    const matched = config.requiredTags.filter((tag) =>
      tags.value.includes(tag),
    );
    const passes =
      config.match === "ALL"
        ? matched.length === config.requiredTags.length
        : matched.length > 0;

    if (!passes) {
      return [
        resultForTarget(
          requiredTagsRule,
          target,
          "FAIL",
          "Product tags do not satisfy the configured required-tag policy.",
          {
            reasonCode: "REQUIRED_TAGS_MISSING",
            observed: { tags: tags.value, matched },
            expected: {
              requiredTags: config.requiredTags,
              match: config.match,
            },
          },
        ),
      ];
    }

    return [
      resultForTarget(
        requiredTagsRule,
        target,
        "PASS",
        "Product tags satisfy the configured required-tag policy.",
        {
          observed: { tags: tags.value, matched },
          expected: {
            requiredTags: config.requiredTags,
            match: config.match,
          },
        },
      ),
    ];
  },
};
