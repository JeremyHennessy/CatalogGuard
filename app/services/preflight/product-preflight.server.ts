import type { RunProductPreflightInputV1 } from "../../application/run-product-preflight";
import { runProductPreflightV1 } from "../../application/run-product-preflight";
import { PrismaPreflightRepository } from "../../persistence/prisma-preflight-repository.server";
import { loadExactRuleExceptionsForEvaluationV1 } from "../exceptions/exact-exceptions.server";
import { loadActiveValidatedPolicyRevisionV1 } from "../policies/active-policy.server";
import {
  readVerifiedCatalogFromShopifyAdmin,
  type ShopifyAdminGraphqlClient,
} from "../shopify/catalog-reader.server";

type RunProductPreflightForShopInputV1 = Omit<
  RunProductPreflightInputV1<ShopifyAdminGraphqlClient>,
  "loadActiveRevision" | "loadExceptions" | "readCatalog" | "repository"
>;

export async function runProductPreflightForShopV1(
  input: RunProductPreflightForShopInputV1,
) {
  const repository = new PrismaPreflightRepository();

  return runProductPreflightV1({
    ...input,
    loadActiveRevision: loadActiveValidatedPolicyRevisionV1,
    loadExceptions: loadExactRuleExceptionsForEvaluationV1,
    readCatalog: readVerifiedCatalogFromShopifyAdmin,
    repository,
  });
}
