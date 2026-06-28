import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { parsePo, poKey } from "../src/po/parse";
import { runCheck } from "../src/check";

test("parses context, multi-line strings, and skips the header", () => {
  const po = [
    'msgid ""',
    'msgstr "Project-Id-Version: x"',
    "",
    'msgctxt "menu"',
    'msgid "File"',
    'msgstr "Fichier"',
    "",
    'msgid ""',
    '"Hello, "',
    '"world"',
    'msgstr "Bonjour, monde"',
  ].join("\n");

  const { entries } = parsePo(po);
  assert.equal(entries.length, 2);
  assert.equal(entries[0]?.context, "menu");
  assert.equal(entries[0]?.msgid, "File");
  assert.equal(poKey(entries[0]!), "menu|File");
  assert.equal(entries[1]?.msgid, "Hello, world");
});

test("detects duplicate msgids", () => {
  const po = 'msgid "a"\nmsgstr "A"\n\nmsgid "a"\nmsgstr "B"';
  assert.equal(parsePo(po).duplicates.length, 1);
});

test("end-to-end: PO untranslated -> missing, placeholder mismatch", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lg-po-"));
  fs.mkdirSync(path.join(root, "loc"));
  fs.writeFileSync(
    path.join(root, "loc/messages.pot"),
    'msgid ""\nmsgstr ""\n\nmsgid "Hi {name}"\nmsgstr ""\n\nmsgid "Bye"\nmsgstr ""',
  );
  fs.writeFileSync(
    path.join(root, "loc/fr.po"),
    'msgid ""\nmsgstr ""\n\nmsgid "Hi {name}"\nmsgstr "Salut {nom}"\n\nmsgid "Bye"\nmsgstr ""',
  );

  const result = runCheck(
    { sourceLocale: "en", locales: ["fr"], localesPath: "loc", localeFormat: "po" },
    { rootDir: root },
  );
  assert.equal(result.stats.byType["missing-key"], 1); // "Bye" untranslated
  assert.equal(result.stats.byType["placeholder-mismatch"], 1); // {name} -> {nom}
});
