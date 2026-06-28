import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { parseXliff } from "../src/locale-parser/xliff";
import { runCheck } from "../src/check";

const XLIFF_12_SOURCE = `<?xml version="1.0"?>
<xliff version="1.2">
  <file source-language="en">
    <body>
      <trans-unit id="app.title"><source>Cluster Manager</source></trans-unit>
      <trans-unit id="app.greeting"><source>Hi <x id="INTERPOLATION" equiv-text="{{ name }}"/></source></trans-unit>
    </body>
  </file>
</xliff>`;

test("parses XLIFF 1.2 trans-units and normalizes placeholders", () => {
  const parsed = parseXliff(XLIFF_12_SOURCE);
  assert.equal(parsed.version, "1.2");
  assert.equal(parsed.units.length, 2);
  assert.equal(parsed.units[0]?.id, "app.title");
  assert.equal(parsed.units[0]?.source, "Cluster Manager");
  assert.equal(parsed.units[1]?.source, "Hi {INTERPOLATION}");
});

test("parses XLIFF 2.0 units with segment/source/target", () => {
  const xliff = `<xliff version="2.0" srcLang="en" trgLang="fr">
    <file id="f"><unit id="greeting"><segment>
      <source>Hi <ph id="0" equiv="INTERP"/></source>
      <target>Salut <ph id="0" equiv="INTERP"/></target>
    </segment></unit></file>
  </xliff>`;
  const parsed = parseXliff(xliff);
  assert.equal(parsed.version, "2.0");
  assert.equal(parsed.units[0]?.id, "greeting");
  assert.equal(parsed.units[0]?.source, "Hi {0}");
  assert.equal(parsed.units[0]?.target, "Salut {0}");
});

test("detects duplicate unit ids", () => {
  const xliff = `<xliff version="1.2"><file><body>
    <trans-unit id="dup"><source>A</source></trans-unit>
    <trans-unit id="dup"><source>B</source></trans-unit>
  </body></file></xliff>`;
  assert.equal(parseXliff(xliff).duplicates.length, 1);
});

test("decodes entities in source text", () => {
  const xliff = `<xliff version="1.2"><file><body>
    <trans-unit id="x"><source>Tom &amp; Jerry &lt;3</source></trans-unit>
  </body></file></xliff>`;
  assert.equal(parseXliff(xliff).units[0]?.source, "Tom & Jerry <3");
});

test("end-to-end: XLIFF parity, untranslated -> missing, placeholder mismatch", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lg-xliff-"));
  const dir = path.join(root, "loc");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "messages.xlf"), XLIFF_12_SOURCE);
  fs.writeFileSync(
    path.join(dir, "messages.fr.xlf"),
    `<?xml version="1.0"?>
<xliff version="1.2"><file source-language="en" target-language="fr"><body>
  <trans-unit id="app.greeting"><source>Hi <x id="INTERPOLATION"/></source><target>Salut <x id="AUTRE"/></target></trans-unit>
</body></file></xliff>`,
  );

  const result = runCheck(
    { framework: "angular", sourceLocale: "en", locales: ["fr"], localesPath: "loc" },
    { rootDir: root },
  );

  assert.equal(result.stats.sourceKeyCount, 2); // app.title, app.greeting
  assert.equal(result.stats.byType["missing-key"], 1); // app.title not translated in fr
  assert.equal(result.stats.byType["placeholder-mismatch"], 1); // INTERPOLATION vs AUTRE
});
