import { test } from "node:test";
import assert from "node:assert/strict";

import { parseJson, JsonParseError } from "../src/json/parse";

test("parses nested objects and records key lines", () => {
  const text = '{\n  "a": {\n    "b": "hi"\n  }\n}';
  const { value, keyLines } = parseJson(text);
  assert.deepEqual(value, { a: { b: "hi" } });
  assert.equal(keyLines.get("a"), 2);
  assert.equal(keyLines.get("a.b"), 3);
});

test("detects duplicate keys with their line", () => {
  const text = '{\n  "x": 1,\n  "x": 2\n}';
  const { value, duplicates } = parseJson(text);
  assert.deepEqual(value, { x: 2 }); // last value wins, like JSON.parse
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0]?.path, "x");
  assert.equal(duplicates[0]?.line, 3);
});

test("reports invalid JSON with a line number", () => {
  const text = '{\n  "a": 1,\n  "b":\n}';
  assert.throws(
    () => parseJson(text),
    (err: unknown) => {
      assert.ok(err instanceof JsonParseError);
      assert.equal((err as JsonParseError).line, 4);
      return true;
    },
  );
});

test("handles escapes and unicode", () => {
  const { value } = parseJson('{"k": "a\\n\\u0041"}');
  assert.deepEqual(value, { k: "a\nA" });
});

test("parses arrays, numbers, booleans, and null", () => {
  const { value } = parseJson('{"a": [1, true, null, -2.5e3]}');
  assert.deepEqual(value, { a: [1, true, null, -2500] });
});
