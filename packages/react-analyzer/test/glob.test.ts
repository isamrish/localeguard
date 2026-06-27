import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { findFiles, globToRegExp } from "../src/glob";

test("globToRegExp handles **, *, and brace alternatives", () => {
  const re = globToRegExp("src/**/*.{ts,tsx}");
  assert.ok(re.test("src/index.ts"));
  assert.ok(re.test("src/a/b/c.tsx"));
  assert.ok(!re.test("src/index.js"));
  assert.ok(!re.test("lib/index.ts"));
});

test("globToRegExp matches ignore patterns", () => {
  const re = globToRegExp("**/*.test.tsx");
  assert.ok(re.test("src/components/Button.test.tsx"));
  assert.ok(!re.test("src/components/Button.tsx"));
});

test("findFiles respects include and ignore", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lg-glob-"));
  fs.mkdirSync(path.join(root, "src/components"), { recursive: true });
  fs.mkdirSync(path.join(root, "node_modules/pkg"), { recursive: true });
  fs.writeFileSync(path.join(root, "src/App.tsx"), "");
  fs.writeFileSync(path.join(root, "src/components/Button.tsx"), "");
  fs.writeFileSync(path.join(root, "src/components/Button.test.tsx"), "");
  fs.writeFileSync(path.join(root, "src/util.ts"), "");
  fs.writeFileSync(path.join(root, "node_modules/pkg/index.tsx"), "");

  const found = findFiles({
    rootDir: root,
    include: ["src/**/*.{ts,tsx}"],
    ignore: ["**/*.test.tsx"],
  }).map((f) => path.relative(root, f).split(path.sep).join("/"));

  assert.deepEqual(found.sort(), [
    "src/App.tsx",
    "src/components/Button.tsx",
    "src/util.ts",
  ]);
});
