export type IdentifierType = "SKU" | "BARCODE";
export type IdentifierNormalizationMode = "EXACT" | "TRIM";
export type IdentifierIndexCompleteness = "COMPLETE" | "PARTIAL";

export type IdentifierReference = {
  productGid: string;
  variantGid: string;
  rawValue: string;
};

export type IdentifierLookupResult = {
  completeness: IdentifierIndexCompleteness;
  normalizedValue: string;
  matches: readonly IdentifierReference[];
};

export interface IdentifierLookup {
  lookup(
    type: IdentifierType,
    rawValue: string,
    normalization: IdentifierNormalizationMode,
  ): IdentifierLookupResult;
}

type VariantIdentifiers = {
  productGid: string;
  variantGid: string;
  sku?: string | null;
  barcode?: string | null;
};

export function isBlankIdentifier(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim().length === 0;
}

export function normalizeIdentifier(
  value: string,
  mode: IdentifierNormalizationMode,
): string {
  return mode === "TRIM" ? value.trim() : value;
}

export class InMemoryIdentifierIndex implements IdentifierLookup {
  private readonly variants = new Map<string, VariantIdentifiers>();

  constructor(
    readonly completeness: IdentifierIndexCompleteness = "COMPLETE",
  ) {}

  upsertVariant(input: VariantIdentifiers) {
    this.variants.set(input.variantGid, { ...input });
  }

  removeVariant(variantGid: string) {
    this.variants.delete(variantGid);
  }

  lookup(
    type: IdentifierType,
    rawValue: string,
    normalization: IdentifierNormalizationMode,
  ): IdentifierLookupResult {
    const normalizedValue = normalizeIdentifier(rawValue, normalization);
    const matches: IdentifierReference[] = [];

    for (const variant of this.variants.values()) {
      const candidate = type === "SKU" ? variant.sku : variant.barcode;
      if (isBlankIdentifier(candidate)) continue;

      if (normalizeIdentifier(candidate as string, normalization) === normalizedValue) {
        matches.push({
          productGid: variant.productGid,
          variantGid: variant.variantGid,
          rawValue: candidate as string,
        });
      }
    }

    matches.sort((a, b) => a.variantGid.localeCompare(b.variantGid));

    return {
      completeness: this.completeness,
      normalizedValue,
      matches,
    };
  }
}
