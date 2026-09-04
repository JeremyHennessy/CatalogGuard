-- CreateTable
CREATE TABLE "CatalogChangeEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT,
    "shopDomain" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "apiVersion" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceGid" TEXT,
    "legacyResourceId" TEXT NOT NULL,
    "payloadIdPrecision" TEXT NOT NULL,
    "payloadFingerprint" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "processingState" TEXT NOT NULL DEFAULT 'PENDING_INCREMENTAL_RECONCILIATION',
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadUpdatedAt" DATETIME,
    "processedAt" DATETIME,
    "errorSummary" TEXT,
    CONSTRAINT "CatalogChangeEvent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CatalogChangeEvent_shopId_processingState_receivedAt_idx" ON "CatalogChangeEvent"("shopId", "processingState", "receivedAt");
CREATE INDEX "CatalogChangeEvent_shopDomain_topic_receivedAt_idx" ON "CatalogChangeEvent"("shopDomain", "topic", "receivedAt");
CREATE INDEX "CatalogChangeEvent_resourceType_resourceGid_idx" ON "CatalogChangeEvent"("resourceType", "resourceGid");
CREATE INDEX "CatalogChangeEvent_payloadFingerprint_idx" ON "CatalogChangeEvent"("payloadFingerprint");
