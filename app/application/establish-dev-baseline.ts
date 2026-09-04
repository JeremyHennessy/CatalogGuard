import { developmentBaselineScanIdV1 } from "../domain/policy/dev-validation-template";
import type { ValidatedPolicyRevisionV1 } from "../domain/policy/contracts";
import type { ExactRuleExceptionV1 } from "../domain/policy/evaluator";

export type BaselineOverviewStateV1 = Readonly<{
  baseline: Readonly<{ id: string }> | null;
}>;

export type EstablishDevBaselineScanInputV1<TAdmin> = Readonly<{
  admin: TAdmin;
  scanId: string;
  shopId: string;
  scanType: "BASELINE";
  apiVersion: string;
  engineVersion: string;
  startedAt: string;
  observedAt: string;
  finishedAt: string;
  revision: ValidatedPolicyRevisionV1;
  exceptions: readonly ExactRuleExceptionV1[];
  baseline: true;
}>;

export type EstablishDevBaselineInputV1<TAdmin, TScanResult> = Readonly<{
  admin: TAdmin;
  shopId: string;
  apiVersion: string;
  engineVersion: string;
  now: () => string;
  loadOverview: (shopId: string) => Promise<BaselineOverviewStateV1>;
  ensurePolicy: (input: {
    shopId: string;
    createdAt: string;
  }) => Promise<ValidatedPolicyRevisionV1>;
  loadExceptions: (shopId: string) => Promise<readonly ExactRuleExceptionV1[]>;
  runScan: (
    input: EstablishDevBaselineScanInputV1<TAdmin>,
  ) => Promise<TScanResult>;
}>;

export type EstablishDevBaselineResultV1<TScanResult> =
  | Readonly<{
      status: "ALREADY_ESTABLISHED";
      scanId: string;
    }>
  | Readonly<{
      status: "ESTABLISHED";
      scanId: string;
      scanResult: TScanResult;
    }>;

export async function establishDevBaselineV1<TAdmin, TScanResult>(
  input: EstablishDevBaselineInputV1<TAdmin, TScanResult>,
): Promise<EstablishDevBaselineResultV1<TScanResult>> {
  const overview = await input.loadOverview(input.shopId);

  if (overview.baseline) {
    return Object.freeze({
      status: "ALREADY_ESTABLISHED" as const,
      scanId: overview.baseline.id,
    });
  }

  const now = input.now();
  const revision = await input.ensurePolicy({
    shopId: input.shopId,
    createdAt: now,
  });
  const exceptions = await input.loadExceptions(input.shopId);
  const scanId = developmentBaselineScanIdV1(input.shopId);
  const scanResult = await input.runScan({
    admin: input.admin,
    scanId,
    shopId: input.shopId,
    scanType: "BASELINE",
    apiVersion: input.apiVersion,
    engineVersion: input.engineVersion,
    startedAt: now,
    observedAt: now,
    finishedAt: now,
    revision,
    exceptions,
    baseline: true,
  });

  return Object.freeze({
    status: "ESTABLISHED" as const,
    scanId,
    scanResult,
  });
}
