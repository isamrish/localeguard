import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { scanVueSfc } from "../src/vue";
import { scanAngularTemplate } from "../src/angular";
import { analyzeTemplates } from "../src/index";
import type { Issue } from "@localeguard/core";

const VUE_TC = ["i18n-t", "I18nT"];

function strings(issues: Issue[]): string[] {
  return issues
    .filter((i) => i.type === "hardcoded-string")
    .map((i) => {
      const captured = /: (.*)$/.exec(i.message)?.[1];
      if (!captured) return i.message;
      try {
        return JSON.parse(captured) as string;
      } catch {
        return captured;
      }
    });
}
function attrs(issues: Issue[]): Issue[] {
  return issues.filter((i) => i.type === "hardcoded-attribute");
}

test("vue: flags static text/attrs, ignores interpolation/bindings/skip-contexts", () => {
  const sfc = `<template>
  <div>
    <h1>Cluster Manager</h1>
    <p>{{ greeting }}</p>
    <p>Hello {{ name }}</p>
    <img :alt="altText" />
    <img alt="Company logo" />
    <span v-t="'key'">should be ignored</span>
    <i18n-t keypath="msg">inside trans</i18n-t>
    <code>npm install localeguard</code>
    <span>100%</span>
  </div>
</template>
<script>export default {};</script>`;

  const issues = scanVueSfc(sfc, "App.vue", VUE_TC);
  assert.deepEqual(strings(issues).sort(), ["Cluster Manager", "Hello"]);
  assert.equal(attrs(issues).length, 1);
  assert.match(attrs(issues)[0]?.message ?? "", /Company logo/);
});

test("vue: line numbers map back to the .vue file", () => {
  const sfc = "<template>\n  <div>\n    <h1>Title Here</h1>\n  </div>\n</template>";
  const issues = scanVueSfc(sfc, "App.vue", VUE_TC);
  assert.equal(issues[0]?.line, 3);
});

test("angular: ignores i18n-marked text, translate, bindings, and interpolation", () => {
  const html = `<div>
  <h1>Cluster Manager</h1>
  <p>{{ greeting }}</p>
  <p i18n>Marked for translation</p>
  <img [alt]="altText" />
  <img alt="Company logo" />
  <span title="Tooltip" i18n-title></span>
  <button translate>BTN.LABEL</button>
  <p>{{ 'KEY' | translate }}</p>
</div>`;

  const issues = scanAngularTemplate(html, "app.component.html");
  assert.deepEqual(strings(issues), ["Cluster Manager"]);
  assert.equal(attrs(issues).length, 1);
  assert.match(attrs(issues)[0]?.message ?? "", /Company logo/);
});

test("analyzeTemplates routes .vue (always) and .html (Angular only)", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lg-tmpl-"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "src/A.vue"), "<template><h1>Vue Text</h1></template>");
  fs.writeFileSync(path.join(root, "src/page.html"), "<h1>Angular Text</h1>");

  // Vue framework: scans .vue, not .html.
  const vue = analyzeTemplates({ framework: "vue-i18n", translationComponents: VUE_TC }, { rootDir: root });
  assert.deepEqual(strings(vue), ["Vue Text"]);

  // Angular framework: scans .html.
  const ng = analyzeTemplates(
    { framework: "ngx-translate", include: ["src/**/*.{vue,html}"] },
    { rootDir: root },
  );
  assert.ok(strings(ng).includes("Angular Text"));

  // No framework + html only: nothing (avoids scanning arbitrary HTML).
  const none = analyzeTemplates({ include: ["src/**/*.html"] }, { rootDir: root });
  assert.equal(none.length, 0);
});
