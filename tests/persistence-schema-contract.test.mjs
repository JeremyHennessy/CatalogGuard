import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath =
  "prisma/migrations/20260903132500_add_domain_persistence/migration.sql";

test("domain persistence models cover policy, evidence, lifecycle, and preflight", async () => {
  const schema = await read("prisma/schema.prisma");

  for (const model of [
    "Shop",
    "Policy",
    "PolicyRevision",
    "PolicyRule",
    "Scan",
    "Evaluation",
    "Finding",
    "FindingEvent",
    "RuleException",
    "PreflightRun",
    "PreflightTarget",
  ]) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
  }

  assert.match(schema, /@@unique\(\[policyId, revisionNumber\]\)/);
  assert.match(schema, /@@unique\(\[shopId, findingKey\]\)/);
  assert.match(
    schema,
    /@@unique\(\[preflightRunId, resourceType, resourceGid\]\)/,
  );
  assert.match(schema, /coverageType\s+String\s+@default\("FINDING_EXACT"\)/);
  assert.match(schema, /latestEvaluationId\s+String/);
});

test("migration contains the evidence-protecting uniqueness constraints", async () => {
  const migration = await read(migrationPath);

  assert.match(
    migration,
    /PolicyRevision_policyId_revisionNumber_key.*policyId.*revisionNumber/s,
  );
  assert.match(migration, /Finding_shopId_findingKey_key.*shopId.*findingKey/s);
  assert.match(
    migration,
    /PreflightTarget_preflightRunId_resourceType_resourceGid_key.*preflightRunId.*resourceType.*resourceGid/s,
  );
  assert.match(migration, /ON DELETE RESTRICT/);
});

test("quality gate deploys migrations against a clean development database", async () => {
  const workflow = await read(".github/workflows/ci.yml");
  const packageJson = JSON.parse(await read("package.json"));

  assert.equal(
    packageJson.scripts["prisma:migrate:deploy"],
    "prisma migrate deploy",
  );
  assert.match(workflow, /Verify migrations from clean database/);
  assert.match(
    workflow,
    /rm -f prisma\/dev\.sqlite prisma\/dev\.sqlite-journal/,
  );
  assert.match(workflow, /npm run prisma:migrate:deploy/);
});
