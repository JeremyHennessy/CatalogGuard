-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopifyShopId" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currentScopes" TEXT,
    "apiVersion" TEXT NOT NULL,
    "installedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalledAt" DATETIME,
    "redactedAt" DATETIME,
    "lastSuccessfulFullScanAt" DATETIME,
    "lastWebhookObservedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shopifyShopId_key" ON "Shop"("shopifyShopId");
CREATE UNIQUE INDEX "Shop_shopDomain_key" ON "Shop"("shopDomain");

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "activeRevisionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Policy_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Policy_shopId_status_idx" ON "Policy"("shopId", "status");
CREATE INDEX "Policy_activeRevisionId_idx" ON "Policy"("activeRevisionId");

-- CreateTable
CREATE TABLE "PolicyRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "policyId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "descriptionSnapshot" TEXT,
    "schemaVersion" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByActor" TEXT,
    "changeSummary" TEXT,
    CONSTRAINT "PolicyRevision_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PolicyRevision_policyId_revisionNumber_key" ON "PolicyRevision"("policyId", "revisionNumber");
CREATE INDEX "PolicyRevision_policyId_createdAt_idx" ON "PolicyRevision"("policyId", "createdAt");

-- CreateTable
CREATE TABLE "PolicyRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "policyRevisionId" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "severity" TEXT NOT NULL,
    "blocking" BOOLEAN NOT NULL,
    "configJson" TEXT NOT NULL,
    "scopeJson" TEXT NOT NULL,
    "merchantLabel" TEXT,
    "merchantNotes" TEXT,
    "position" INTEGER,
    CONSTRAINT "PolicyRule_policyRevisionId_fkey" FOREIGN KEY ("policyRevisionId") REFERENCES "PolicyRevision" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PolicyRule_policyRevisionId_ruleCode_ruleVersion_key" ON "PolicyRule"("policyRevisionId", "ruleCode", "ruleVersion");
CREATE INDEX "PolicyRule_policyRevisionId_position_idx" ON "PolicyRule"("policyRevisionId", "position");

-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "scanType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "policyRevisionId" TEXT,
    "apiVersion" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "normalizationVersion" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "sourceWatermark" TEXT,
    "productsExpected" INTEGER,
    "productsProcessed" INTEGER NOT NULL DEFAULT 0,
    "variantsProcessed" INTEGER NOT NULL DEFAULT 0,
    "passCount" INTEGER NOT NULL DEFAULT 0,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "unknownCount" INTEGER NOT NULL DEFAULT 0,
    "notApplicableCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "metadataJson" TEXT,
    CONSTRAINT "Scan_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Scan_policyRevisionId_fkey" FOREIGN KEY ("policyRevisionId") REFERENCES "PolicyRevision" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Scan_shopId_status_startedAt_idx" ON "Scan"("shopId", "status", "startedAt");
CREATE INDEX "Scan_policyRevisionId_idx" ON "Scan"("policyRevisionId");

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scanId" TEXT NOT NULL,
    "policyRevisionId" TEXT NOT NULL,
    "policyRuleId" TEXT NOT NULL,
    "exceptionId" TEXT,
    "ruleCode" TEXT NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "resourceGid" TEXT NOT NULL,
    "subresourceGid" TEXT,
    "status" TEXT NOT NULL,
    "enforcement" TEXT NOT NULL,
    "observedJson" TEXT,
    "expectedJson" TEXT,
    "message" TEXT NOT NULL,
    "reasonCode" TEXT,
    "evidenceJson" TEXT,
    "evaluatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Evaluation_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Evaluation_policyRevisionId_fkey" FOREIGN KEY ("policyRevisionId") REFERENCES "PolicyRevision" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Evaluation_policyRuleId_fkey" FOREIGN KEY ("policyRuleId") REFERENCES "PolicyRule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Evaluation_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "RuleException" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Evaluation_scanId_idx" ON "Evaluation"("scanId");
CREATE INDEX "Evaluation_policyRevisionId_ruleCode_idx" ON "Evaluation"("policyRevisionId", "ruleCode");
CREATE INDEX "Evaluation_resourceGid_subresourceGid_idx" ON "Evaluation"("resourceGid", "subresourceGid");
CREATE INDEX "Evaluation_exceptionId_idx" ON "Evaluation"("exceptionId");

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "findingKey" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceGid" TEXT NOT NULL,
    "subresourceGid" TEXT,
    "fieldKey" TEXT,
    "currentStatus" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "firstSeenAt" DATETIME NOT NULL,
    "lastSeenAt" DATETIME NOT NULL,
    "resolvedAt" DATETIME,
    "reopenedCount" INTEGER NOT NULL DEFAULT 0,
    "latestEvaluationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Finding_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Finding_latestEvaluationId_fkey" FOREIGN KEY ("latestEvaluationId") REFERENCES "Evaluation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Finding_shopId_findingKey_key" ON "Finding"("shopId", "findingKey");
CREATE INDEX "Finding_shopId_currentStatus_classification_idx" ON "Finding"("shopId", "currentStatus", "classification");
CREATE INDEX "Finding_shopId_ruleCode_idx" ON "Finding"("shopId", "ruleCode");
CREATE INDEX "Finding_latestEvaluationId_idx" ON "Finding"("latestEvaluationId");

-- CreateTable
CREATE TABLE "RuleException" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "findingId" TEXT,
    "ruleCode" TEXT NOT NULL,
    "resourceGid" TEXT NOT NULL,
    "subresourceGid" TEXT,
    "coverageType" TEXT NOT NULL DEFAULT 'FINDING_EXACT',
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "createdByActor" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "revokedByActor" TEXT,
    "revocationReason" TEXT,
    CONSTRAINT "RuleException_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RuleException_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RuleException_shopId_ruleCode_resourceGid_subresourceGid_idx" ON "RuleException"("shopId", "ruleCode", "resourceGid", "subresourceGid");
CREATE INDEX "RuleException_findingId_createdAt_idx" ON "RuleException"("findingId", "createdAt");

-- CreateTable
CREATE TABLE "FindingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "findingId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "scanId" TEXT,
    "evaluationId" TEXT,
    "exceptionId" TEXT,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FindingEvent_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FindingEvent_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FindingEvent_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FindingEvent_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "RuleException" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FindingEvent_findingId_createdAt_idx" ON "FindingEvent"("findingId", "createdAt");
CREATE INDEX "FindingEvent_scanId_idx" ON "FindingEvent"("scanId");
CREATE INDEX "FindingEvent_evaluationId_idx" ON "FindingEvent"("evaluationId");
CREATE INDEX "FindingEvent_exceptionId_idx" ON "FindingEvent"("exceptionId");

-- CreateTable
CREATE TABLE "PreflightRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "policyRevisionId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "outcome" TEXT,
    "targetDefinitionJson" TEXT NOT NULL,
    "sourceFreshnessAt" DATETIME,
    "blockingViolationCount" INTEGER NOT NULL DEFAULT 0,
    "waiverCount" INTEGER NOT NULL DEFAULT 0,
    "indeterminateBlockingCount" INTEGER NOT NULL DEFAULT 0,
    "createdByActor" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "PreflightRun_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PreflightRun_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PreflightRun_policyRevisionId_fkey" FOREIGN KEY ("policyRevisionId") REFERENCES "PolicyRevision" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PreflightRun_scanId_key" ON "PreflightRun"("scanId");
CREATE INDEX "PreflightRun_shopId_createdAt_idx" ON "PreflightRun"("shopId", "createdAt");
CREATE INDEX "PreflightRun_policyRevisionId_status_idx" ON "PreflightRun"("policyRevisionId", "status");

-- CreateTable
CREATE TABLE "PreflightTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "preflightRunId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceGid" TEXT NOT NULL,
    "resourceFingerprint" TEXT NOT NULL,
    CONSTRAINT "PreflightTarget_preflightRunId_fkey" FOREIGN KEY ("preflightRunId") REFERENCES "PreflightRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PreflightTarget_preflightRunId_resourceType_resourceGid_key" ON "PreflightTarget"("preflightRunId", "resourceType", "resourceGid");
