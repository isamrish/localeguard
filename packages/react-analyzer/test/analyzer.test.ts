import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { analyzeSource, analyzeProject } from "../src/analyzer";
import type { Issue } from "@localeguard/core";

const TRANSLATION_COMPONENTS = new Set(["Trans"]);

function analyze(code: string): Issue[] {
  return analyzeSource(code, "App.tsx", TRANSLATION_COMPONENTS);
}

function typesOf(issues: Issue[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const issue of issues) counts[issue.type] = (counts[issue.type] ?? 0) + 1;
  return counts;
}

test("flags hardcoded JSX text", () => {
  const issues = analyze("const x = <h1>Cluster Manager</h1>;");
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.type, "hardcoded-string");
  assert.match(issues[0]?.message ?? "", /Cluster Manager/);
});

test("ignores translated text and translation components", () => {
  const code = `const x = (
    <div>
      <p>{t("app.subtitle")}</p>
      <Trans i18nKey="welcome">Welcome back</Trans>
      <span>100%</span>
    </div>
  );`;
  assert.equal(analyze(code).length, 0);
});

test("flags hardcoded localizable attributes only", () => {
  const code = `const x = (
    <div>
      <button aria-label="Close dialog">{t("del")}</button>
      <span title="Tooltip text" />
      <img alt="" />
      <input placeholder={t("search")} />
      <a aria-label={label} />
      <div data-id="raw" />
    </div>
  );`;
  const counts = typesOf(analyze(code));
  assert.equal(counts["hardcoded-attribute"], 2); // aria-label + title only
  assert.equal(counts["hardcoded-string"], undefined);
});

test("flags attribute written as a string expression", () => {
  const issues = analyze('const x = <button aria-label={"Submit"} />;');
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.type, "hardcoded-attribute");
});

test("reports 1-based line numbers", () => {
  const code = "const x = (\n  <h1>Title Here</h1>\n);";
  const issues = analyze(code);
  assert.equal(issues[0]?.line, 2);
});

test("plain .ts files yield nothing", () => {
  const issues = analyzeSource('const s = "just a string";', "util.ts", TRANSLATION_COMPONENTS);
  assert.equal(issues.length, 0);
});

test("text inside technical elements is not flagged", () => {
  const code = `const x = (
    <div>
      <code>npm install localeguard</code>
      <pre>const x = 1;</pre>
      <kbd>Ctrl+C</kbd>
      <samp>ERR_CONNECTION_REFUSED</samp>
    </div>
  );`;
  assert.equal(analyze(code).length, 0);
});

test("analyzeProject ignores non-JS/TS files even if include matches them", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lg-ext-"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "src/App.vue"), "<template><h1>Vue Text</h1></template>");
  fs.writeFileSync(path.join(root, "src/Page.tsx"), "export const P = () => <h1>Tsx Text</h1>;");

  const issues = analyzeProject(
    { include: ["src/**/*.{ts,tsx,vue}"] },
    { rootDir: root },
  );
  // Only the .tsx file is parsed; the .vue file is left for the template analyzer.
  assert.equal(issues.length, 1);
  assert.match(issues[0]?.message ?? "", /Tsx Text/);
});

test("decorative and non-text content is not flagged", () => {
  const code = `const x = (
    <div>
      <img alt="" />
      <span>100%</span>
      <span>&mdash;</span>
    </div>
  );`;
  assert.equal(analyze(code).length, 0);
});
