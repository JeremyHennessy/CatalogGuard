import type { PreflightEvidencePlanV1 } from "../application/preflight-evidence";
import type { PreflightOutcomeV1 } from "../domain/preflight/outcome";

export type PreflightScanDescriptorV1 = Readonly<{
  id: string;
  shopId: string;
  scanType: "PREFLIGHT";
  policyRevisionId: string;
  apiVersion: string;
  engineVersion: string;
  normalizationVersion: string;
  startedAt: string;
  finishedAt: string;
  sourceWatermark?: string;
  productsExpected: number;
  productsProcessed: number;
  variantsProcessed: number;
}>;

export type PersistPreflightEvidenceInputV1 = Readonly<{
  scan: PreflightScanDescriptorV1;
  plan: PreflightEvidencePlanV1;
}>;

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

  persistPreflightEvidence(
    input: PersistPreflightEvidenceInputV1,
  ): Promise<PersistPreflightResultV1>;
}
