import { test } from "node:test";
import assert from "node:assert/strict";

import { applyBaseline, createBaseline, issueSignature } from "../src/baseline";
import type { Issue } from "../src/types";

const missingB: Issue = {
  type: "missing-key",
  severity: "error",
  locale: "fr",
  key: "b",
  file: "locales/en.json",
  line: 3,
  message: 'Key "b" is missing in "fr".',
};
const missingC: Issue = { ...missingB, key: "c", message: 'Key "c" is missing in "fr".' };

test("applyBaseline suppresses issues present in the baseline", () => {
  const baseline = createBaseline([missingB]);
  const { issues, suppressed } = applyBaseline([missingB, missingC], baseline);
  assert.equal(suppressed, 1);
  assert.deepEqual(
    issues.map((i) => i.key),
    ["c"],
  );
});

test("signatures are line-independent", () => {
  const movedB: Issue = { ...missingB, line: 99 };
  assert.equal(issueSignature(missingB), issueSignature(movedB));
  const { suppressed } = applyBaseline([movedB], createBaseline([missingB]));
  assert.equal(suppressed, 1);
});

test("a different file is not suppressed", () => {
  const other: Issue = { ...missingB, file: "locales/other.json" };
  const { suppressed } = applyBaseline([other], createBaseline([missingB]));
  assert.equal(suppressed, 0);
});
