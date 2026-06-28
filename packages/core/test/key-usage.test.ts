import { test } from "node:test";
import assert from "node:assert/strict";

import { checkKeyUsage } from "../src/key-usage";
import type { KeyReference, LocaleEntry } from "../src/types";

function entries(keys: string[]): Map<string, LocaleEntry> {
  const map = new Map<string, LocaleEntry>();
  for (const k of keys) map.set(k, { value: "x", file: "en.json", line: 1 });
  return map;
}
function undefinedKeys(issues: { type: string; key?: string }[]): (string | undefined)[] {
  return issues.filter((i) => i.type === "undefined-key").map((i) => i.key);
}

test("flags a specific key used in code but missing from the locale", () => {
  const refs: KeyReference[] = [
    { key: "app.title", file: "a.tsx", line: 3 },
    { key: "app.titel", file: "a.tsx", line: 4 }, // typo
  ];
  assert.deepEqual(undefinedKeys(checkKeyUsage(entries(["app.title"]), refs)), ["app.titel"]);
});

test("namespaced reference resolves via useTranslations namespace", () => {
  const refs: KeyReference[] = [{ key: "title", namespace: "Home", file: "a.tsx", line: 1 }];
  assert.equal(undefinedKeys(checkKeyUsage(entries(["Home.title"]), refs)).length, 0);
});

test("a typo under a known namespace is flagged with the resolved key", () => {
  const refs: KeyReference[] = [{ key: "titel", namespace: "Home", file: "a.tsx", line: 1 }];
  assert.deepEqual(undefinedKeys(checkKeyUsage(entries(["Home.title"]), refs)), ["Home.titel"]);
});

test("bare reference matches a namespaced (colon) locale key", () => {
  // react-i18next default namespace: code says t('app.title'), key is translation:app.title
  const refs: KeyReference[] = [{ key: "app.title", file: "a.tsx", line: 1 }];
  assert.equal(undefinedKeys(checkKeyUsage(entries(["translation:app.title"]), refs)).length, 0);
});

test("ambiguous bare key (no dot/colon/namespace) is never flagged", () => {
  const refs: KeyReference[] = [{ key: "save", file: "a.tsx", line: 1 }];
  assert.equal(undefinedKeys(checkKeyUsage(entries(["common:other"]), refs)).length, 0);
});

test("unused-key is opt-in and skipped when dynamic usage is present", () => {
  const src = entries(["a", "b"]);
  const refs: KeyReference[] = [{ key: "a", file: "x", line: 1 }];

  const off = checkKeyUsage(src, refs);
  assert.equal(off.filter((i) => i.type === "unused-key").length, 0);

  const on = checkKeyUsage(src, refs, { unusedKeys: true });
  const unused = on.filter((i) => i.type === "unused-key");
  assert.deepEqual(unused.map((i) => i.key), ["b"]);

  const dynamic = checkKeyUsage(src, refs, { unusedKeys: true, hasDynamicKeys: true });
  assert.equal(dynamic.filter((i) => i.type === "unused-key").length, 0);
});
