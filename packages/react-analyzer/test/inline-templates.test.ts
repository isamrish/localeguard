import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { extractInlineTemplates } from "../src/inline-templates";

function project(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lg-inline-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}

test("extracts an inline Component template with its line", () => {
  const code = [
    "import { Component } from '@angular/core';",
    "@Component({",
    "  selector: 'app-root',",
    "  template: `",
    "    <h1>Hello</h1>",
    "  `,",
    "})",
    "export class AppComponent {}",
  ].join("\n");
  const root = project({ "src/app.component.ts": code });

  const templates = extractInlineTemplates({}, { rootDir: root });
  assert.equal(templates.length, 1);
  assert.match(templates[0]?.source ?? "", /<h1>Hello<\/h1>/);
  // Backtick is on line 4, so the content starts on line 4.
  assert.equal(templates[0]?.line, 4);
});

test("ignores templateUrl and non-Component template properties", () => {
  const root = project({
    "src/a.component.ts": "@Component({ templateUrl: './a.html' }) export class A {}",
    "src/b.ts": "const config = { template: '<h1>not angular</h1>' };",
  });
  // Only `Component({ template: ... })` is matched; templateUrl and a plain
  // object's `template` are not.
  assert.equal(extractInlineTemplates({}, { rootDir: root }).length, 0);
});
