import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { flatten } from "../src/flatten";
import { applyFramework } from "../src/framework";
import { runCheck } from "../src/check";
import type { LocaleGuardConfig } from "../src/types";

function fixture(files: Record<string, unknown>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lg-intl-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, typeof content === "string" ? content : JSON.stringify(content));
  }
  return root;
}

test("flatten treats message descriptors as leaves when enabled", () => {
  const map = flatten(
    { "app.title": { defaultMessage: "Hi", description: "d" }, plain: "p" },
    { messageDescriptors: true },
  );
  assert.deepEqual(
    [...map.entries()].sort(),
    [
      ["app.title", "Hi"],
      ["plain", "p"],
    ],
  );
});

test("without the option, descriptors flatten into their fields", () => {
  const map = flatten({ "app.title": { defaultMessage: "Hi" } });
  assert.ok(map.has("app.title.defaultMessage"));
});

test("react-intl preset fills defaults", () => {
  const c = applyFramework({
    framework: "react-intl",
    sourceLocale: "en",
    locales: ["fr"],
    localesPath: "l",
  });
  assert.equal(c.messageFormat, "icu-descriptor");
  assert.ok(c.translationComponents?.includes("FormattedMessage"));
});

test("explicit fields are not overridden by the preset", () => {
  const c = applyFramework({
    framework: "react-intl",
    messageFormat: "plain",
    translationComponents: ["X"],
    sourceLocale: "en",
    locales: ["fr"],
    localesPath: "l",
  });
  assert.equal(c.messageFormat, "plain");
  assert.deepEqual(c.translationComponents, ["X"]);
});

test("no framework is a no-op", () => {
  const input: LocaleGuardConfig = { sourceLocale: "en", locales: ["fr"], localesPath: "l" };
  assert.equal(applyFramework(input), input);
});

test("react-intl: descriptor keys are not flattened, interpolation uses defaultMessage", () => {
  const root = fixture({
    "locales/en.json": {
      "app.title": { defaultMessage: "Cluster Manager", description: "header" },
      greeting: { defaultMessage: "Hi {name}" },
      count: { defaultMessage: "{n, plural, one {# item} other {# items}}" },
    },
    "locales/fr.json": {
      "app.title": { defaultMessage: "Gestionnaire de clusters" },
      greeting: { defaultMessage: "Salut {prenom}" }, // variable renamed
      // "count" missing
    },
  });

  const result = runCheck(
    { framework: "react-intl", sourceLocale: "en", locales: ["fr"], localesPath: "locales" },
    { rootDir: root },
  );

  // Keys are app.title / greeting / count — NOT app.title.defaultMessage etc.
  assert.equal(result.stats.sourceKeyCount, 3);
  assert.equal(result.stats.byType["missing-key"], 1); // count
  assert.equal(result.stats.byType["placeholder-mismatch"], 1); // name -> prenom
});
