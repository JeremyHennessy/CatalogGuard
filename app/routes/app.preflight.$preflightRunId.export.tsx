import type { LoaderFunctionArgs } from "react-router";
import { preflightEvidenceExportJsonV1 } from "../application/preflight-evidence-export";
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
  return { shop };
}

function exportFilename(preflightRunId: string) {
  const safeId = preflightRunId.replace(/[^A-Za-z0-9._-]+/g, "_");
  return "catalogguard-preflight-" + safeId + ".json";
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  if (!params.preflightRunId) {
    throw new Response("Preflight run id is required", { status: 400 });
  }

  const { shop } = await authenticatedShop(request);
  const detail = await loadPreflightRunDetailV1(
    shop.id,
    params.preflightRunId,
  );
  if (!detail) {
    throw new Response("Preflight run not found", { status: 404 });
  }

  return new Response(preflightEvidenceExportJsonV1(detail), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition":
        "attachment; filename=\"" +
        exportFilename(params.preflightRunId) +
        "\"",
    },
  });
};
