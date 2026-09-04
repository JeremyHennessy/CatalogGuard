import * as assert from "node:assert/strict";
import { test } from "node:test";
import { policyRuleEditorSchemaV1 } from "../../app/domain/policy/editor-schema";
import { createBuiltinRuleRegistry } from "../../app/domain/rules/registry";

test("every built-in rule has a deterministic merchant editor schema", () => {
  const definitions = createBuiltinRuleRegistry().list();
  assert.equal(definitions.length, 15);

  for (const definition of definitions) {
    const editor = policyRuleEditorSchemaV1(definition.code);
    assert.ok(editor.title.length > 0, definition.code);
    for (const field of editor.fields) {
      assert.ok(field.key.length > 0, definition.code);
      assert.ok(field.label.length > 0, definition.code);
    }
  }
});

test("editor schema exposes only constrained known field types", () => {
  assert.deepEqual(policyRuleEditorSchemaV1("CG-SKU-002").fields, [
    {
      kind: "ENUM",
      key: "normalization",
      label: "Identifier normalization",
      values: ["EXACT", "TRIM"],
    },
  ]);
  assert.equal(
    policyRuleEditorSchemaV1("CG-PRICE-001").fields[0]?.kind,
    "DECIMAL",
  );
  assert.equal(
    policyRuleEditorSchemaV1("CG-TAG-001").fields[0]?.kind,
    "STRING_LIST",
  );
  assert.throws(
    () => policyRuleEditorSchemaV1("CG-NOT-REAL"),
    /no deterministic editor/,
  );
});
