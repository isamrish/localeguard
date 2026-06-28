import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { extractTemplateKeyReferences } from "../src/key-references";

function project(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lg-tkr-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}

test("extracts Vue t()/v-t/keypath keys", () => {
  const root = project({
    "src/A.vue": `<template>
      <p>{{ t('nav.home') }}</p>
      <span v-t="'greeting'"></span>
      <i18n-t keypath="app.title"></i18n-t>
    </template>`,
  });
  const { references } = extractTemplateKeyReferences({ framework: "vue-i18n" }, { rootDir: root });
  assert.deepEqual(
    references.map((r) => r.key).sort(),
    ["app.title", "greeting", "nav.home"],
  );
});

test("extracts Angular translate pipe and [translate] keys", () => {
  const root = project({
    "src/p.html": `<p>{{ 'NAV.HOME' | translate }}</p>
      <div [translate]="'FOO.BAR'"></div>`,
  });
  const { references } = extractTemplateKeyReferences(
    { framework: "ngx-translate" },
    { rootDir: root },
  );
  assert.deepEqual(references.map((r) => r.key).sort(), ["FOO.BAR", "NAV.HOME"]);
});

test("flags dynamic t() usage", () => {
  const root = project({ "src/A.vue": "<template>{{ t(keyVar) }}</template>" });
  const { references, hasDynamicKeys } = extractTemplateKeyReferences(
    { framework: "vue-i18n" },
    { rootDir: root },
  );
  assert.equal(references.length, 0);
  assert.equal(hasDynamicKeys, true);
});

test("no framework + no include returns nothing", () => {
  const root = project({ "src/A.vue": "<template>{{ t('x') }}</template>" });
  const { references } = extractTemplateKeyReferences({}, { rootDir: root });
  assert.equal(references.length, 0);
});
