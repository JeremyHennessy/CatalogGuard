import type { EvaluationTargetV1 } from "../catalog/model";
import type { ConfigSchema } from "./config";
import type { IdentifierLookup } from "./identifier-index";
import type { ProductScopeV1 } from "./scope";

export type RuleStatus = "PASS" | "FAIL" | "NOT_APPLICABLE" | "UNKNOWN";
export type RuleSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";
export type RuleTargetType = "PRODUCT" | "VARIANT";

export type RuleResult = {
  status: RuleStatus;
  ruleCode: string;
  ruleVersion: number;
  resourceGid: string;
  subresourceGid?: string;
  observed?: unknown;
  expected?: unknown;
  message: string;
  evidence?: Record<string, unknown>;
  reasonCode?: string;
};

export type EvaluationContextV1 = {
  shopId: string;
  observedAt: Date;
  apiVersion: string;
  normalizationVersion: string;
  policyRevisionId: string;
  identifierIndex: IdentifierLookup;
};

export type RuleDefinition<TConfig> = {
  code: string;
  version: number;
  family: string;
  target: RuleTargetType;
  configSchema: ConfigSchema<TConfig>;
  evaluate(
    target: EvaluationTargetV1,
    config: TConfig,
    context: EvaluationContextV1,
  ): RuleResult[];
};

export type PolicyRuleInput = {
  ruleCode: string;
  ruleVersion: number;
  enabled: boolean;
  severity: RuleSeverity;
  blocking: boolean;
  config: unknown;
  scope?: unknown;
};

export type ValidatedPolicyRule<TConfig> = Omit<
  PolicyRuleInput,
  "config" | "scope"
> & {
  config: TConfig;
  scope: ProductScopeV1;
};

export function resultForTarget(
  definition: Pick<RuleDefinition<unknown>, "code" | "version">,
  target: EvaluationTargetV1,
  status: RuleStatus,
  message: string,
  details: Omit<
    Partial<RuleResult>,
    "status" | "ruleCode" | "ruleVersion" | "resourceGid" | "subresourceGid" | "message"
  > = {},
): RuleResult {
  return {
    status,
    ruleCode: definition.code,
    ruleVersion: definition.version,
    resourceGid: target.product.gid,
    ...(target.variant ? { subresourceGid: target.variant.gid } : {}),
    message,
    ...details,
  };
}
