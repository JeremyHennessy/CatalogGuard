import type {
  PolicyRuleInput,
  RuleDefinition,
  ValidatedPolicyRule,
} from "../rules/contracts";
import { validatePolicyRule } from "../rules/engine";
import type { RuleRegistry } from "../rules/registry";

export const POLICY_SCHEMA_VERSION = 1 as const;

export type PolicyRevisionInputV1 = {
  schemaVersion: typeof POLICY_SCHEMA_VERSION;
  id: string;
  policyId: string;
  revisionNumber: number;
  createdAt: string;
  rules: readonly PolicyRuleInput[];
};

export type ValidatedPolicyRuleEntryV1 = Readonly<{
  definition: RuleDefinition<unknown>;
  rule: Readonly<ValidatedPolicyRule<unknown>>;
}>;

export type ValidatedPolicyRevisionV1 = Readonly<{
  schemaVersion: typeof POLICY_SCHEMA_VERSION;
  id: string;
  policyId: string;
  revisionNumber: number;
  createdAt: string;
  rules: readonly ValidatedPolicyRuleEntryV1[];
}>;

function requireNonEmpty(value: string, field: string) {
  if (value.trim().length === 0) {
    throw new Error(`${field} must be non-empty`);
  }
}

function requireIsoDate(value: string, field: string) {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw new Error(`${field} must be an ISO date-time`);
  }
}

function freezeValidatedRule<TConfig>(
  rule: ValidatedPolicyRule<TConfig>,
): Readonly<ValidatedPolicyRule<TConfig>> {
  return Object.freeze({ ...rule });
}

export function validatePolicyRevisionV1(
  registry: RuleRegistry,
  input: PolicyRevisionInputV1,
): ValidatedPolicyRevisionV1 {
  if (input.schemaVersion !== POLICY_SCHEMA_VERSION) {
    throw new Error(
      `unsupported policy schema version: ${input.schemaVersion}`,
    );
  }

  requireNonEmpty(input.id, "policy revision id");
  requireNonEmpty(input.policyId, "policy id");
  requireIsoDate(input.createdAt, "policy revision createdAt");

  if (!Number.isInteger(input.revisionNumber) || input.revisionNumber < 1) {
    throw new Error("policy revision number must be a positive integer");
  }

  const seenRules = new Set<string>();
  const rules = input.rules.map((policyRule) => {
    const key = `${policyRule.ruleCode}@${policyRule.ruleVersion}`;

    if (seenRules.has(key)) {
      throw new Error(`duplicate policy rule: ${key}`);
    }

    seenRules.add(key);
    const definition = registry.get(
      policyRule.ruleCode,
      policyRule.ruleVersion,
    );
    const rule = freezeValidatedRule(
      validatePolicyRule(definition, policyRule),
    );

    return Object.freeze({ definition, rule });
  });

  return Object.freeze({
    schemaVersion: POLICY_SCHEMA_VERSION,
    id: input.id,
    policyId: input.policyId,
    revisionNumber: input.revisionNumber,
    createdAt: input.createdAt,
    rules: Object.freeze(rules),
  });
}
