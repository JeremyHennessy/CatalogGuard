import prisma from "../../db.server";
import type { ShopifyAdminGraphqlClient } from "../shopify/catalog-reader.server";

const SHOP_IDENTITY_QUERY = `#graphql
  query CatalogGuardShopIdentity {
    shop {
      id
    }
  }
`;

type ShopIdentityPayload = {
  data?: { shop: { id: string } };
  errors?: Array<{ message: string }>;
};

export type CatalogGuardShopRecordV1 = Readonly<{
  id: string;
  shopifyShopId: string;
  shopDomain: string;
  currentScopes: string | null;
  apiVersion: string;
}>;

function selectShopRecord() {
  return {
    id: true,
    shopifyShopId: true,
    shopDomain: true,
    currentScopes: true,
    apiVersion: true,
  } as const;
}

async function readShopifyShopId(admin: ShopifyAdminGraphqlClient) {
  const response = await admin.graphql(SHOP_IDENTITY_QUERY, { variables: {} });
  const payload = (await response.json()) as ShopIdentityPayload;

  if (payload.errors?.length) {
    throw new Error(
      `Shopify shop identity query failed: ${payload.errors
        .map((error) => error.message)
        .join("; ")}`,
    );
  }

  const shopifyShopId = payload.data?.shop.id;
  if (!shopifyShopId) {
    throw new Error("Shopify shop identity query returned no shop id");
  }

  return shopifyShopId;
}

export async function ensureCatalogGuardShopV1(input: {
  admin: ShopifyAdminGraphqlClient;
  shopDomain: string;
  currentScopes?: string;
  apiVersion: string;
}): Promise<CatalogGuardShopRecordV1> {
  if (input.shopDomain.trim().length === 0) {
    throw new Error("shopDomain must be non-empty");
  }

  const shopifyShopId = await readShopifyShopId(input.admin);
  const existingByDomain = await prisma.shop.findUnique({
    where: { shopDomain: input.shopDomain },
    select: selectShopRecord(),
  });

  if (existingByDomain) {
    if (existingByDomain.shopifyShopId !== shopifyShopId) {
      throw new Error(
        `shop identity conflict for ${input.shopDomain}: persisted ${existingByDomain.shopifyShopId}, observed ${shopifyShopId}`,
      );
    }

    return prisma.shop.update({
      where: { id: existingByDomain.id },
      data: {
        status: "ACTIVE",
        currentScopes: input.currentScopes ?? null,
        apiVersion: input.apiVersion,
        uninstalledAt: null,
      },
      select: selectShopRecord(),
    });
  }

  const existingByShopifyId = await prisma.shop.findUnique({
    where: { shopifyShopId },
    select: selectShopRecord(),
  });

  if (existingByShopifyId) {
    if (existingByShopifyId.shopDomain !== input.shopDomain) {
      throw new Error(
        `Shopify shop id ${shopifyShopId} is already linked to ${existingByShopifyId.shopDomain}; refusing implicit tenant reassignment`,
      );
    }

    return prisma.shop.update({
      where: { id: existingByShopifyId.id },
      data: {
        status: "ACTIVE",
        currentScopes: input.currentScopes ?? null,
        apiVersion: input.apiVersion,
        uninstalledAt: null,
      },
      select: selectShopRecord(),
    });
  }

  return prisma.shop.create({
    data: {
      shopifyShopId,
      shopDomain: input.shopDomain,
      currentScopes: input.currentScopes ?? null,
      apiVersion: input.apiVersion,
    },
    select: selectShopRecord(),
  });
}
