import {
  POLICY_SCHEMA_VERSION,
  type PolicyRevisionInputV1,
  type ValidatedPolicyRevisionV1,
} from "./contracts";

export const DEV_VALIDATION_POLICY_NAME = "CatalogGuard Dev validation";
export const DEV_VALIDATION_POLICY_DESCRIPTION =
  "Development-only validation policy for the CatalogGuard acceptance scenario. It is not a merchant production default.";

export type DevValidationPolicyIdentityV1 = Readonly<{
  policyId: string;
  revisionId: string;
}>;

export function devValidationPolicyIdentityV1(
  shopId: string,
): DevValidationPolicyIdentityV1 {
  if (shopId.trim().length === 0) {
    throw new Error("shopId must be non-empty");
  }

  const policyId = `${shopId}:dev-validation`;
  return Object.freeze({
    policyId,
    revisionId: `${policyId}:r1`,
  });
}

export function developmentBaselineScanIdV1(shopId: string) {
  if (shopId.trim().length === 0) {
    throw new Error("shopId must be non-empty");
  }

  return `${shopId}:baseline:dev-v1`;
}

export function devValidationPolicyRevisionInputV1(input: {
  shopId: string;
  createdAt: string;
}): PolicyRevisionInputV1 {
  const identity = devValidationPolicyIdentityV1(input.shopId);

  return {
    schemaVersion: POLICY_SCHEMA_VERSION,
    id: identity.revisionId,
    policyId: identity.policyId,
    revisionNumber: 1,
    createdAt: input.createdAt,
    rules: [
      {
        ruleCode: "CG-SKU-001",
        ruleVersion: 1,
        enabled: true,
        severity: "CRITICAL",
        blocking: true,
        config: {},
        scope: { statuses: ["ACTIVE"] },
      },
      {
        ruleCode: "CG-SKU-002",
        ruleVersion: 1,
        enabled: true,
        severity: "CRITICAL",
        blocking: true,
        config: { normalization: "EXACT" },
        scope: { statuses: ["ACTIVE"] },
      },
    ],
  };
}

function assertActiveOnlyScope(
  scope: ValidatedPolicyRevisionV1["rules"][number]["rule"]["scope"],
  ruleCode: string,
) {
  if (
    scope.statuses?.length !== 1 ||
    scope.statuses[0] !== "ACTIVE" ||
    scope.vendors !== undefined ||
    scope.productTypes !== undefined ||
    scope.tagsAny !== undefined ||
    scope.tagsAll !== undefined
  ) {
    throw new Error(`${ruleCode} dev validation scope must be ACTIVE-only`);
  }
}

export function assertDevValidationPolicyRevisionV1(
  revision: ValidatedPolicyRevisionV1,
) {
  if (revision.revisionNumber !== 1 || revision.rules.length !== 2) {
    throw new Error(
      "dev validation policy must contain exactly revision 1 with two rules",
    );
  }

  const required = revision.rules.find(
    (entry) => entry.rule.ruleCode === "CG-SKU-001",
  );
  const unique = revision.rules.find(
    (entry) => entry.rule.ruleCode === "CG-SKU-002",
  );

  if (!required || !unique) {
    throw new Error(
      "dev validation policy must contain SKU required and SKU unique",
    );
  }

  for (const entry of [required, unique]) {
    if (
      !entry.rule.enabled ||
      entry.rule.severity !== "CRITICAL" ||
      !entry.rule.blocking
    ) {
      throw new Error(
        `${entry.rule.ruleCode} dev validation rule must be enabled, CRITICAL, and blocking`,
      );
    }
    assertActiveOnlyScope(entry.rule.scope, entry.rule.ruleCode);
  }

  const uniqueConfig = unique.rule.config as { normalization?: unknown };
  if (uniqueConfig.normalization !== "EXACT") {
    throw new Error(
      "dev validation SKU uniqueness must use EXACT normalization",
    );
  }
}
