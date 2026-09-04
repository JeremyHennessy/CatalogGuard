import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { persistCatalogChangeWebhookV1 } from "../services/webhooks/catalog-change-webhooks.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { apiVersion, payload, shop, topic, webhookId } =
    await authenticate.webhook(request);
  const result = await persistCatalogChangeWebhookV1({
    webhookId,
    shopDomain: shop,
    topic: String(topic),
    apiVersion,
    payload,
  });

  console.log(
    `Recorded ${result.status} ${topic} webhook ${webhookId} for ${shop}`,
  );

  return new Response();
};
