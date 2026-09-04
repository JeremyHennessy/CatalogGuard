import {
  canonicalJsonStringify,
  parseCanonicalJson,
} from "../persistence/json";

export type PreflightRunEvidenceDetailV1 = Readonly<{
  id: string;
  shopId: string;
  scanId: string;
  policyRevisionId: string;
  targetType: string;
  status: string;
  outcome?: string;
  targetDefinitionJson: string;
  sourceFreshnessAt?: string;
  blockingViolationCount: number;
  waiverCount: number;
  indeterminateBlockingCount: number;
  createdByActor?: string;
  createdAt: string;
  completedAt?: string;
  policyRevision: Readonly<{
    id: string;
    revisionNumber: number;
    nameSnapshot: string;
    descriptionSnapshot?: string;
    schemaVersion: number;
    createdAt: string;
    createdByActor?: string;
    changeSummary?: string;
  }>;
  scan: Readonly<{
    id: string;
    shopId: string;
    scanType: string;
    status: string;
    policyRevisionId: string;
    apiVersion: string;
    engineVersion: string;
    normalizationVersion: string;
    startedAt: string;
    finishedAt?: string;
    sourceWatermark?: string;
    productsExpected?: number;
    productsProcessed: number;
    variantsProcessed: number;
    passCount: number;
    failCount: number;
    unknownCount: number;
    notApplicableCount: number;
    warningCount: number;
    errorSummary?: string;
    metadataJson?: string;
  }>;
  targets: readonly Readonly<{
    resourceType: string;
    resourceGid: string;
    resourceFingerprint: string;
  }>[];
  evaluations: readonly Readonly<{
    id: string;
    scanId: string;
    policyRevisionId: string;
    policyRuleId: string;
    exceptionId?: string;
    ruleCode: string;
    ruleVersion: number;
    resourceGid: string;
    subresourceGid?: string;
    status: string;
    enforcement: string;
    observedJson?: string;
    expectedJson?: string;
    message: string;
    reasonCode?: string;
    evidenceJson?: string;
    evaluatedAt: string;
    policyRule: Readonly<{
      id: string;
      severity: string;
      blocking: boolean;
      configJson: string;
      scopeJson: string;
      merchantLabel?: string;
      merchantNotes?: string;
    }>;
    exception?: Readonly<{
      id: string;
      reason: string;
      createdAt: string;
      expiresAt?: string;
      revokedAt?: string;
    }>;
  }>[];
}>;

export type PreflightEvidenceExportV1 = Readonly<{
  schemaVersion: 1;
  preflightRun: Readonly<{
    id: string;
    shopId: string;
    scanId: string;
    policyRevisionId: string;
    targetType: string;
    status: string;
    outcome?: string;
    inputFingerprint: string;
    targetDefinition: unknown;
    sourceFreshnessAt?: string;
    blockingViolationCount: number;
    waiverCount: number;
    indeterminateBlockingCount: number;
    createdByActor?: string;
    createdAt: string;
    completedAt?: string;
  }>;
  policyRevision: PreflightRunEvidenceDetailV1["policyRevision"];
  scan: Readonly<
    Omit<PreflightRunEvidenceDetailV1["scan"], "metadataJson"> & {
      metadata?: unknown;
    }
  >;
  materializedTargets: PreflightRunEvidenceDetailV1["targets"];
  evaluations: readonly Readonly<{
    id: string;
    scanId: string;
    policyRevisionId: string;
    policyRuleId: string;
    exceptionId?: string;
    ruleCode: string;
    ruleVersion: number;
    resourceGid: string;
    subresourceGid?: string;
    status: string;
    enforcement: string;
    observed?: unknown;
    expected?: unknown;
    message: string;
    reasonCode?: string;
    evidence?: unknown;
    evaluatedAt: string;
    policyRule: PreflightRunEvidenceDetailV1["evaluations"][number]["policyRule"];
    exception?: PreflightRunEvidenceDetailV1["evaluations"][number]["exception"];
  }>[];
}>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEvidenceJson(value: string, field: string) {
  try {
    return parseCanonicalJson(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    throw new Error(field + " is not valid canonical JSON: " + message);
  }
}

function parseOptionalEvidenceJson(value: string | undefined, field: string) {
  return value === undefined ? undefined : parseEvidenceJson(value, field);
}

function targetDefinitionRecord(value: string) {
  const parsed = parseEvidenceJson(value, "preflight targetDefinitionJson");
  if (!isObject(parsed)) {
    throw new Error("preflight targetDefinitionJson must be an object");
  }
  if (typeof parsed.inputFingerprint !== "string") {
    throw new Error(
      "preflight targetDefinitionJson is missing inputFingerprint",
    );
  }
  if (!isObject(parsed.targetDefinition)) {
    throw new Error(
      "preflight targetDefinitionJson is missing targetDefinition",
    );
  }

  return Object.freeze({
    inputFingerprint: parsed.inputFingerprint,
    targetDefinition: parsed.targetDefinition,
  });
}

export function buildPreflightEvidenceExportV1(
  detail: PreflightRunEvidenceDetailV1,
): PreflightEvidenceExportV1 {
  const targetRecord = targetDefinitionRecord(detail.targetDefinitionJson);
  const scanMetadata = parseOptionalEvidenceJson(
    detail.scan.metadataJson,
    "scan metadataJson",
  );

  return Object.freeze({
    schemaVersion: 1 as const,
    preflightRun: Object.freeze({
      id: detail.id,
      shopId: detail.shopId,
      scanId: detail.scanId,
      policyRevisionId: detail.policyRevisionId,
      targetType: detail.targetType,
      status: detail.status,
      ...(detail.outcome ? { outcome: detail.outcome } : {}),
      inputFingerprint: targetRecord.inputFingerprint,
      targetDefinition: targetRecord.targetDefinition,
      ...(detail.sourceFreshnessAt
        ? { sourceFreshnessAt: detail.sourceFreshnessAt }
        : {}),
      blockingViolationCount: detail.blockingViolationCount,
      waiverCount: detail.waiverCount,
      indeterminateBlockingCount: detail.indeterminateBlockingCount,
      ...(detail.createdByActor
        ? { createdByActor: detail.createdByActor }
        : {}),
      createdAt: detail.createdAt,
      ...(detail.completedAt ? { completedAt: detail.completedAt } : {}),
    }),
    policyRevision: detail.policyRevision,
    scan: Object.freeze({
      id: detail.scan.id,
      shopId: detail.scan.shopId,
      scanType: detail.scan.scanType,
      status: detail.scan.status,
      policyRevisionId: detail.scan.policyRevisionId,
      apiVersion: detail.scan.apiVersion,
      engineVersion: detail.scan.engineVersion,
      normalizationVersion: detail.scan.normalizationVersion,
      startedAt: detail.scan.startedAt,
      ...(detail.scan.finishedAt ? { finishedAt: detail.scan.finishedAt } : {}),
      ...(detail.scan.sourceWatermark
        ? { sourceWatermark: detail.scan.sourceWatermark }
        : {}),
      ...(detail.scan.productsExpected !== undefined
        ? { productsExpected: detail.scan.productsExpected }
        : {}),
      productsProcessed: detail.scan.productsProcessed,
      variantsProcessed: detail.scan.variantsProcessed,
      passCount: detail.scan.passCount,
      failCount: detail.scan.failCount,
      unknownCount: detail.scan.unknownCount,
      notApplicableCount: detail.scan.notApplicableCount,
      warningCount: detail.scan.warningCount,
      ...(detail.scan.errorSummary
        ? { errorSummary: detail.scan.errorSummary }
        : {}),
      ...(scanMetadata !== undefined ? { metadata: scanMetadata } : {}),
    }),
    materializedTargets: detail.targets,
    evaluations: Object.freeze(
      detail.evaluations.map((evaluation) => {
        const observed = parseOptionalEvidenceJson(
          evaluation.observedJson,
          "evaluation " + evaluation.id + " observedJson",
        );
        const expected = parseOptionalEvidenceJson(
          evaluation.expectedJson,
          "evaluation " + evaluation.id + " expectedJson",
        );
        const evidence = parseOptionalEvidenceJson(
          evaluation.evidenceJson,
          "evaluation " + evaluation.id + " evidenceJson",
        );

        return Object.freeze({
          id: evaluation.id,
          scanId: evaluation.scanId,
          policyRevisionId: evaluation.policyRevisionId,
          policyRuleId: evaluation.policyRuleId,
          ...(evaluation.exceptionId
            ? { exceptionId: evaluation.exceptionId }
            : {}),
          ruleCode: evaluation.ruleCode,
          ruleVersion: evaluation.ruleVersion,
          resourceGid: evaluation.resourceGid,
          ...(evaluation.subresourceGid
            ? { subresourceGid: evaluation.subresourceGid }
            : {}),
          status: evaluation.status,
          enforcement: evaluation.enforcement,
          ...(observed !== undefined ? { observed } : {}),
          ...(expected !== undefined ? { expected } : {}),
          message: evaluation.message,
          ...(evaluation.reasonCode
            ? { reasonCode: evaluation.reasonCode }
            : {}),
          ...(evidence !== undefined ? { evidence } : {}),
          evaluatedAt: evaluation.evaluatedAt,
          policyRule: evaluation.policyRule,
          ...(evaluation.exception ? { exception: evaluation.exception } : {}),
        });
      }),
    ),
  });
}

export function preflightEvidenceExportJsonV1(
  detail: PreflightRunEvidenceDetailV1,
) {
  return canonicalJsonStringify(buildPreflightEvidenceExportV1(detail)) + "\n";
}
