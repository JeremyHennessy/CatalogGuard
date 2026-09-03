import type {
  PolicyRevisionInputV1,
  ValidatedPolicyRevisionV1,
} from "../domain/policy/contracts";
import type { PolicyRuleInput, RuleSeverity } from "../domain/rules/contracts";
import { canonicalJsonStringify, parseCanonicalJson } from "./json";

export type PersistedPolicyRuleSnapshotV1 = Readonly<{
  ruleCode: string;
  ruleVersion: number;
  enabled: boolean;
  severity: RuleSeverity;
  blocking: boolean;
  configJson: string;
  scopeJson: string;
  position: number;
}>;

export type PersistedPolicyRevisionSnapshotV1 = Readonly<{
  id: string;
  policyId: string;
  revisionNumber: number;
  schemaVersion: number;
  createdAt: string;
  rules: readonly PersistedPolicyRuleSnapshotV1[];
}>;

export function snapshotValidatedPolicyRevisionV1(
  revision: ValidatedPolicyRevisionV1,
): PersistedPolicyRevisionSnapshotV1 {
  return Object.freeze({
    id: revision.id,
    policyId: revision.policyId,
    revisionNumber: revision.revisionNumber,
    schemaVersion: revision.schemaVersion,
    createdAt: revision.createdAt,
    rules: Object.freeze(
      revision.rules.map((entry, position) =>
        Object.freeze({
          ruleCode: entry.rule.ruleCode,
          ruleVersion: entry.rule.ruleVersion,
          enabled: entry.rule.enabled,
          severity: entry.rule.severity,
          blocking: entry.rule.blocking,
          configJson: canonicalJsonStringify(entry.rule.config),
          scopeJson: canonicalJsonStringify(entry.rule.scope),
          position,
        }),
      ),
    ),
  });
}

function ruleInputFromSnapshot(
  snapshot: PersistedPolicyRuleSnapshotV1,
): PolicyRuleInput {
  return {
    ruleCode: snapshot.ruleCode,
    ruleVersion: snapshot.ruleVersion,
    enabled: snapshot.enabled,
    severity: snapshot.severity,
    blocking: snapshot.blocking,
    config: parseCanonicalJson(snapshot.configJson),
    scope: parseCanonicalJson(snapshot.scopeJson),
  };
}

export function policyRevisionInputFromSnapshotV1(
  snapshot: PersistedPolicyRevisionSnapshotV1,
): PolicyRevisionInputV1 {
  const rules = [...snapshot.rules]
    .sort((a, b) => a.position - b.position)
    .map(ruleInputFromSnapshot);

  return {
    schemaVersion:
      snapshot.schemaVersion as PolicyRevisionInputV1["schemaVersion"],
    id: snapshot.id,
    policyId: snapshot.policyId,
    revisionNumber: snapshot.revisionNumber,
    createdAt: snapshot.createdAt,
    rules,
  };
}
