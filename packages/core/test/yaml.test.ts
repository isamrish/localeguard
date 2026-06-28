import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { parseYaml } from "../src/yaml/parse";
import { flatten } from "../src/flatten";
import { runCheck } from "../src/check";

test("parses nested mappings, scalars, comments, and line numbers", () => {
  const yaml = [
    "# comment",
    "app:",
    '  title: "Cluster Manager"',
    "  greeting: Hello {name}   # inline comment",
    "nav:",
    "  home: Home",
  ].join("\n");
  const { value, keyLines } = parseYaml(yaml);
  assert.deepEqual(value, {
    app: { title: "Cluster Manager", greeting: "Hello {name}" },
    nav: { home: "Home" },
  });
  assert.equal(keyLines.get("app.title"), 3);
  assert.equal(keyLines.get("nav.home"), 6);
});

test("flattening a parsed YAML tree yields dotted keys", () => {
  const { value } = parseYaml("a:\n  b: x\nc: y");
  assert.deepEqual([...flatten(value).keys()].sort(), ["a.b", "c"]);
});

test("detects duplicate keys", () => {
  const { duplicates } = parseYaml("a: 1\na: 2");
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0]?.path, "a");
});

test("parses simple scalar lists", () => {
  const { value } = parseYaml("plurals:\n  - one\n  - other");
  assert.deepEqual(value, { plurals: ["one", "other"] });
});

test("end-to-end: YAML locale parity and interpolation", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lg-yaml-"));
  fs.mkdirSync(path.join(root, "loc"));
  fs.writeFileSync(path.join(root, "loc/en.yaml"), "a: A\ngreeting: Hi {name}\nb: B");
  fs.writeFileSync(path.join(root, "loc/fr.yaml"), "a: A-fr\ngreeting: Salut {nom}");
  const result = runCheck(
    { sourceLocale: "en", locales: ["fr"], localesPath: "loc", localeFormat: "yaml" },
    { rootDir: root },
  );
  assert.equal(result.stats.byType["missing-key"], 1); // b
  assert.equal(result.stats.byType["placeholder-mismatch"], 1); // name -> nom
});
