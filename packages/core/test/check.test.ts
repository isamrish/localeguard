import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { runCheck, LocaleGuardError } from "../src/check";
import { flatten } from "../src/flatten";
import { compareKeys } from "../src/key-comparator/compare";
import type { LocaleGuardConfig } from "../src/types";

function fixture(files: Record<string, unknown>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "localeguard-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, typeof content === "string" ? content : JSON.stringify(content));
  }
  return root;
}

test("flatten produces dotted leaf keys", () => {
  const map = flatten({ a: { b: "x" }, c: "y" });
  assert.deepEqual([...map.keys()].sort(), ["a.b", "c"]);
});

test("compareKeys splits missing, extra, and shared", () => {
  const diff = compareKeys(["a", "b", "c"], ["a", "d"]);
  assert.deepEqual(diff.missing, ["b", "c"]);
  assert.deepEqual(diff.extra, ["d"]);
  assert.deepEqual(diff.shared, ["a"]);
});

test("end-to-end: detects missing, extra, and placeholder issues", () => {
  const root = fixture({
    "locales/en.json": {
      greeting: "Hello {{name}}",
      farewell: "Goodbye",
      items: "{{count}} items",
    },
    "locales/tr.json": {
      greeting: "Merhaba {{isim}}", // placeholder mismatch
      farewell: "Hoşça kal",
      extra: "fazladan", // extra key
      // "items" missing
    },
  });

  const config: LocaleGuardConfig = {
    sourceLocale: "en",
    locales: ["tr"],
    localesPath: "locales",
  };

  const result = runCheck(config, { rootDir: root });
  assert.equal(result.stats.byType["missing-key"], 1);
  assert.equal(result.stats.byType["extra-key"], 1);
  assert.equal(result.stats.byType["placeholder-mismatch"], 1);
  assert.equal(result.stats.failed, true); // missing-key + placeholder are blocking
});

test("clean locales pass", () => {
  const root = fixture({
    "locales/en.json": { a: "A", b: "{{x}}" },
    "locales/fr.json": { a: "A-fr", b: "{{x}}-fr" },
  });
  const result = runCheck(
    { sourceLocale: "en", locales: ["fr"], localesPath: "locales" },
    { rootDir: root },
  );
  assert.equal(result.issues.length, 0);
  assert.equal(result.stats.failed, false);
});

test("missing source locale throws", () => {
  const root = fixture({ "locales/fr.json": { a: "A" } });
  assert.throws(
    () => runCheck({ sourceLocale: "en", locales: ["fr"], localesPath: "locales" }, { rootDir: root }),
    LocaleGuardError,
  );
});

test("invalid target JSON is reported, not thrown", () => {
  const root = fixture({
    "locales/en.json": { a: "A" },
    "locales/tr.json": "{ bad json",
  });
  const result = runCheck(
    { sourceLocale: "en", locales: ["tr"], localesPath: "locales" },
    { rootDir: root },
  );
  assert.equal(result.stats.byType["invalid-json"], 1);
});

test("namespace directory layout is supported", () => {
  const root = fixture({
    "locales/en/common.json": { ok: "OK" },
    "locales/de/common.json": { ok: "OK-de" },
  });
  const result = runCheck(
    { sourceLocale: "en", locales: ["de"], localesPath: "locales" },
    { rootDir: root },
  );
  assert.equal(result.issues.length, 0);
});
