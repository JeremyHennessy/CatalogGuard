import * as assert from "node:assert/strict";
import { test } from "node:test";
import {
  createExactFindingWaiverV1,
  revokeExactFindingWaiverV1,
} from "../../app/application/exact-exception-management";

const finding = {
  id: "finding_a",
  shopId: "shop_a",
  ruleCode: "CG-SKU-001",
  resourceGid: "gid://shopify/Product/1",
  subresourceGid: "gid://shopify/ProductVariant/1",
  currentStatus: "OPEN",
  latestStatus: "FAIL",
} as const;

test("exact waiver creation preserves finding identity and requires one active waiver", async () => {
  const writes: unknown[] = [];
  const created = await createExactFindingWaiverV1(
    {
      shopId: "shop_a",
      findingId: "finding_a",
      reason: " Approved legacy exception ",
      notes: " temporary launch waiver ",
      createdAt: "2026-09-04T12:00:00.000Z",
      expiresAt: "2026-09-11T12:00:00.000Z",
      createdByActor: "merchant-user",
    },
    {
      loadFinding: async () => finding,
      loadExactExceptions: async () => [],
      nextId: () => "exception_a",
      persistCreate: async (input) => writes.push(input),
    },
  );

  assert.deepEqual(created, {
    id: "exception_a",
    shopId: "shop_a",
    coverageType: "FINDING_EXACT",
    ruleCode: "CG-SKU-001",
    resourceGid: "gid://shopify/Product/1",
    subresourceGid: "gid://shopify/ProductVariant/1",
    reason: "Approved legacy exception",
    createdAt: "2026-09-04T12:00:00.000Z",
    expiresAt: "2026-09-11T12:00:00.000Z",
  });
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0], {
    exception: created,
    findingId: "finding_a",
    notes: "temporary launch waiver",
    createdByActor: "merchant-user",
  });

  await assert.rejects(
    () =>
      createExactFindingWaiverV1(
        {
          shopId: "shop_a",
          findingId: "finding_a",
          reason: "Duplicate",
          createdAt: "2026-09-05T12:00:00.000Z",
        },
        {
          loadFinding: async () => finding,
          loadExactExceptions: async () => [created],
          nextId: () => "exception_b",
          persistCreate: async () => undefined,
        },
      ),
    /active exact waiver already exists/,
  );
});

test("exact waiver creation rejects non-fail findings and invalid expiry", async () => {
  await assert.rejects(
    () =>
      createExactFindingWaiverV1(
        {
          shopId: "shop_a",
          findingId: "finding_a",
          reason: "Bad expiry",
          createdAt: "2026-09-04T12:00:00.000Z",
          expiresAt: "2026-09-04T11:00:00.000Z",
        },
        {
          loadFinding: async () => finding,
          loadExactExceptions: async () => [],
          nextId: () => "exception_a",
          persistCreate: async () => undefined,
        },
      ),
    /expiresAt must be after/,
  );

  await assert.rejects(
    () =>
      createExactFindingWaiverV1(
        {
          shopId: "shop_a",
          findingId: "finding_a",
          reason: "Not a failure",
          createdAt: "2026-09-04T12:00:00.000Z",
        },
        {
          loadFinding: async () => ({
            ...finding,
            latestStatus: "PASS",
          }),
          loadExactExceptions: async () => [],
          nextId: () => "exception_a",
          persistCreate: async () => undefined,
        },
      ),
    /technical FAIL/,
  );
});

test("revocation records a timestamp/reason and never deletes the exception", async () => {
  const writes: unknown[] = [];
  const result = await revokeExactFindingWaiverV1(
    {
      shopId: "shop_a",
      exceptionId: "exception_a",
      revokedAt: "2026-09-06T12:00:00.000Z",
      revokedByActor: "merchant-user",
      revocationReason: " Issue must now be fixed ",
    },
    {
      loadException: async () => ({
        id: "exception_a",
        shopId: "shop_a",
        coverageType: "FINDING_EXACT",
        ruleCode: finding.ruleCode,
        resourceGid: finding.resourceGid,
        subresourceGid: finding.subresourceGid,
        reason: "Approved legacy exception",
        createdAt: "2026-09-04T12:00:00.000Z",
        findingId: "finding_a",
      }),
      persistRevoke: async (input) => writes.push(input),
    },
  );

  assert.equal(result.revokedAt, "2026-09-06T12:00:00.000Z");
  assert.deepEqual(writes[0], {
    shopId: "shop_a",
    exceptionId: "exception_a",
    revokedAt: "2026-09-06T12:00:00.000Z",
    revokedByActor: "merchant-user",
    revocationReason: "Issue must now be fixed",
    findingId: "finding_a",
  });
});
