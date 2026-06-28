import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { analyzeVueI18nBlocks } from "../src/vue-i18n-block";
import type { Issue } from "@localeguard/core";

function project(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lg-i18nblock-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}

function run(root: string): Issue[] {
  return analyzeVueI18nBlocks(
    { sourceLocale: "en", locales: ["fr"], framework: "vue-i18n" },
    { rootDir: root },
  );
}

test("checks key + interpolation parity within an <i18n> block", () => {
  const root = project({
    "src/A.vue": `<template><p>{{ t('hello') }}</p></template>
<i18n>
{
  "en": { "hello": "Hi {name}", "bye": "Bye" },
  "fr": { "hello": "Salut {nom}" }
}
</i18n>`,
  });
  const byType: Record<string, number> = {};
  for (const i of run(root)) byType[i.type] = (byType[i.type] ?? 0) + 1;

  assert.equal(byType["missing-key"], 1); // bye missing in fr
  assert.equal(byType["placeholder-mismatch"], 1); // name -> nom
});

test("clean block produces no issues", () => {
  const root = project({
    "src/A.vue": `<i18n>{ "en": { "ok": "OK" }, "fr": { "ok": "OK-fr" } }</i18n>`,
  });
  assert.equal(run(root).length, 0);
});

test("invalid JSON in a block is reported", () => {
  const root = project({ "src/A.vue": `<i18n>{ bad json }</i18n>` });
  const issues = run(root);
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.type, "invalid-json");
});

test("locale-scoped and non-JSON blocks are skipped", () => {
  const root = project({
    "src/A.vue": `<i18n locale="en">{ "only": "one" }</i18n>
<i18n lang="yaml">en:\n  k: v</i18n>`,
  });
  assert.equal(run(root).length, 0);
});
