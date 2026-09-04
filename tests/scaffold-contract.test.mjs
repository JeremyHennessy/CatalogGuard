import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Shopify API is pinned to 2026-07", async () => {
  const server = await read("app/shopify.server.ts");
  const graphqlConfig = await read(".graphqlrc.ts");
  const appConfig = await read("shopify.app.toml");

  assert.match(server, /ApiVersion\.July26/);
  assert.match(graphqlConfig, /ApiVersion\.July26/);
  assert.match(appConfig, /api_version = "2026-07"/);
});

test("Phase 1 scopes are read-only and catalog-only", async () => {
  const appConfig = await read("shopify.app.toml");
  const envExample = await read(".env.example");

  assert.match(appConfig, /scopes = "read_products"/);
  assert.match(envExample, /SCOPES=read_products/);
  assert.doesNotMatch(appConfig, /write_products|read_customers|read_orders/);
  assert.doesNotMatch(envExample, /write_products|read_customers|read_orders/);
});

test("Shopify app config subscribes to product catalog webhooks", async () => {
  const appConfig = await read("shopify.app.toml");

  assert.match(appConfig, /uri = "\/webhooks\/products"/);
  assert.match(
    appConfig,
    /topics = \["products\/create", "products\/update", "products\/delete"\]/,
  );
  assert.doesNotMatch(appConfig, /write_products/);
});

test("Shopify CLI recognizes the React Router web process", async () => {
  const webConfig = await read("shopify.web.toml");

  assert.match(webConfig, /roles = \["frontend", "backend"\]/);
  assert.match(webConfig, /predev = "npm exec prisma generate"/);
  assert.match(
    webConfig,
    /dev = "npm exec prisma migrate deploy && npm exec react-router dev"/,
  );
});

test("React Router actions trust only the configured Shopify app origin", async () => {
  const routerConfig = await read("react-router.config.ts");

  assert.match(routerConfig, /process\.env\.SHOPIFY_APP_URL/);
  assert.match(
    routerConfig,
    /allowedActionOrigins: configuredActionOrigins\(\)/,
  );
  assert.match(routerConfig, /return \[parsed\.host\]/);
  assert.doesNotMatch(
    routerConfig,
    /\*\.trycloudflare\.com|\*\*\.trycloudflare\.com/,
  );
});

test("CatalogGuard Shopify catalog path remains read-only", async () => {
  const source = await read("app/domain/catalog/shopify-source.ts");
  const reader = await read("app/services/shopify/catalog-reader.server.ts");
  const scanService = await read(
    "app/services/scans/catalog-policy-scan.server.ts",
  );
  const route = await read("app/routes/app._index.tsx");
  const combined = [source, reader, scanService, route].join("\n");

  assert.match(source, /query CatalogGuardProducts/);
  assert.match(source, /query CatalogGuardVariants/);
  assert.doesNotMatch(combined, /\bmutation\b/);
  assert.doesNotMatch(
    combined,
    /productCreate|productUpdate|productVariantsBulkUpdate/,
  );
});

test("embedded Findings navigation uses Shopify links rather than raw anchors", async () => {
  const overview = await read("app/routes/app._index.tsx");
  const findings = await read("app/routes/app.findings.tsx");
  const findingDetail = await read("app/routes/app.finding.$findingId.tsx");
  const combined = [overview, findings, findingDetail].join("\n");

  assert.match(overview, /<s-link href="\/app\/findings">/);
  assert.match(findings, /<s-link href="\/app">/);
  assert.match(findingDetail, /<s-link href="\/app\/findings">/);
  assert.doesNotMatch(combined, /<a\b/);
});

test("environment example contains placeholders rather than token-shaped secrets", async () => {
  const envExample = await read(".env.example");

  assert.doesNotMatch(envExample, /shpat_|shpca_|shpss_|sk_live_|-----BEGIN/);
});
