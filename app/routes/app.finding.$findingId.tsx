import { boundary } from "@shopify/shopify-app-react-router/server";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { loadFindingDetailV1 } from "../services/findings/findings.server";
import { ensureCatalogGuardShopV1 } from "../services/shops/shop-record.server";

const API_VERSION = "2026-07";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  if (!params.findingId) {
    throw new Response("Finding id is required", { status: 400 });
  }

  const { admin, session } = await authenticate.admin(request);
  const shop = await ensureCatalogGuardShopV1({
    admin,
    shopDomain: session.shop,
    currentScopes: session.scope,
    apiVersion: API_VERSION,
  });
  const finding = await loadFindingDetailV1(shop.id, params.findingId);

  if (!finding) {
    throw new Response("Finding not found", { status: 404 });
  }

  return {
    shopDomain: session.shop,
    finding,
  };
};

function displayDate(value: string | undefined) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString();
}

function JsonEvidence({ label, value }: { label: string; value?: string }) {
  if (!value) return null;

  return (
    <div>
      <strong>{label}</strong>
      <pre>{value}</pre>
    </div>
  );
}

export default function CatalogGuardFindingDetail() {
  const { finding, shopDomain } = useLoaderData<typeof loader>();
  const latest = finding.latestEvaluation;

  return (
    <s-page heading={`${finding.ruleCode} finding`}>
      <s-section heading="Finding status">
        <s-paragraph>
          Persisted evidence for {shopDomain}. This detail view does not rerun
          the catalog scan.
        </s-paragraph>
        <s-unordered-list>
          <s-list-item>Status: {finding.currentStatus}</s-list-item>
          <s-list-item>Classification: {finding.classification}</s-list-item>
          <s-list-item>
            Severity: {latest.severity}
            {latest.blocking ? " / blocking" : " / non-blocking"}
          </s-list-item>
          <s-list-item>Enforcement: {latest.enforcement}</s-list-item>
          <s-list-item>Technical result: {latest.status}</s-list-item>
          <s-list-item>Message: {latest.message}</s-list-item>
          {latest.reasonCode ? (
            <s-list-item>Reason code: {latest.reasonCode}</s-list-item>
          ) : null}
          <s-list-item>
            First seen: {displayDate(finding.firstSeenAt)}
          </s-list-item>
          <s-list-item>
            Last seen: {displayDate(finding.lastSeenAt)}
          </s-list-item>
          <s-list-item>Reopened count: {finding.reopenedCount}</s-list-item>
          {finding.resolvedAt ? (
            <s-list-item>
              Resolved: {displayDate(finding.resolvedAt)}
            </s-list-item>
          ) : null}
        </s-unordered-list>
        <s-paragraph>
          <s-link href="/app/findings">Back to all findings</s-link>
        </s-paragraph>
      </s-section>

      <s-section heading="Resource identity">
        <s-unordered-list>
          <s-list-item>Resource type: {finding.resourceType}</s-list-item>
          <s-list-item>Resource GID: {finding.resourceGid}</s-list-item>
          {finding.subresourceGid ? (
            <s-list-item>Subresource GID: {finding.subresourceGid}</s-list-item>
          ) : null}
          {finding.fieldKey ? (
            <s-list-item>Field key: {finding.fieldKey}</s-list-item>
          ) : null}
          <s-list-item>Finding key: {finding.findingKey}</s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section heading="Latest evaluation evidence">
        <s-unordered-list>
          <s-list-item>Evaluation id: {latest.id}</s-list-item>
          <s-list-item>Scan id: {latest.scanId}</s-list-item>
          <s-list-item>Policy revision: {latest.policyRevisionId}</s-list-item>
          <s-list-item>Rule version: {latest.ruleVersion}</s-list-item>
          <s-list-item>
            Evaluated: {displayDate(latest.evaluatedAt)}
          </s-list-item>
          {latest.exceptionId ? (
            <s-list-item>Exception id: {latest.exceptionId}</s-list-item>
          ) : null}
          {latest.merchantLabel ? (
            <s-list-item>Policy label: {latest.merchantLabel}</s-list-item>
          ) : null}
          {latest.merchantNotes ? (
            <s-list-item>Policy notes: {latest.merchantNotes}</s-list-item>
          ) : null}
        </s-unordered-list>
        <JsonEvidence label="Observed" value={latest.observedJson} />
        <JsonEvidence label="Expected" value={latest.expectedJson} />
        <JsonEvidence label="Evidence" value={latest.evidenceJson} />
      </s-section>

      <s-section heading={`History (${finding.history.length})`}>
        {finding.history.length === 0 ? (
          <s-paragraph>No finding events are persisted.</s-paragraph>
        ) : (
          <s-unordered-list>
            {finding.history.map((event) => (
              <s-list-item key={event.id}>
                {displayDate(event.createdAt)} — {event.eventType}
                {event.evaluation
                  ? ` — ${event.evaluation.status} / ${event.evaluation.enforcement} — ${event.evaluation.message}`
                  : ""}
                {event.exception
                  ? ` — exception: ${event.exception.reason}`
                  : ""}
                {event.scanId ? ` — scan ${event.scanId}` : ""}
              </s-list-item>
            ))}
          </s-unordered-list>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
