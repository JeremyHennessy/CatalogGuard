import { boundary } from "@shopify/shopify-app-react-router/server";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { buildPreflightEvidenceExportV1 } from "../application/preflight-evidence-export";
import { authenticate } from "../shopify.server";
import { loadPreflightRunDetailV1 } from "../services/preflight/preflight-runs.server";
import { ensureCatalogGuardShopV1 } from "../services/shops/shop-record.server";

const API_VERSION = "2026-07";

async function authenticatedShop(request: Request) {
  const { admin, session } = await authenticate.admin(request);
  const shop = await ensureCatalogGuardShopV1({
    admin,
    shopDomain: session.shop,
    currentScopes: session.scope,
    apiVersion: API_VERSION,
  });
  return { session, shop };
}

function displayDate(value: string | undefined) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString();
}

function JsonEvidence({ label, value }: { label: string; value?: unknown }) {
  if (value === undefined) return null;

  return (
    <div>
      <strong>{label}</strong>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  if (!params.preflightRunId) {
    throw new Response("Preflight run id is required", { status: 400 });
  }

  const { session, shop } = await authenticatedShop(request);
  const detail = await loadPreflightRunDetailV1(
    shop.id,
    params.preflightRunId,
  );
  if (!detail) {
    throw new Response("Preflight run not found", { status: 404 });
  }

  return {
    shopDomain: session.shop,
    evidence: buildPreflightEvidenceExportV1(detail),
    raw: {
      targetDefinitionJson: detail.targetDefinitionJson,
      scanMetadataJson: detail.scan.metadataJson,
    },
  };
};

export default function CatalogGuardPreflightDetail() {
  const { evidence, raw, shopDomain } = useLoaderData<typeof loader>();
  const run = evidence.preflightRun;
  const scan = evidence.scan;
  const policy = evidence.policyRevision;

  return (
    <s-page heading={run.targetType + " preflight"}>
      <s-section heading="Evidence summary">
        <s-paragraph>
          Persisted preflight evidence for {shopDomain}. This view does not
          rerun Shopify reads and does not change current findings.
        </s-paragraph>
        <s-unordered-list>
          <s-list-item>Run id: {run.id}</s-list-item>
          <s-list-item>Scan id: {run.scanId}</s-list-item>
          <s-list-item>Outcome: {run.outcome ?? run.status}</s-list-item>
          <s-list-item>Input fingerprint: {run.inputFingerprint}</s-list-item>
          <s-list-item>
            Policy: {policy.nameSnapshot} v{policy.revisionNumber}
          </s-list-item>
          <s-list-item>Policy revision id: {policy.id}</s-list-item>
          <s-list-item>Created: {displayDate(run.createdAt)}</s-list-item>
          <s-list-item>Completed: {displayDate(run.completedAt)}</s-list-item>
          <s-list-item>
            Source freshness: {displayDate(run.sourceFreshnessAt)}
          </s-list-item>
          {run.createdByActor ? (
            <s-list-item>Created by: {run.createdByActor}</s-list-item>
          ) : null}
        </s-unordered-list>
        <s-paragraph>
          <s-link href="/app/preflight">Back to preflights</s-link>{" "}
          <s-link href={"/app/preflight/" + encodeURIComponent(run.id) + "/export"}>
            Export JSON
          </s-link>
        </s-paragraph>
      </s-section>

      <s-section heading="Outcome counts">
        <s-unordered-list>
          <s-list-item>
            Blocking violations: {run.blockingViolationCount}
          </s-list-item>
          <s-list-item>Waivers: {run.waiverCount}</s-list-item>
          <s-list-item>
            Blocking indeterminate: {run.indeterminateBlockingCount}
          </s-list-item>
          <s-list-item>Pass: {scan.passCount}</s-list-item>
          <s-list-item>Fail: {scan.failCount}</s-list-item>
          <s-list-item>Unknown: {scan.unknownCount}</s-list-item>
          <s-list-item>
            Not applicable: {scan.notApplicableCount}
          </s-list-item>
          <s-list-item>Warnings: {scan.warningCount}</s-list-item>
          <s-list-item>Products processed: {scan.productsProcessed}</s-list-item>
          <s-list-item>Variants processed: {scan.variantsProcessed}</s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section heading="Scan evidence">
        <s-unordered-list>
          <s-list-item>Scan type: {scan.scanType}</s-list-item>
          <s-list-item>Scan status: {scan.status}</s-list-item>
          <s-list-item>API version: {scan.apiVersion}</s-list-item>
          <s-list-item>Engine version: {scan.engineVersion}</s-list-item>
          <s-list-item>
            Normalization version: {scan.normalizationVersion}
          </s-list-item>
          <s-list-item>Started: {displayDate(scan.startedAt)}</s-list-item>
          <s-list-item>Finished: {displayDate(scan.finishedAt)}</s-list-item>
          {scan.errorSummary ? (
            <s-list-item>Error summary: {scan.errorSummary}</s-list-item>
          ) : null}
        </s-unordered-list>
        <JsonEvidence
          label="Target definition record"
          value={run.targetDefinition}
        />
        <JsonEvidence label="Scan metadata" value={scan.metadata} />
      </s-section>

      <s-section
        heading={"Materialized targets (" + evidence.materializedTargets.length + ")"}
      >
        <s-unordered-list>
          {evidence.materializedTargets.map((target) => (
            <s-list-item key={target.resourceType + "-" + target.resourceGid}>
              {target.resourceType} - {target.resourceGid} - fingerprint{" "}
              {target.resourceFingerprint}
            </s-list-item>
          ))}
        </s-unordered-list>
      </s-section>

      <s-section heading={"Evaluations (" + evidence.evaluations.length + ")"}>
        <s-unordered-list>
          {evidence.evaluations.map((evaluation) => (
            <s-list-item key={evaluation.id}>
              {evaluation.ruleCode}@{evaluation.ruleVersion} -{" "}
              {evaluation.policyRule.severity}
              {evaluation.policyRule.blocking ? " blocking" : " non-blocking"}{" "}
              - {evaluation.status} / {evaluation.enforcement} -{" "}
              {evaluation.resourceGid}
              {evaluation.subresourceGid
                ? " - " + evaluation.subresourceGid
                : ""}{" "}
              - {evaluation.message}
            </s-list-item>
          ))}
        </s-unordered-list>
      </s-section>

      <s-section heading="Raw persisted JSON">
        <JsonEvidence
          label="targetDefinitionJson"
          value={raw.targetDefinitionJson}
        />
        <JsonEvidence label="scan.metadataJson" value={raw.scanMetadataJson} />
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
