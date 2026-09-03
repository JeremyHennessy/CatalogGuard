import type { Config } from "@react-router/dev/config";

function configuredActionOrigins(): string[] {
  const appUrl = process.env.SHOPIFY_APP_URL || process.env.HOST;

  if (!appUrl) {
    return [];
  }

  const parsed = new URL(appUrl);

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("SHOPIFY_APP_URL must use http or https");
  }

  return [parsed.host];
}

export default {
  allowedActionOrigins: configuredActionOrigins(),
} satisfies Config;
