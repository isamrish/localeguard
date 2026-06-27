import { test } from "node:test";
import assert from "node:assert/strict";

import {
  extractPlaceholders,
  comparePlaceholders,
} from "../src/placeholder-validator/placeholder";

test("extracts i18next double-brace variables", () => {
  assert.deepEqual([...extractPlaceholders("Hi {{userName}}, you have {{count}}")], [
    "userName",
    "count",
  ]);
});

test("extracts ICU single-brace variables", () => {
  assert.deepEqual([...extractPlaceholders("Hi {userName}, {count, number}")], [
    "userName",
    "count",
  ]);
});

test("non-strings have no placeholders", () => {
  assert.equal(extractPlaceholders(42).size, 0);
  assert.equal(extractPlaceholders(null).size, 0);
});

test("matching variable sets produce no diff", () => {
  assert.equal(comparePlaceholders("Hi {{name}}", "Merhaba {{name}}"), null);
});

test("reports missing and unexpected variables", () => {
  const diff = comparePlaceholders("Hi {{name}}, {{count}}", "Merhaba {{name}} {{adet}}");
  assert.deepEqual(diff, { missing: ["count"], extra: ["adet"] });
});
