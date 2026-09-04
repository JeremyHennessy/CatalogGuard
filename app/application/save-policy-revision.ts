import {
  buildNextPolicyRevisionInputV1,
  type PolicyRuleControlEditV1,
} from "./policy-revision-edit";
import {
  validatePolicyRevisionV1,
  type PolicyRevisionInputV1,
  type ValidatedPolicyRevisionV1,
} from "../domain/policy/contracts";
import { createBuiltinRuleRegistry } from "../domain/rules/registry";
import type { AppendAndActivatePolicyRevisionInput } from "../persistence/policy-repository";

export type ActivePolicyWorkspaceV1 = Readonly<{
  shopId: string;
  policyId: string;
  name: string;
  description?: string;
  activeRevisionId: string;
  activeRevision: PolicyRevisionInputV1;
}>;

export type SaveMerchantPolicyRevisionDependenciesV1 = Readonly<{
  loadActivePolicy(
    shopId: string,
    policyId: string,
  ): Promise<ActivePolicyWorkspaceV1 | null>;
  appendAndActivate(input: AppendAndActivatePolicyRevisionInput): Promise<void>;
}>;

export type SaveMerchantPolicyRevisionInputV1 = Readonly<{
  shopId: string;
  policyId: string;
  baseRevisionId: string;
  name: string;
  description?: string;
  changeSummary: string;
  createdAt: string;
  createdByActor?: string;
  edits: readonly PolicyRuleControlEditV1[];
}>;

function requireTrimmed(value: string, field: string) {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${field} must be non-empty`);
  }
  return trimmed;
}

function normalizeOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function controlledRuleState(revision: PolicyRevisionInputV1) {
  return revision.rules.map((rule) => ({
    ruleCode: rule.ruleCode,
    ruleVersion: rule.ruleVersion,
    enabled: rule.enabled,
    severity: rule.severity,
    blocking: rule.blocking,
  }));
}

export async function saveMerchantPolicyRevisionV1(
  input: SaveMerchantPolicyRevisionInputV1,
  dependencies: SaveMerchantPolicyRevisionDependenciesV1,
): Promise<ValidatedPolicyRevisionV1> {
  const name = requireTrimmed(input.name, "policy name");
  const changeSummary = requireTrimmed(input.changeSummary, "change summary");
  const description = normalizeOptional(input.description);
  const workspace = await dependencies.loadActivePolicy(
    input.shopId,
    input.policyId,
  );

  if (!workspace) {
    throw new Error(`policy not found for shop: ${input.policyId}`);
  }
  if (workspace.activeRevisionId !== input.baseRevisionId) {
    throw new Error("active policy revision changed; reload before saving");
  }
  if (workspace.activeRevision.id !== workspace.activeRevisionId) {
    throw new Error("active policy workspace is internally inconsistent");
  }

  const nextInput = buildNextPolicyRevisionInputV1({
    current: workspace.activeRevision,
    createdAt: input.createdAt,
    edits: input.edits,
  });
  const rulesChanged =
    JSON.stringify(controlledRuleState(workspace.activeRevision)) !==
    JSON.stringify(controlledRuleState(nextInput));
  const metadataChanged =
    workspace.name !== name || workspace.description !== description;

  if (!rulesChanged && !metadataChanged) {
    throw new Error("policy edit must contain at least one material change");
  }

  const revision = validatePolicyRevisionV1(
    createBuiltinRuleRegistry(),
    nextInput,
  );

  await dependencies.appendAndActivate({
    shopId: input.shopId,
    policyId: input.policyId,
    baseRevisionId: input.baseRevisionId,
    name,
    description,
    revision,
    snapshot: {
      nameSnapshot: name,
      descriptionSnapshot: description,
      createdByActor: input.createdByActor,
      changeSummary,
    },
  });

  return revision;
}
