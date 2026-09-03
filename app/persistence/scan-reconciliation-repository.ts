import type { FindingChangeCause } from "../domain/findings/lifecycle";
import type { PolicyEvaluationV1 } from "../domain/policy/evaluator";
import type { PolicyScanDescriptorV1 } from "../application/scan-reconciliation";

export type PersistPolicyScanInputV1 = Readonly<{
  scan: PolicyScanDescriptorV1;
  evaluations: readonly PolicyEvaluationV1[];
  baseline: boolean;
  changeCause?: FindingChangeCause;
  changeCauseByFindingKey?: ReadonlyMap<string, FindingChangeCause>;
}>;

export type PersistPolicyScanResultV1 = Readonly<{
  status: "PERSISTED" | "ALREADY_PERSISTED";
  scanId: string;
  inputFingerprint: string;
  evaluationCount: number;
  findingCount: number;
  findingEventCount: number;
}>;

export interface ScanReconciliationRepository {
  persistPolicyScan(
    input: PersistPolicyScanInputV1,
  ): Promise<PersistPolicyScanResultV1>;
}
