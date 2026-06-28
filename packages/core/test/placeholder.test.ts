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

test("ICU plural extracts only the argument name, not sub-messages", () => {
  assert.deepEqual(
    [...extractPlaceholders("{count, plural, one {# item} other {# items}}")],
    ["count"],
  );
});

test("ICU select sub-messages are not treated as variables (no false positive)", () => {
  const en = "{gender, select, male {He} female {She} other {They}} replied";
  const tr = "{gender, select, male {O} female {O} other {O}} yanıtladı";
  assert.equal(comparePlaceholders(en, tr), null);
});

test("positional and format args match regardless of order", () => {
  assert.equal(comparePlaceholders("See step {0} of {1}", "{1}. adimdan {0}"), null);
  assert.equal(
    comparePlaceholders("Updated {{date, datetime}} by {{user}}", "{{date, datetime}} {{user}}"),
    null,
  );
});

test("a genuinely renamed variable is still caught", () => {
  assert.deepEqual(comparePlaceholders("Deleted {{itemName}}", "{{urunAdi}} silindi"), {
    missing: ["itemName"],
    extra: ["urunAdi"],
  });
});
