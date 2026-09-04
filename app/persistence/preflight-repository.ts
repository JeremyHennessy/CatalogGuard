import type { PreflightEvidencePlanV1 } from "../application/preflight-evidence";
import type { PreflightOutcomeV1 } from "../domain/preflight/outcome";

export type PersistPreflightResultV1 = Readonly<{
  status: "PERSISTED" | "ALREADY_PERSISTED";
  preflightRunId: string;
  scanId: string;
  inputFingerprint: string;
  outcome: PreflightOutcomeV1;
  targetCount: number;
}>;

export interface PreflightRepository {
  persistPreflight(
    plan: PreflightEvidencePlanV1,
  ): Promise<PersistPreflightResultV1>;
}
