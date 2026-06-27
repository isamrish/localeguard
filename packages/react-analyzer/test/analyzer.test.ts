import { test } from "node:test";
import assert from "node:assert/strict";

import { analyzeSource } from "../src/analyzer";
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
