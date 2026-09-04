import { randomUUID } from "node:crypto";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useMemo, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
} from "react-router";
import { authenticate } from "../shopify.server";
import {
  loadPreflightPolicyChoicesV1,
  loadRecentPreflightRunsV1,
} from "../services/preflight/preflight-runs.server";
import { runProductPreflightForShopV1 } from "../services/preflight/product-preflight.server";
import { ensureCatalogGuardShopV1 } from "../services/shops/shop-record.server";

const API_VERSION = "2026-07";
const ENGINE_VERSION = "catalogguard-policy-v1";

async function authenticatedShop(request: Request) {
  const { admin, session } = await authenticate.admin(request);
  const shop = await ensureCatalogGuardShopV1({
    admin,
    shopDomain: session.shop,
    currentScopes: session.scope,
    apiVersion: API_VERSION,
  });
  return { admin, session, shop };
}

function requiredFormString(
  form: FormData,
  field: string,
  label: string,
): string {
  const value = form.get(field);
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Response(`${label} is required`, { status: 400 });
  }

  return value.trim();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Preflight could not run";
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await ensureCatalogGuardShopV1({
    admin,
    shopDomain: session.shop,
    currentScopes: session.scope,
    apiVersion: API_VERSION,
  });
  const [preflightRuns, policyChoices] = await Promise.all([
    loadRecentPreflightRunsV1(shop.id),
    loadPreflightPolicyChoicesV1(shop.id),
  ]);

  return {
    shopDomain: session.shop,
    preflightRuns,
    policyChoices,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  const policyId = requiredFormString(form, "policyId", "Policy");
  const expectedRevisionId = requiredFormString(
    form,
    "expectedRevisionId",
    "Expected policy revision",
  );
  const productTargetText = requiredFormString(
    form,
    "productTargets",
    "Product targets",
  );
  const { admin, session, shop } = await authenticatedShop(request);

  try {
    const result = await runProductPreflightForShopV1({
      admin,
      shopId: shop.id,
      policyId,
      expectedRevisionId,
      productTargetText,
      apiVersion: API_VERSION,
      engineVersion: ENGINE_VERSION,
      createdByActor: session.shop,
      now: () => new Date().toISOString(),
      nextScanId: () => `scan_${randomUUID()}`,
      nextPreflightRunId: () => `preflight_${randomUUID()}`,
    });

    return { result };
  } catch (error) {
    return { error: errorMessage(error) };
  }
};

function displayDate(value: string | undefined) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString();
}

export default function CatalogGuardPreflight() {
  const { policyChoices, preflightRuns, shopDomain } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const defaultPolicyId = policyChoices[0]?.id ?? "";
  const [selectedPolicyId, setSelectedPolicyId] = useState(defaultPolicyId);
  const [productTargets, setProductTargets] = useState("");
  const selectedPolicy = useMemo(
    () =>
      policyChoices.find((policy) => policy.id === selectedPolicyId) ??
      policyChoices[0],
    [policyChoices, selectedPolicyId],
  );
  const isSubmitting = navigation.state !== "idle";

  const runPreflight = () => {
    if (!selectedPolicy || productTargets.trim().length === 0) return;

    const form = new FormData();
    form.set("policyId", selectedPolicy.id);
    form.set("expectedRevisionId", selectedPolicy.activeRevisionId);
    form.set("productTargets", productTargets);
    submit(form, { method: "post" });
  };

  return (
    <s-page heading="Preflight">
      <s-section heading="Launch evidence">
        <s-paragraph>
          Persisted preflight evidence for {shopDomain}. Product preflights run
          the same policy engine against selected Shopify products, then record
          evidence without writing products or changing current findings.
        </s-paragraph>
        <s-paragraph>
          Outcomes use the same policy semantics as findings: blocking
          violations fail, blocking unknowns are indeterminate, and exact active
          waivers can produce pass with waivers without changing technical
          failures.
        </s-paragraph>
        <s-paragraph>
          <s-link href="/app">Back to overview</s-link>
        </s-paragraph>
      </s-section>

      <s-section heading="Run product preflight">
        {policyChoices.length === 0 ? (
          <s-paragraph>
            Create and activate a policy before running product preflight.
          </s-paragraph>
        ) : (
          <div style={{ display: "grid", gap: "1rem", maxWidth: "48rem" }}>
            <label htmlFor="preflight-policy">
              Policy
              <select
                id="preflight-policy"
                value={selectedPolicy?.id ?? ""}
                onChange={(event) =>
                  setSelectedPolicyId(event.currentTarget.value)
                }
              >
                {policyChoices.map((policy) => (
                  <option key={policy.id} value={policy.id}>
                    {policy.name} v{policy.activeRevisionNumber}
                  </option>
                ))}
              </select>
            </label>

            <label htmlFor="preflight-product-targets">
              Product IDs, GIDs, or Admin URLs
              <textarea
                id="preflight-product-targets"
                rows={4}
                value={productTargets}
                placeholder="gid://shopify/Product/123, 123, or https://admin.shopify.com/store/example/products/123"
                onChange={(event) =>
                  setProductTargets(event.currentTarget.value)
                }
              />
            </label>

            {selectedPolicy ? (
              <s-unordered-list>
                <s-list-item>
                  Active revision: {selectedPolicy.activeRevisionId}
                </s-list-item>
                <s-list-item>
                  Revision created: {displayDate(
                    selectedPolicy.activeRevisionCreatedAt,
                  )}
                </s-list-item>
                <s-list-item>
                  This preflight records evidence only; current findings are not
                  reconciled.
                </s-list-item>
              </s-unordered-list>
            ) : null}

            <s-button type="button" variant="primary" onClick={runPreflight}>
              {isSubmitting
                ? "Running product preflight"
                : "Run product preflight"}
            </s-button>
          </div>
        )}

        {actionData && "error" in actionData ? (
          <s-paragraph>Preflight did not run: {actionData.error}</s-paragraph>
        ) : null}
        {actionData && "result" in actionData ? (
          <s-paragraph>
            Saved {actionData.result.targetType} preflight{" "}
            {actionData.result.outcome} with {actionData.result.evaluationCount}{" "}
            evaluations across {actionData.result.targetCount} materialized
            targets.
          </s-paragraph>
        ) : null}
      </s-section>

      {preflightRuns.items.length === 0 ? (
        <s-section heading="No preflight runs yet">
          <s-paragraph>
            No target-specific launch checks are persisted yet. Run a product
            preflight above to create immutable evidence for selected products.
          </s-paragraph>
        </s-section>
      ) : (
        <s-section heading={`Recent preflights (${preflightRuns.total})`}>
          <s-unordered-list>
            {preflightRuns.items.map((run) => (
              <s-list-item key={run.id}>
                {run.targetType} - {run.outcome ?? run.status} - policy{" "}
                {run.policyRevision.nameSnapshot} v
                {run.policyRevision.revisionNumber} - completed{" "}
                {displayDate(run.completedAt)} - targets {run.targetCount}
                {run.targetsTruncated ? "+" : ""} - blocking violations{" "}
                {run.blockingViolationCount} - blocking indeterminate{" "}
                {run.indeterminateBlockingCount} - waivers {run.waiverCount}
              </s-list-item>
            ))}
          </s-unordered-list>
        </s-section>
      )}

      {preflightRuns.items.length > 0 ? (
        <s-section heading="Target evidence preview">
          {preflightRuns.items.map((run) => (
            <div key={run.id}>
              <h3>{run.id}</h3>
              <s-unordered-list>
                {run.targets.map((target) => (
                  <s-list-item key={`${run.id}-${target.resourceGid}`}>
                    {target.resourceType} - {target.resourceGid} - fingerprint{" "}
                    {target.resourceFingerprint}
                  </s-list-item>
                ))}
              </s-unordered-list>
              <pre>{run.targetDefinitionJson}</pre>
            </div>
          ))}
        </s-section>
      ) : null}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
