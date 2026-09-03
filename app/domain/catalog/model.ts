export const CATALOG_SCHEMA_VERSION = 1 as const;
export const NORMALIZATION_VERSION = "catalog-v1";

export type FieldAvailability =
  | "AVAILABLE"
  | "UNAVAILABLE"
  | "NOT_REQUESTED"
  | "UNRELIABLE";

export type FieldEvidence<T> =
  | {
      availability: "AVAILABLE";
      value: T;
    }
  | {
      availability: Exclude<FieldAvailability, "AVAILABLE">;
      reason: string;
    };

export function available<T>(value: T): FieldEvidence<T> {
  return { availability: "AVAILABLE", value };
}

export function unavailable<T>(reason: string): FieldEvidence<T> {
  return { availability: "UNAVAILABLE", reason };
}

export function notRequested<T>(reason: string): FieldEvidence<T> {
  return { availability: "NOT_REQUESTED", reason };
}

export function unreliable<T>(reason: string): FieldEvidence<T> {
  return { availability: "UNRELIABLE", reason };
}

export type ProductStatus = "ACTIVE" | "ARCHIVED" | "DRAFT" | "UNLISTED";

export type NormalizedOptionValueV1 = {
  name: string;
  value: string;
};

export type NormalizedVariantV1 = {
  schemaVersion: typeof CATALOG_SCHEMA_VERSION;
  gid: string;
  productGid: string;
  title: string;
  sku: FieldEvidence<string | null>;
  barcode: FieldEvidence<string | null>;
  price: FieldEvidence<string>;
  compareAtPrice: FieldEvidence<string | null>;
  selectedOptions: FieldEvidence<readonly NormalizedOptionValueV1[]>;
};

export type NormalizedProductV1 = {
  schemaVersion: typeof CATALOG_SCHEMA_VERSION;
  gid: string;
  title: string;
  status: FieldEvidence<ProductStatus>;
  descriptionText: FieldEvidence<string>;
  seoTitle: FieldEvidence<string | null>;
  seoDescription: FieldEvidence<string | null>;
  vendor: FieldEvidence<string>;
  productType: FieldEvidence<string>;
  tags: FieldEvidence<readonly string[]>;
  categoryGid: FieldEvidence<string | null>;
  mediaCount: FieldEvidence<number>;
  variants: readonly NormalizedVariantV1[];
};

export type EvaluationTargetV1 = {
  product: NormalizedProductV1;
  variant?: NormalizedVariantV1;
};

export function isAvailable<T>(
  evidence: FieldEvidence<T>,
): evidence is Extract<FieldEvidence<T>, { availability: "AVAILABLE" }> {
  return evidence.availability === "AVAILABLE";
}
