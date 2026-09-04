import type { ValidatedPolicyRevisionV1 } from "../domain/policy/contracts";
import type { ExactRuleExceptionV1 } from "../domain/policy/evaluator";

export type PolicyReconciliationScanInputV1<TAdmin> = Readonly<{
  admin: TAdmin;
  scanId: string;
  shopId: string;
  scanType: "RECONCILIATION";
  apiVersion: string;
  engineVersion: string;
  startedAt: string;
  observedAt: string;
  finishedAt: string;
  revision: ValidatedPolicyRevisionV1;
  exceptions: readonly ExactRuleExceptionV1[];
  baseline: false;
  changeCause: "POLICY_CHANGE";
}>;

export type RunPolicyReconciliationInputV1<TAdmin, TScanResult> = Readonly<{
  admin: TAdmin;
  shopId: string;
  policyId: string;
  expectedRevisionId: string;
  apiVersion: string;
  engineVersion: string;
  now: () => string;
  nextScanId: () => string;
  loadActiveRevision(
    shopId: string,
    policyId: string,
  ): Promise<ValidatedPolicyRevisionV1 | null>;
  loadExceptions(shopId: string): Promise<readonly ExactRuleExceptionV1[]>;
  runScan(input: PolicyReconciliationScanInputV1<TAdmin>): Promise<TScanResult>;
}>;

export async function runPolicyReconciliationV1<TAdmin, TScanResult>(
  input: RunPolicyReconciliationInputV1<TAdmin, TScanResult>,
) {
  const revision = await input.loadActiveRevision(input.shopId, input.policyId);
  if (!revision) {
    throw new Error(`active policy revision not found: ${input.policyId}`);
  }
  if (revision.id !== input.expectedRevisionId) {
    throw new Error("active policy revision changed; reload before reconciling");
  }

  const observedAt = input.now();
  const exceptions = await input.loadExceptions(input.shopId);
  const scanId = input.nextScanId().trim();
  if (!scanId) {
    throw new Error("scan id must be non-empty");
  }

  const scanResult = await input.runScan({
    admin: input.admin,
    scanId,
    shopId: input.shopId,
    scanType: "RECONCILIATION",
    apiVersion: input.apiVersion,
    engineVersion: input.engineVersion,
    startedAt: observedAt,
    observedAt,
    finishedAt: observedAt,
    revision,
    exceptions,
    baseline: false,
    changeCause: "POLICY_CHANGE",
  });

  return Object.freeze({
    scanId,
    policyRevisionId: revision.id,
    scanResult,
  });
}
