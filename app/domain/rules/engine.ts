import type { EvaluationTargetV1 } from "../catalog/model";
import type {
  EvaluationContextV1,
  PolicyRuleInput,
  RuleDefinition,
  RuleResult,
  ValidatedPolicyRule,
} from "./contracts";
import { resultForTarget } from "./contracts";
import {
  evaluateProductScope,
  parseProductScopeV1,
} from "./scope";

export function validatePolicyRule<TConfig>(
  definition: RuleDefinition<TConfig>,
  input: PolicyRuleInput,
): ValidatedPolicyRule<TConfig> {
  if (input.ruleCode !== definition.code) {
    throw new Error(
      `policy rule code ${input.ruleCode} does not match ${definition.code}`,
    );
  }

  if (input.ruleVersion !== definition.version) {
    throw new Error(
      `policy rule version ${input.ruleVersion} does not match ${definition.version}`,
    );
  }

  return {
    ...input,
    config: definition.configSchema.parse(input.config),
    scope: parseProductScopeV1(input.scope),
  };
}

export function evaluateRule<TConfig>(
  definition: RuleDefinition<TConfig>,
  target: EvaluationTargetV1,
  validatedRule: ValidatedPolicyRule<TConfig>,
  context: EvaluationContextV1,
): RuleResult[] {
  if (!validatedRule.enabled) {
    return [
      resultForTarget(
        definition,
        target,
        "NOT_APPLICABLE",
        "Rule is disabled.",
        { reasonCode: "RULE_DISABLED" },
      ),
    ];
  }

  if (definition.target === "VARIANT" && !target.variant) {
    return [
      resultForTarget(
        definition,
        target,
        "UNKNOWN",
        "Variant rule received no variant target.",
        { reasonCode: "TARGET_VARIANT_MISSING" },
      ),
    ];
  }

  const scope = evaluateProductScope(target.product, validatedRule.scope);

  if (scope.status === "NO_MATCH") {
    return [
      resultForTarget(
        definition,
        target,
        "NOT_APPLICABLE",
        "Resource is outside the configured rule scope.",
        { reasonCode: scope.reasonCode },
      ),
    ];
  }

  if (scope.status === "UNKNOWN") {
    return [
      resultForTarget(
        definition,
        target,
        "UNKNOWN",
        `Rule scope could not be determined because ${scope.field} evidence is unavailable.`,
        {
          reasonCode: scope.reasonCode,
          evidence: { scopeField: scope.field },
        },
      ),
    ];
  }

  try {
    return definition.evaluate(target, validatedRule.config, context);
  } catch (error) {
    return [
      resultForTarget(
        definition,
        target,
        "UNKNOWN",
        "Rule evaluation raised an internal exception.",
        {
          reasonCode: "RULE_EXCEPTION",
          evidence: {
            errorName: error instanceof Error ? error.name : "UnknownError",
          },
        },
      ),
    ];
  }
}
