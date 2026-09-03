import * as assert from "node:assert/strict";
import { test } from "node:test";
import { available, unavailable } from "../../app/domain/catalog/model";
import {
  evaluateProductScope,
  parseProductScopeV1,
} from "../../app/domain/rules/scope";
import { RuleConfigError } from "../../app/domain/rules/config";
import { makeProduct } from "./fixtures";

test("scope returns MATCH for exact supported predicates", () => {
  const product = makeProduct();
  const scope = parseProductScopeV1({
    statuses: ["ACTIVE"],
    vendors: ["Example Vendor"],
    productTypes: ["Example Type"],
    tagsAny: ["summer"],
    tagsAll: ["summer", "featured"],
  });

  assert.deepEqual(evaluateProductScope(product, scope), { status: "MATCH" });
});

test("known exclusion wins over unrelated unknown scope evidence", () => {
  const product = makeProduct({
    vendor: unavailable("vendor not requested"),
    productType: available("Wrong Type"),
  });

  const result = evaluateProductScope(product, {
    vendors: ["Example Vendor"],
    productTypes: ["Example Type"],
  });

  assert.deepEqual(result, {
    status: "NO_MATCH",
    reasonCode: "SCOPE_PRODUCT_TYPE_NO_MATCH",
  });
});

test("scope returns UNKNOWN when applicability depends on unavailable evidence", () => {
  const product = makeProduct({
    vendor: unavailable("vendor fetch failed"),
  });

  assert.deepEqual(
    evaluateProductScope(product, { vendors: ["Example Vendor"] }),
    {
      status: "UNKNOWN",
      reasonCode: "SCOPE_UNAVAILABLE",
      field: "vendor",
    },
  );
});

test("invalid scope configuration is rejected before evaluation", () => {
  assert.throws(
    () => parseProductScopeV1({ statuses: ["PUBLISHED"] }),
    RuleConfigError,
  );

  assert.throws(
    () => parseProductScopeV1({ arbitraryCode: "not allowed" }),
    RuleConfigError,
  );
});
