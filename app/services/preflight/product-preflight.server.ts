import type {
  RunCollectionPreflightInputV1,
  RunProductPreflightInputV1,
} from "../../application/run-product-preflight";
import {
  runCollectionPreflightV1,
  runProductPreflightV1,
} from "../../application/run-product-preflight";
import { PrismaPreflightRepository } from "../../persistence/prisma-preflight-repository.server";
import { loadExactRuleExceptionsForEvaluationV1 } from "../exceptions/exact-exceptions.server";
import { loadActiveValidatedPolicyRevisionV1 } from "../policies/active-policy.server";
import {
  readCollectionProductTargetFromShopifyAdmin,
  readVerifiedCatalogFromShopifyAdmin,
  type ShopifyAdminGraphqlClient,
} from "../shopify/catalog-reader.server";

type RunProductPreflightForShopInputV1 = Omit<
  RunProductPreflightInputV1<ShopifyAdminGraphqlClient>,
  "loadActiveRevision" | "loadExceptions" | "readCatalog" | "repository"
>;

type RunCollectionPreflightForShopInputV1 = Omit<
  RunCollectionPreflightInputV1<ShopifyAdminGraphqlClient>,
  | "loadActiveRevision"
  | "loadExceptions"
  | "readCatalog"
  | "readCollectionTarget"
  | "repository"
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

export async function runCollectionPreflightForShopV1(
  input: RunCollectionPreflightForShopInputV1,
) {
  const repository = new PrismaPreflightRepository();

  return runCollectionPreflightV1({
    ...input,
    loadActiveRevision: loadActiveValidatedPolicyRevisionV1,
    loadExceptions: loadExactRuleExceptionsForEvaluationV1,
    readCatalog: readVerifiedCatalogFromShopifyAdmin,
    readCollectionTarget: readCollectionProductTargetFromShopifyAdmin,
    repository,
  });
}
