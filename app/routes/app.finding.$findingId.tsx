import { useState } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  redirect,
  useActionData,
  useLoaderData,
  useSubmit,
} from "react-router";
import { authenticate } from "../shopify.server";
import {
  createExactFindingWaiverForShopV1,
  revokeExactFindingWaiverForShopV1,
} from "../services/exceptions/exact-exception-management.server";
import { loadFindingExceptionStateV1 } from "../services/exceptions/finding-exception-state.server";
import { loadFindingDetailV1 } from "../services/findings/findings.server";
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

function requiredFormString(form: FormData, key: string) {
  const value = form.get(key);
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function optionalFormString(form: FormData, key: string) {
  const value = form.get(key);
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }
  return value;
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  if (!params.findingId) {
    throw new Response("Finding id is required", { status: 400 });
  }

  const { session, shop } = await authenticatedShop(request);
  const [finding, exceptionState] = await Promise.all([
    loadFindingDetailV1(shop.id, params.findingId),
    loadFindingExceptionStateV1(shop.id, params.findingId),
  ]);

  if (!finding || !exceptionState) {
    throw new Response("Finding not found", { status: 404 });
  }

  return {
    shopDomain: session.shop,
    finding,
    exceptionState,
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  if (!params.findingId) {
    throw new Response("Finding id is required", { status: 400 });
  }
  const { shop } = await authenticatedShop(request);

  try {
    const form = await request.formData();
    const intent = requiredFormString(form, "intent");
    const now = new Date().toISOString();

    if (intent === "create-waiver") {
      await createExactFindingWaiverForShopV1({
        shopId: shop.id,
        findingId: params.findingId,
        reason: requiredFormString(form, "reason"),
        notes: optionalFormString(form, "notes"),
        expiresAt: optionalFormString(form, "expiresAt"),
        createdAt: now,
      });
    } else if (intent === "revoke-waiver") {
      await revokeExactFindingWaiverForShopV1({
        shopId: shop.id,
        findingId: params.findingId,
        exceptionId: requiredFormString(form, "exceptionId"),
        revocationReason: requiredFormString(form, "revocationReason"),
        revokedAt: now,
      });
    } else {
      throw new Error("unsupported finding action");
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Finding action failed",
    };
  }

  return redirect(`/app/finding/${encodeURIComponent(params.findingId)}`);
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
  const { finding, shopDomain, exceptionState } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const latest = finding.latestEvaluation;
  const [waiverReason, setWaiverReason] = useState("");
  const [waiverNotes, setWaiverNotes] = useState("");
  const [waiverExpiry, setWaiverExpiry] = useState("");
  const [revocationReason, setRevocationReason] = useState("");

  const createWaiver = () => {
    const form = new FormData();
    form.set("intent", "create-waiver");
    form.set("reason", waiverReason);
    form.set("notes", waiverNotes);
    form.set("expiresAt", waiverExpiry);
    submit(form, { method: "post" });
  };

  const revokeWaiver = () => {
    if (!exceptionState.active) return;
    const form = new FormData();
    form.set("intent", "revoke-waiver");
    form.set("exceptionId", exceptionState.active.id);
    form.set("revocationReason", revocationReason);
    submit(form, { method: "post" });
  };

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
          <s-list-item>Technical result: {latest.status}</s-list-item>
          <s-list-item>
            Persisted scan enforcement: {latest.enforcement}
          </s-list-item>
          <s-list-item>
            Current effective enforcement: {exceptionState.effectiveEnforcement}
          </s-list-item>
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

      {actionData?.error ? (
        <s-section heading="Waiver action not completed">
          <s-paragraph>{actionData.error}</s-paragraph>
        </s-section>
      ) : null}

      <s-section heading="Exact waiver">
        <s-paragraph>
          A waiver never changes the underlying technical result. An active
          exact waiver changes current enforcement of this exact finding from
          VIOLATION to WAIVED until it expires or is revoked.
        </s-paragraph>
        {exceptionState.active ? (
          <>
            <s-unordered-list>
              <s-list-item>State: ACTIVE</s-list-item>
              <s-list-item>Reason: {exceptionState.active.reason}</s-list-item>
              <s-list-item>
                Created: {displayDate(exceptionState.active.createdAt)}
              </s-list-item>
              <s-list-item>
                Expires: {displayDate(exceptionState.active.expiresAt)}
              </s-list-item>
            </s-unordered-list>
            <label>
              Revocation reason (required)
              <br />
              <input
                value={revocationReason}
                onChange={(event) =>
                  setRevocationReason(event.currentTarget.value)
                }
              />
            </label>{" "}
            <s-button type="button" onClick={revokeWaiver}>
              Revoke waiver
            </s-button>
          </>
        ) : latest.status === "FAIL" && finding.currentStatus === "OPEN" ? (
          <>
            <div>
              <label>
                Reason (required)
                <br />
                <input
                  value={waiverReason}
                  onChange={(event) =>
                    setWaiverReason(event.currentTarget.value)
                  }
                />
              </label>
            </div>
            <div>
              <label>
                Notes
                <br />
                <textarea
                  value={waiverNotes}
                  onChange={(event) =>
                    setWaiverNotes(event.currentTarget.value)
                  }
                />
              </label>
            </div>
            <div>
              <label>
                Optional expiry (ISO date-time, for example
                2026-09-11T12:00:00Z)
                <br />
                <input
                  value={waiverExpiry}
                  onChange={(event) =>
                    setWaiverExpiry(event.currentTarget.value)
                  }
                />
              </label>
            </div>
            <s-button type="button" variant="primary" onClick={createWaiver}>
              Create exact waiver
            </s-button>
          </>
        ) : (
          <s-paragraph>
            This finding does not currently have an active waiver and is not an
            open technical FAIL eligible for one.
          </s-paragraph>
        )}
      </s-section>

      <s-section heading={`Waiver history (${exceptionState.history.length})`}>
        {exceptionState.history.length === 0 ? (
          <s-paragraph>No exact waivers have been recorded.</s-paragraph>
        ) : (
          <s-unordered-list>
            {exceptionState.history.map((exception) => (
              <s-list-item key={exception.id}>
                {exception.active
                  ? "ACTIVE"
                  : exception.revokedAt
                    ? "REVOKED"
                    : exception.expiresAt
                      ? "EXPIRED"
                      : "INACTIVE"}{" "}
                — {exception.reason} — created{" "}
                {displayDate(exception.createdAt)}
                {exception.expiresAt
                  ? ` — expires ${displayDate(exception.expiresAt)}`
                  : ""}
                {exception.revokedAt
                  ? ` — revoked ${displayDate(exception.revokedAt)}`
                  : ""}
                {exception.revocationReason
                  ? ` — ${exception.revocationReason}`
                  : ""}
              </s-list-item>
            ))}
          </s-unordered-list>
        )}
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
            <s-list-item>
              Exception id at scan: {latest.exceptionId}
            </s-list-item>
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

      <s-section heading={`Finding history (${finding.history.length})`}>
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
