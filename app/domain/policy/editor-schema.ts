export type PolicyRuleEditorFieldV1 =
  | Readonly<{
      kind: "ENUM";
      key: string;
      label: string;
      values: readonly string[];
    }>
  | Readonly<{
      kind: "DECIMAL";
      key: string;
      label: string;
    }>
  | Readonly<{
      kind: "POSITIVE_INTEGER";
      key: string;
      label: string;
    }>
  | Readonly<{
      kind: "STRING_LIST";
      key: string;
      label: string;
      optional: boolean;
    }>;

export type PolicyRuleEditorSchemaV1 = Readonly<{
  title: string;
  fields: readonly PolicyRuleEditorFieldV1[];
}>;

const NONE = Object.freeze([]) as readonly PolicyRuleEditorFieldV1[];
const NORMALIZATION = Object.freeze([
  Object.freeze({
    kind: "ENUM" as const,
    key: "normalization",
    label: "Identifier normalization",
    values: Object.freeze(["EXACT", "TRIM"]),
  }),
]);
const MIN_LENGTH = Object.freeze([
  Object.freeze({
    kind: "POSITIVE_INTEGER" as const,
    key: "minLength",
    label: "Minimum text length",
  }),
]);

const EDITORS: Readonly<Record<string, PolicyRuleEditorSchemaV1>> =
  Object.freeze({
    "CG-SKU-001": Object.freeze({ title: "SKU required", fields: NONE }),
    "CG-SKU-002": Object.freeze({
      title: "SKU unique",
      fields: NORMALIZATION,
    }),
    "CG-BARCODE-001": Object.freeze({
      title: "Barcode required",
      fields: NONE,
    }),
    "CG-BARCODE-002": Object.freeze({
      title: "Barcode unique",
      fields: NORMALIZATION,
    }),
    "CG-PRICE-001": Object.freeze({
      title: "Minimum price",
      fields: Object.freeze([
        Object.freeze({
          kind: "DECIMAL" as const,
          key: "minimum",
          label: "Minimum price",
        }),
      ]),
    }),
    "CG-PRICE-002": Object.freeze({
      title: "Compare-at price relationship",
      fields: NONE,
    }),
    "CG-DESC-001": Object.freeze({
      title: "Description minimum",
      fields: MIN_LENGTH,
    }),
    "CG-VENDOR-001": Object.freeze({
      title: "Vendor required / allowed values",
      fields: Object.freeze([
        Object.freeze({
          kind: "STRING_LIST" as const,
          key: "allowedValues",
          label: "Allowed vendors",
          optional: true,
        }),
      ]),
    }),
    "CG-TYPE-001": Object.freeze({
      title: "Product type required / allowed values",
      fields: Object.freeze([
        Object.freeze({
          kind: "STRING_LIST" as const,
          key: "allowedValues",
          label: "Allowed product types",
          optional: true,
        }),
      ]),
    }),
    "CG-MEDIA-001": Object.freeze({
      title: "Minimum product media",
      fields: Object.freeze([
        Object.freeze({
          kind: "POSITIVE_INTEGER" as const,
          key: "minimum",
          label: "Minimum media items",
        }),
      ]),
    }),
    "CG-SEO-001": Object.freeze({
      title: "SEO title minimum",
      fields: MIN_LENGTH,
    }),
    "CG-SEO-002": Object.freeze({
      title: "SEO description minimum",
      fields: MIN_LENGTH,
    }),
    "CG-CAT-001": Object.freeze({
      title: "Shopify category required",
      fields: NONE,
    }),
    "CG-TAG-001": Object.freeze({
      title: "Required tags",
      fields: Object.freeze([
        Object.freeze({
          kind: "STRING_LIST" as const,
          key: "requiredTags",
          label: "Required tags",
          optional: false,
        }),
        Object.freeze({
          kind: "ENUM" as const,
          key: "match",
          label: "Tag match mode",
          values: Object.freeze(["ALL", "ANY"]),
        }),
      ]),
    }),
    "CG-OPT-001": Object.freeze({
      title: "Required option names",
      fields: Object.freeze([
        Object.freeze({
          kind: "STRING_LIST" as const,
          key: "requiredNames",
          label: "Required option names",
          optional: false,
        }),
      ]),
    }),
  });

export const POLICY_SCOPE_STATUSES_V1 = Object.freeze([
  "ACTIVE",
  "ARCHIVED",
  "DRAFT",
  "UNLISTED",
] as const);

export function policyRuleEditorSchemaV1(ruleCode: string) {
  const editor = EDITORS[ruleCode];
  if (!editor) {
    throw new Error(`no deterministic editor registered for rule: ${ruleCode}`);
  }
  return editor;
}
