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
import type { RuleSeverity } from "../domain/rules/contracts";
import { authenticate } from "../shopify.server";
import {
  loadPolicyWorkspaceForShopV1,
  savePolicyRevisionForShopV1,
} from "../services/policies/policy-workspace.server";
import { ensureCatalogGuardShopV1 } from "../services/shops/shop-record.server";

const API_VERSION = "2026-07";
const SEVERITIES: readonly RuleSeverity[] = [
  "INFO",
  "WARNING",
  "ERROR",
  "CRITICAL",
];

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
  return typeof value === "string" ? value : undefined;
}

function parseEdits(value: string) {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("policy edits must be an array");
  }

  return parsed.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw new Error("policy edit must be an object");
    }
    const row = entry as Record<string, unknown>;
    if (
      typeof row.ruleCode !== "string" ||
      typeof row.ruleVersion !== "number" ||
      typeof row.enabled !== "boolean" ||
      typeof row.severity !== "string" ||
      !SEVERITIES.includes(row.severity as RuleSeverity) ||
      typeof row.blocking !== "boolean"
    ) {
      throw new Error("policy edit has invalid controlled fields");
    }

    return {
      ruleCode: row.ruleCode,
      ruleVersion: row.ruleVersion,
      enabled: row.enabled,
      severity: row.severity as RuleSeverity,
      blocking: row.blocking,
    };
  });
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  if (!params.policyId) {
    throw new Response("Policy id is required", { status: 400 });
  }
  const { session, shop } = await authenticatedShop(request);
  const policy = await loadPolicyWorkspaceForShopV1(shop.id, params.policyId);
  if (!policy) {
    throw new Response("Policy not found", { status: 404 });
  }

  return { shopDomain: session.shop, policy };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  if (!params.policyId) {
    throw new Response("Policy id is required", { status: 400 });
  }
  const { shop } = await authenticatedShop(request);

  try {
    const form = await request.formData();
    await savePolicyRevisionForShopV1({
      shopId: shop.id,
      policyId: params.policyId,
      baseRevisionId: requiredFormString(form, "baseRevisionId"),
      name: requiredFormString(form, "name"),
      description: optionalFormString(form, "description"),
      changeSummary: requiredFormString(form, "changeSummary"),
      createdAt: new Date().toISOString(),
      edits: parseEdits(requiredFormString(form, "edits")),
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Policy revision failed",
    };
  }

  return redirect(`/app/policy/${encodeURIComponent(params.policyId)}`);
};

function displayDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function CatalogGuardPolicyWorkspace() {
  const { policy, shopDomain } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const [name, setName] = useState(policy.name);
  const [description, setDescription] = useState(policy.description ?? "");
  const [changeSummary, setChangeSummary] = useState("");
  const [rules, setRules] = useState(
    policy.activeRevision?.rules.map((rule) => ({
      ruleCode: rule.ruleCode,
      ruleVersion: rule.ruleVersion,
      enabled: rule.enabled,
      severity: rule.severity,
      blocking: rule.blocking,
      configJson: rule.configJson,
      scopeJson: rule.scopeJson,
    })) ?? [],
  );

  const save = () => {
    if (!policy.activeRevisionId) return;
    const form = new FormData();
    form.set("baseRevisionId", policy.activeRevisionId);
    form.set("name", name);
    form.set("description", description);
    form.set("changeSummary", changeSummary);
    form.set(
      "edits",
      JSON.stringify(
        rules.map((rule) => ({
          ruleCode: rule.ruleCode,
          ruleVersion: rule.ruleVersion,
          enabled: rule.enabled,
          severity: rule.severity,
          blocking: rule.blocking,
        })),
      ),
    );
    submit(form, { method: "post" });
  };

  return (
    <s-page heading={policy.name}>
      <s-section heading="Policy workspace">
        <s-paragraph>
          Shop: {shopDomain}. Policy edits append a new immutable revision and
          affect future scans only. Existing baseline and scan evidence is never
          rewritten.
        </s-paragraph>
        <s-link href="/app/policies">Back to policies</s-link>
      </s-section>

      {actionData?.error ? (
        <s-section heading="Policy edit not saved">
          <s-paragraph>{actionData.error}</s-paragraph>
        </s-section>
      ) : null}

      {!policy.activeRevision ? (
        <s-section heading="No active revision">
          <s-paragraph>
            This policy does not have an active revision.
          </s-paragraph>
        </s-section>
      ) : (
        <>
          <s-section
            heading={`Edit active revision v${policy.activeRevision.revisionNumber}`}
          >
            <div>
              <label>
                Policy name
                <br />
                <input
                  value={name}
                  onChange={(event) => setName(event.currentTarget.value)}
                />
              </label>
            </div>
            <div>
              <label>
                Description
                <br />
                <textarea
                  value={description}
                  onChange={(event) =>
                    setDescription(event.currentTarget.value)
                  }
                />
              </label>
            </div>
            <div>
              <label>
                Change summary (required)
                <br />
                <input
                  value={changeSummary}
                  onChange={(event) =>
                    setChangeSummary(event.currentTarget.value)
                  }
                />
              </label>
            </div>
          </s-section>

          <s-section heading={`Rule controls (${rules.length})`}>
            <s-paragraph>
              This first editor intentionally changes only enabled state,
              severity, and blocking disposition. Rule config and scope remain
              exactly as stored until the deterministic config/scope builder is
              added.
            </s-paragraph>
            {rules.map((rule, index) => (
              <div key={`${rule.ruleCode}@${rule.ruleVersion}`}>
                <strong>
                  {rule.ruleCode}@{rule.ruleVersion}
                </strong>{" "}
                <label>
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(event) =>
                      setRules((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, enabled: event.currentTarget.checked }
                            : item,
                        ),
                      )
                    }
                  />{" "}
                  enabled
                </label>{" "}
                <label>
                  severity{" "}
                  <select
                    value={rule.severity}
                    onChange={(event) =>
                      setRules((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                severity: event.currentTarget
                                  .value as RuleSeverity,
                              }
                            : item,
                        ),
                      )
                    }
                  >
                    {SEVERITIES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>{" "}
                <label>
                  <input
                    type="checkbox"
                    checked={rule.blocking}
                    onChange={(event) =>
                      setRules((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, blocking: event.currentTarget.checked }
                            : item,
                        ),
                      )
                    }
                  />{" "}
                  blocking
                </label>
                <div>
                  <small>Config: {rule.configJson}</small>
                </div>
                <div>
                  <small>Scope: {rule.scopeJson}</small>
                </div>
              </div>
            ))}
            <s-button type="button" variant="primary" onClick={save}>
              Save as new revision
            </s-button>
          </s-section>
        </>
      )}

      <s-section heading={`Revision history (${policy.revisions.length})`}>
        <s-unordered-list>
          {policy.revisions.map((revision) => (
            <s-list-item key={revision.id}>
              v{revision.revisionNumber}
              {revision.id === policy.activeRevisionId
                ? " — ACTIVE"
                : ""} — {revision.nameSnapshot} —{" "}
              {displayDate(revision.createdAt)}
              {revision.changeSummary
                ? ` — ${revision.changeSummary}`
                : " — no change summary"}
            </s-list-item>
          ))}
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
