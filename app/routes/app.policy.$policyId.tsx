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
import {
  POLICY_SCOPE_STATUSES_V1,
  policyRuleEditorSchemaV1,
  type PolicyRuleEditorFieldV1,
} from "../domain/policy/editor-schema";
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

type JsonObject = Record<string, unknown>;
type EditableRule = {
  ruleCode: string;
  ruleVersion: number;
  enabled: boolean;
  severity: RuleSeverity;
  blocking: boolean;
  config: JsonObject;
  scope: JsonObject;
};

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

function requireJsonObject(value: unknown, label: string): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
}

function parseJsonObject(value: string, label: string): JsonObject {
  return requireJsonObject(JSON.parse(value) as unknown, label);
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
      config: requireJsonObject(row.config, `${row.ruleCode} config`),
      scope: requireJsonObject(row.scope, `${row.ruleCode} scope`),
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

function stringList(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value.join(", ")
    : "";
}

function parseStringList(value: string) {
  const values = value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(values)];
}

function withField(object: JsonObject, key: string, value: unknown) {
  const next = { ...object };
  if (
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  ) {
    delete next[key];
  } else {
    next[key] = value;
  }
  return next;
}

function ConfigField(input: {
  field: PolicyRuleEditorFieldV1;
  config: JsonObject;
  onChange: (next: JsonObject) => void;
}) {
  const { field, config, onChange } = input;
  const value = config[field.key];

  if (field.kind === "ENUM") {
    return (
      <label>
        {field.label}{" "}
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(event) =>
            onChange(withField(config, field.key, event.currentTarget.value))
          }
        >
          {field.values.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.kind === "DECIMAL") {
    return (
      <label>
        {field.label}{" "}
        <input
          inputMode="decimal"
          value={typeof value === "string" ? value : ""}
          onChange={(event) =>
            onChange(withField(config, field.key, event.currentTarget.value))
          }
        />
      </label>
    );
  }

  if (field.kind === "POSITIVE_INTEGER") {
    return (
      <label>
        {field.label}{" "}
        <input
          type="number"
          min="1"
          step="1"
          value={typeof value === "number" ? String(value) : ""}
          onChange={(event) => {
            const raw = event.currentTarget.value;
            onChange(
              withField(config, field.key, raw === "" ? undefined : Number(raw)),
            );
          }}
        />
      </label>
    );
  }

  return (
    <label>
      {field.label}
      {field.optional ? " (optional)" : ""}
      <br />
      <textarea
        value={stringList(value)}
        onChange={(event) =>
          onChange(
            withField(
              config,
              field.key,
              parseStringList(event.currentTarget.value),
            ),
          )
        }
      />
      <br />
      <small>Comma or line separated; exact matching.</small>
    </label>
  );
}

function ScopeEditor(input: {
  scope: JsonObject;
  onChange: (next: JsonObject) => void;
}) {
  const { scope, onChange } = input;
  const statuses = Array.isArray(scope.statuses)
    ? scope.statuses.filter((value): value is string => typeof value === "string")
    : [];

  const setStringList = (key: string, value: string) =>
    onChange(withField(scope, key, parseStringList(value)));

  return (
    <div>
      <strong>Scope</strong>
      <div>
        Product status:{" "}
        {POLICY_SCOPE_STATUSES_V1.map((status) => (
          <label key={status}>
            <input
              type="checkbox"
              checked={statuses.includes(status)}
              onChange={(event) => {
                const next = event.currentTarget.checked
                  ? [...statuses, status]
                  : statuses.filter((value) => value !== status);
                onChange(withField(scope, "statuses", next));
              }}
            />{" "}
            {status}{" "}
          </label>
        ))}
      </div>
      <small>No statuses selected means all product statuses.</small>
      <div>
        <label>
          Vendors (optional)
          <br />
          <textarea
            value={stringList(scope.vendors)}
            onChange={(event) =>
              setStringList("vendors", event.currentTarget.value)
            }
          />
        </label>
      </div>
      <div>
        <label>
          Product types (optional)
          <br />
          <textarea
            value={stringList(scope.productTypes)}
            onChange={(event) =>
              setStringList("productTypes", event.currentTarget.value)
            }
          />
        </label>
      </div>
      <div>
        <label>
          Any tag (optional)
          <br />
          <textarea
            value={stringList(scope.tagsAny)}
            onChange={(event) =>
              setStringList("tagsAny", event.currentTarget.value)
            }
          />
        </label>
      </div>
      <div>
        <label>
          All tags (optional)
          <br />
          <textarea
            value={stringList(scope.tagsAll)}
            onChange={(event) =>
              setStringList("tagsAll", event.currentTarget.value)
            }
          />
        </label>
      </div>
      <small>Scope values use deterministic exact matching.</small>
    </div>
  );
}

export default function CatalogGuardPolicyWorkspace() {
  const { policy, shopDomain } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const [name, setName] = useState(policy.name);
  const [description, setDescription] = useState(policy.description ?? "");
  const [changeSummary, setChangeSummary] = useState("");
  const [rules, setRules] = useState<EditableRule[]>(
    policy.activeRevision?.rules.map((rule) => ({
      ruleCode: rule.ruleCode,
      ruleVersion: rule.ruleVersion,
      enabled: rule.enabled,
      severity: rule.severity,
      blocking: rule.blocking,
      config: parseJsonObject(rule.configJson, `${rule.ruleCode} config`),
      scope: parseJsonObject(rule.scopeJson, `${rule.ruleCode} scope`),
    })) ?? [],
  );

  const updateRule = (index: number, update: Partial<EditableRule>) =>
    setRules((current) =>
      current.map((rule, itemIndex) =>
        itemIndex === index ? { ...rule, ...update } : rule,
      ),
    );

  const save = () => {
    if (!policy.activeRevisionId) return;
    const form = new FormData();
    form.set("baseRevisionId", policy.activeRevisionId);
    form.set("name", name);
    form.set("description", description);
    form.set("changeSummary", changeSummary);
    form.set("edits", JSON.stringify(rules));
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
              Rule parameters and scope are edited through constrained controls.
              The server still validates every built-in rule schema and scope
              before a new revision can become active. Arbitrary code is never
              accepted.
            </s-paragraph>
            {rules.map((rule, index) => {
              const editor = policyRuleEditorSchemaV1(rule.ruleCode);
              return (
                <div key={`${rule.ruleCode}@${rule.ruleVersion}`}>
                  <hr />
                  <strong>
                    {editor.title} — {rule.ruleCode}@{rule.ruleVersion}
                  </strong>{" "}
                  <label>
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(event) =>
                        updateRule(index, {
                          enabled: event.currentTarget.checked,
                        })
                      }
                    />{" "}
                    enabled
                  </label>{" "}
                  <label>
                    severity{" "}
                    <select
                      value={rule.severity}
                      onChange={(event) =>
                        updateRule(index, {
                          severity: event.currentTarget.value as RuleSeverity,
                        })
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
                        updateRule(index, {
                          blocking: event.currentTarget.checked,
                        })
                      }
                    />{" "}
                    blocking
                  </label>
                  <div>
                    <strong>Rule parameters</strong>
                    {editor.fields.length === 0 ? (
                      <div>
                        <small>No configurable parameters for this rule.</small>
                      </div>
                    ) : (
                      editor.fields.map((field) => (
                        <div key={field.key}>
                          <ConfigField
                            field={field}
                            config={rule.config}
                            onChange={(config) => updateRule(index, { config })}
                          />
                        </div>
                      ))
                    )}
                  </div>
                  <ScopeEditor
                    scope={rule.scope}
                    onChange={(scope) => updateRule(index, { scope })}
                  />
                </div>
              );
            })}
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
