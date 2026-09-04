import * as assert from "node:assert/strict";
import { test } from "node:test";
import { saveMerchantPolicyRevisionV1 } from "../../app/application/save-policy-revision";
import { devValidationPolicyRevisionInputV1 } from "../../app/domain/policy/dev-validation-template";

const current = devValidationPolicyRevisionInputV1({
  shopId: "shop_a",
  createdAt: "2026-09-04T10:00:00.000Z",
});

test("saving a merchant edit appends and activates one validated immutable revision", async () => {
  const writes: unknown[] = [];
  const revision = await saveMerchantPolicyRevisionV1(
    {
      shopId: "shop_a",
      policyId: current.policyId,
      baseRevisionId: current.id,
      name: "Warehouse Ready",
      description: "  SKU controls for launch  ",
      changeSummary: " Expand SKU rule scope ",
      createdAt: "2026-09-04T12:00:00.000Z",
      createdByActor: "merchant-user",
      edits: [
        {
          ruleCode: "CG-SKU-001",
          ruleVersion: 1,
          enabled: true,
          severity: "ERROR",
          blocking: false,
          config: {},
          scope: { statuses: ["ACTIVE", "DRAFT"] },
        },
        {
          ruleCode: "CG-SKU-002",
          ruleVersion: 1,
          enabled: true,
          severity: "CRITICAL",
          blocking: true,
          config: { normalization: "TRIM" },
          scope: { statuses: ["ACTIVE"] },
        },
      ],
    },
    {
      loadActivePolicy: async () => ({
        shopId: "shop_a",
        policyId: current.policyId,
        name: "CatalogGuard Dev validation",
        description: "Development-only",
        activeRevisionId: current.id,
        activeRevision: current,
      }),
      appendAndActivate: async (input) => {
        writes.push(input);
      },
    },
  );

  assert.equal(revision.revisionNumber, 2);
  assert.equal(revision.id, `${current.policyId}:r2`);
  assert.deepEqual(revision.rules[0].rule.scope.statuses, ["ACTIVE", "DRAFT"]);
  assert.deepEqual(revision.rules[1].rule.config, { normalization: "TRIM" });
  assert.equal(writes.length, 1);
  const write = writes[0] as {
    baseRevisionId: string;
    name: string;
    description?: string;
    revision: { id: string; revisionNumber: number };
    snapshot: { changeSummary?: string; createdByActor?: string };
  };
  assert.equal(write.baseRevisionId, current.id);
  assert.equal(write.name, "Warehouse Ready");
  assert.equal(write.description, "SKU controls for launch");
  assert.equal(write.revision.id, `${current.policyId}:r2`);
  assert.equal(write.revision.revisionNumber, 2);
  assert.equal(write.snapshot.changeSummary, "Expand SKU rule scope");
  assert.equal(write.snapshot.createdByActor, "merchant-user");
});

test("invalid config or scope never activates a revision", async () => {
  let writes = 0;
  await assert.rejects(
    () =>
      saveMerchantPolicyRevisionV1(
        {
          shopId: "shop_a",
          policyId: current.policyId,
          baseRevisionId: current.id,
          name: "Policy",
          changeSummary: "Invalid normalization",
          createdAt: "2026-09-04T12:00:00.000Z",
          edits: [
            {
              ruleCode: "CG-SKU-002",
              ruleVersion: 1,
              enabled: true,
              severity: "CRITICAL",
              blocking: true,
              config: { normalization: "LOWERCASE" },
              scope: { statuses: ["ACTIVE"] },
            },
          ],
        },
        {
          loadActivePolicy: async () => ({
            shopId: "shop_a",
            policyId: current.policyId,
            name: "Policy",
            activeRevisionId: current.id,
            activeRevision: current,
          }),
          appendAndActivate: async () => {
            writes += 1;
          },
        },
      ),
    /normalization/,
  );
  assert.equal(writes, 0);
});

test("stale or no-op policy edits do not write a revision", async () => {
  let writes = 0;
  const dependencies = {
    loadActivePolicy: async () => ({
      shopId: "shop_a",
      policyId: current.policyId,
      name: "Policy",
      activeRevisionId: current.id,
      activeRevision: current,
    }),
    appendAndActivate: async () => {
      writes += 1;
    },
  };

  await assert.rejects(
    () =>
      saveMerchantPolicyRevisionV1(
        {
          shopId: "shop_a",
          policyId: current.policyId,
          baseRevisionId: "stale-revision",
          name: "Policy",
          changeSummary: "Attempt stale edit",
          createdAt: "2026-09-04T12:00:00.000Z",
          edits: [],
        },
        dependencies,
      ),
    /active policy revision changed/,
  );

  await assert.rejects(
    () =>
      saveMerchantPolicyRevisionV1(
        {
          shopId: "shop_a",
          policyId: current.policyId,
          baseRevisionId: current.id,
          name: "Policy",
          changeSummary: "No actual change",
          createdAt: "2026-09-04T12:00:00.000Z",
          edits: [],
        },
        dependencies,
      ),
    /material change/,
  );

  assert.equal(writes, 0);
});
