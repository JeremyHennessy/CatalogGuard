import type { PolicyRevisionInputV1 } from "../domain/policy/contracts";
import type { RuleSeverity } from "../domain/rules/contracts";

export type PolicyRuleControlEditV1 = Readonly<{
  ruleCode: string;
  ruleVersion: number;
  enabled: boolean;
  severity: RuleSeverity;
  blocking: boolean;
}>;

function requireNonEmpty(value: string, field: string) {
  if (value.trim().length === 0) {
    throw new Error(`${field} must be non-empty`);
  }
}

function ruleKey(ruleCode: string, ruleVersion: number) {
  return `${ruleCode}@${ruleVersion}`;
}

export function nextPolicyRevisionIdV1(
  policyId: string,
  revisionNumber: number,
) {
  requireNonEmpty(policyId, "policyId");
  if (!Number.isInteger(revisionNumber) || revisionNumber < 1) {
    throw new Error("revisionNumber must be a positive integer");
  }

  return `${policyId}:r${revisionNumber}`;
}

export function buildNextPolicyRevisionInputV1(input: {
  current: PolicyRevisionInputV1;
  createdAt: string;
  edits: readonly PolicyRuleControlEditV1[];
}): PolicyRevisionInputV1 {
  const nextNumber = input.current.revisionNumber + 1;
  const editByKey = new Map<string, PolicyRuleControlEditV1>();

  for (const edit of input.edits) {
    requireNonEmpty(edit.ruleCode, "ruleCode");
    const key = ruleKey(edit.ruleCode, edit.ruleVersion);
    if (editByKey.has(key)) {
      throw new Error(`duplicate policy rule edit: ${key}`);
    }
    editByKey.set(key, edit);
  }

  const existingKeys = new Set(
    input.current.rules.map((rule) => ruleKey(rule.ruleCode, rule.ruleVersion)),
  );
  for (const key of editByKey.keys()) {
    if (!existingKeys.has(key)) {
      throw new Error(
        `policy rule edit does not match active revision: ${key}`,
      );
    }
  }

  return {
    schemaVersion: input.current.schemaVersion,
    id: nextPolicyRevisionIdV1(input.current.policyId, nextNumber),
    policyId: input.current.policyId,
    revisionNumber: nextNumber,
    createdAt: input.createdAt,
    rules: input.current.rules.map((rule) => {
      const edit = editByKey.get(ruleKey(rule.ruleCode, rule.ruleVersion));
      if (!edit) {
        return {
          ...rule,
          config: rule.config,
          scope: rule.scope,
        };
      }

      return {
        ...rule,
        enabled: edit.enabled,
        severity: edit.severity,
        blocking: edit.blocking,
        config: rule.config,
        scope: rule.scope,
      };
    }),
  };
}
