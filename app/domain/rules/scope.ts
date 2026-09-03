import type {
  FieldEvidence,
  NormalizedProductV1,
  ProductStatus,
} from "../catalog/model";
import {
  RuleConfigError,
  asObject,
  rejectUnknownKeys,
} from "./config";

export type ProductScopeV1 = {
  statuses?: readonly ProductStatus[];
  vendors?: readonly string[];
  productTypes?: readonly string[];
  tagsAny?: readonly string[];
  tagsAll?: readonly string[];
};

export type ScopeEvaluation =
  | { status: "MATCH" }
  | { status: "NO_MATCH"; reasonCode: string }
  | { status: "UNKNOWN"; reasonCode: string; field: string };

const STATUS_VALUES = ["ACTIVE", "ARCHIVED", "DRAFT", "UNLISTED"] as const;

function parseStringArray(
  value: unknown,
  field: string,
  allowed?: readonly string[],
): readonly string[] | undefined {
  if (value === undefined) return undefined;

  if (!Array.isArray(value) || value.length === 0) {
    throw new RuleConfigError(
      "SCOPE",
      `${field} must be a non-empty array`,
    );
  }

  const parsed = value.map((item) => {
    if (typeof item !== "string" || item.length === 0) {
      throw new RuleConfigError(
        "SCOPE",
        `${field} values must be non-empty strings`,
      );
    }

    if (allowed && !allowed.includes(item)) {
      throw new RuleConfigError(
        "SCOPE",
        `${field} contains unsupported value: ${item}`,
      );
    }

    return item;
  });

  return [...new Set(parsed)];
}

export function parseProductScopeV1(input: unknown): ProductScopeV1 {
  const object = asObject(input, "SCOPE");
  rejectUnknownKeys(
    object,
    ["statuses", "vendors", "productTypes", "tagsAny", "tagsAll"],
    "SCOPE",
  );

  return {
    statuses: parseStringArray(
      object.statuses,
      "statuses",
      STATUS_VALUES,
    ) as readonly ProductStatus[] | undefined,
    vendors: parseStringArray(object.vendors, "vendors"),
    productTypes: parseStringArray(object.productTypes, "productTypes"),
    tagsAny: parseStringArray(object.tagsAny, "tagsAny"),
    tagsAll: parseStringArray(object.tagsAll, "tagsAll"),
  };
}

function unknown(
  field: string,
  evidence: FieldEvidence<unknown>,
): ScopeEvaluation {
  return {
    status: "UNKNOWN",
    reasonCode: `SCOPE_${evidence.availability}`,
    field,
  };
}

export function evaluateProductScope(
  product: NormalizedProductV1,
  scope: ProductScopeV1,
): ScopeEvaluation {
  let unknownResult: ScopeEvaluation | undefined;

  if (scope.statuses) {
    if (product.status.availability !== "AVAILABLE") {
      unknownResult ??= unknown("status", product.status);
    } else if (!scope.statuses.includes(product.status.value)) {
      return { status: "NO_MATCH", reasonCode: "SCOPE_STATUS_NO_MATCH" };
    }
  }

  if (scope.vendors) {
    if (product.vendor.availability !== "AVAILABLE") {
      unknownResult ??= unknown("vendor", product.vendor);
    } else if (!scope.vendors.includes(product.vendor.value)) {
      return { status: "NO_MATCH", reasonCode: "SCOPE_VENDOR_NO_MATCH" };
    }
  }

  if (scope.productTypes) {
    if (product.productType.availability !== "AVAILABLE") {
      unknownResult ??= unknown("productType", product.productType);
    } else if (!scope.productTypes.includes(product.productType.value)) {
      return {
        status: "NO_MATCH",
        reasonCode: "SCOPE_PRODUCT_TYPE_NO_MATCH",
      };
    }
  }

  const tags = product.tags;

  if (scope.tagsAny) {
    if (tags.availability !== "AVAILABLE") {
      unknownResult ??= unknown("tags", tags);
    } else if (!scope.tagsAny.some((tag) => tags.value.includes(tag))) {
      return { status: "NO_MATCH", reasonCode: "SCOPE_TAGS_ANY_NO_MATCH" };
    }
  }

  if (scope.tagsAll) {
    if (tags.availability !== "AVAILABLE") {
      unknownResult ??= unknown("tags", tags);
    } else if (!scope.tagsAll.every((tag) => tags.value.includes(tag))) {
      return { status: "NO_MATCH", reasonCode: "SCOPE_TAGS_ALL_NO_MATCH" };
    }
  }

  return unknownResult ?? { status: "MATCH" };
}
