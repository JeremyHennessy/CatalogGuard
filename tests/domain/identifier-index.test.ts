import * as assert from "node:assert/strict";
import { test } from "node:test";
import { InMemoryIdentifierIndex } from "../../app/domain/rules/identifier-index";

test("identifier index detects duplicate creation and removal by update", () => {
  const index = new InMemoryIdentifierIndex();

  index.upsertVariant({
    productGid: "p1",
    variantGid: "v1",
    sku: "A-1",
    barcode: "111",
  });
  index.upsertVariant({
    productGid: "p2",
    variantGid: "v2",
    sku: "A-1",
    barcode: "222",
  });

  assert.deepEqual(
    index.lookup("SKU", "A-1", "EXACT").matches.map((item) => item.variantGid),
    ["v1", "v2"],
  );

  index.upsertVariant({
    productGid: "p2",
    variantGid: "v2",
    sku: "A-2",
    barcode: "222",
  });

  assert.deepEqual(
    index.lookup("SKU", "A-1", "EXACT").matches.map((item) => item.variantGid),
    ["v1"],
  );
});

test("identifier index removes deleted variants", () => {
  const index = new InMemoryIdentifierIndex();

  index.upsertVariant({
    productGid: "p1",
    variantGid: "v1",
    sku: "A-1",
    barcode: "111",
  });
  index.upsertVariant({
    productGid: "p2",
    variantGid: "v2",
    sku: "A-1",
    barcode: "111",
  });

  index.removeVariant("v2");

  assert.equal(index.lookup("SKU", "A-1", "EXACT").matches.length, 1);
  assert.equal(index.lookup("BARCODE", "111", "EXACT").matches.length, 1);
});

test("identifier normalization is explicit and never case-folded", () => {
  const index = new InMemoryIdentifierIndex();

  index.upsertVariant({
    productGid: "p1",
    variantGid: "v1",
    sku: " SKU-1 ",
  });
  index.upsertVariant({
    productGid: "p2",
    variantGid: "v2",
    sku: "SKU-1",
  });
  index.upsertVariant({
    productGid: "p3",
    variantGid: "v3",
    sku: "sku-1",
  });

  assert.equal(index.lookup("SKU", "SKU-1", "EXACT").matches.length, 1);
  assert.equal(index.lookup("SKU", "SKU-1", "TRIM").matches.length, 2);
  assert.equal(index.lookup("SKU", "sku-1", "TRIM").matches.length, 1);
});
