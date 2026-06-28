import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { main } from "../src/index";
import { filterIssuesToChanged } from "../src/git-changed";
import type { Issue } from "@localeguard/core";

test("filterIssuesToChanged keeps own-file and locale-file matches", () => {
  const issues: Issue[] = [
    { type: "hardcoded-string", severity: "warning", file: "src/Old.tsx", line: 1, message: "old" },
    { type: "hardcoded-string", severity: "warning", file: "src/New.tsx", line: 1, message: "new" },
    // missing-key is reported against the SOURCE file but belongs to locale fr:
    { type: "missing-key", severity: "error", locale: "fr", file: "locales/en.json", line: 2, key: "b", message: "missing fr" },
    { type: "missing-key", severity: "error", locale: "de", file: "locales/en.json", line: 3, key: "c", message: "missing de" },
  ];
  const changed = new Set(["src/New.tsx", "locales/fr.json"]);
  const kept = filterIssuesToChanged(issues, changed, "locales");

  assert.equal(kept.length, 2);
  assert.ok(kept.some((i) => i.file === "src/New.tsx"));
  assert.ok(kept.some((i) => i.type === "missing-key" && i.locale === "fr"));
  // Excluded: unchanged Old.tsx, and de (no de locale file changed).
  assert.ok(!kept.some((i) => i.file === "src/Old.tsx"));
  assert.ok(!kept.some((i) => i.locale === "de"));
});

test("filterIssuesToChanged matches namespaced locale directories", () => {
  const issues: Issue[] = [
    { type: "extra-key", severity: "warning", locale: "fr", file: "locales/fr/common.json", line: 1, key: "x", message: "extra" },
  ];
  const kept = filterIssuesToChanged(issues, new Set(["locales/fr/common.json"]), "locales");
  assert.equal(kept.length, 1);
});

function git(cwd: string, ...args: string[]): void {
  execFileSync("git", ["-C", cwd, ...args], { stdio: "pipe" });
}

test("--changed limits issues to files touched since the base ref", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lg-changed-"));
  const write = (rel: string, content: unknown) => {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, typeof content === "string" ? content : JSON.stringify(content));
  };

  // Base state.
  write("localeguard.config.json", { sourceLocale: "en", locales: ["fr"], localesPath: "locales" });
  write("locales/en.json", { a: "A", b: "B" });
  write("locales/fr.json", { a: "A-fr", b: "B-fr" });
  write("src/Old.tsx", "export const Old = () => <h1>Old Title</h1>;");

  git(root, "init", "-q");
  git(root, "config", "user.email", "t@example.com");
  git(root, "config", "user.name", "Test");
  git(root, "config", "commit.gpgsign", "false");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "base");

  // Change: drop key b from fr (missing-key for fr), and add a new component.
  write("locales/fr.json", { a: "A-fr" });
  write("src/New.tsx", "export const New = () => <h1>New Title</h1>;");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "change");

  const code = main([
    "check", "--cwd", root, "--changed", "--base", "HEAD~1",
    "--reporter", "json", "--output", "report.json",
  ]);
  const report = JSON.parse(fs.readFileSync(path.join(root, "report.json"), "utf8"));

  assert.equal(code, 1); // missing-key is blocking
  assert.equal(report.stats.byType["missing-key"], 1); // fr lost key b
  assert.equal(report.stats.byType["hardcoded-string"], 1); // only New.tsx, not Old.tsx
});

test("--changed errors cleanly outside a git repo", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lg-nogit-"));
  fs.writeFileSync(
    path.join(root, "localeguard.config.json"),
    JSON.stringify({ sourceLocale: "en", locales: ["fr"], localesPath: "locales" }),
  );
  fs.mkdirSync(path.join(root, "locales"));
  fs.writeFileSync(path.join(root, "locales/en.json"), JSON.stringify({ a: "A" }));
  fs.writeFileSync(path.join(root, "locales/fr.json"), JSON.stringify({ a: "A" }));

  const code = main(["check", "--cwd", root, "--changed"]);
  assert.equal(code, 1);
});
