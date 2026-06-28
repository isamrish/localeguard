import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { main } from "../src/index";

function tempProject(files: Record<string, unknown>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "localeguard-cli-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, typeof content === "string" ? content : JSON.stringify(content));
  }
  return root;
}

/** Run `main` while capturing stdout. */
function captureStdout(fn: () => number): { code: number; out: string } {
  const original = process.stdout.write.bind(process.stdout);
  let out = "";
  (process.stdout as { write: unknown }).write = (chunk: string | Uint8Array): boolean => {
    out += chunk.toString();
    return true;
  };
  try {
    const code = fn();
    return { code, out };
  } finally {
    (process.stdout as { write: unknown }).write = original;
  }
}

test("--version prints the version", () => {
  const { code, out } = captureStdout(() => main(["--version"]));
  assert.equal(code, 0);
  assert.match(out, /^\d+\.\d+\.\d+/);
});

test("check exits 0 on clean locales", () => {
  const root = tempProject({
    "localeguard.config.json": { sourceLocale: "en", locales: ["fr"], localesPath: "locales" },
    "locales/en.json": { a: "A" },
    "locales/fr.json": { a: "A-fr" },
  });
  const { code } = captureStdout(() => main(["check", "--cwd", root, "--no-color"]));
  assert.equal(code, 0);
});

test("check exits 1 on missing keys and emits json", () => {
  const root = tempProject({
    "localeguard.config.json": { sourceLocale: "en", locales: ["fr"], localesPath: "locales" },
    "locales/en.json": { a: "A", b: "B" },
    "locales/fr.json": { a: "A-fr" },
  });
  const { code, out } = captureStdout(() =>
    main(["check", "--cwd", root, "--reporter", "json"]),
  );
  assert.equal(code, 1);
  const report = JSON.parse(out);
  assert.equal(report.tool, "localeguard");
  assert.equal(report.stats.byType["missing-key"], 1);
});

test("init writes a config file", () => {
  const root = tempProject({});
  const { code } = captureStdout(() => main(["init", "--cwd", root]));
  assert.equal(code, 0);
  assert.ok(fs.existsSync(path.join(root, "localeguard.config.json")));
});

test("missing config reports a helpful error", () => {
  const root = tempProject({});
  const code = main(["check", "--cwd", root]);
  assert.equal(code, 1);
});

test("check runs code analysis and reports hardcoded text", () => {
  const root = tempProject({
    "localeguard.config.json": { sourceLocale: "en", locales: ["fr"], localesPath: "locales" },
    "locales/en.json": { a: "A" },
    "locales/fr.json": { a: "A-fr" },
    "src/App.tsx": "export const App = () => <h1>Hardcoded Title</h1>;",
  });
  const { code, out } = captureStdout(() => main(["check", "--cwd", root, "--reporter", "json"]));
  // Hardcoded text is a warning by default, so the run still passes.
  assert.equal(code, 0);
  const report = JSON.parse(out);
  assert.equal(report.stats.byType["hardcoded-string"], 1);
});

test("--no-code skips source analysis", () => {
  const root = tempProject({
    "localeguard.config.json": { sourceLocale: "en", locales: ["fr"], localesPath: "locales" },
    "locales/en.json": { a: "A" },
    "locales/fr.json": { a: "A-fr" },
    "src/App.tsx": "export const App = () => <h1>Hardcoded Title</h1>;",
  });
  const { code, out } = captureStdout(() =>
    main(["check", "--cwd", root, "--no-code", "--reporter", "json"]),
  );
  assert.equal(code, 0);
  assert.equal(JSON.parse(out).stats.byType["hardcoded-string"], 0);
});

test("--reporter markdown prints a summary", () => {
  const root = tempProject({
    "localeguard.config.json": { sourceLocale: "en", locales: ["fr"], localesPath: "locales" },
    "locales/en.json": { a: "A", b: "B" },
    "locales/fr.json": { a: "A-fr" },
  });
  const { code, out } = captureStdout(() =>
    main(["check", "--cwd", root, "--reporter", "markdown"]),
  );
  assert.equal(code, 1);
  assert.match(out, /## 🌐 LocaleGuard/);
  assert.match(out, /Localization check failed/);
});

test("--reporter sarif --output writes a valid SARIF file", () => {
  const root = tempProject({
    "localeguard.config.json": { sourceLocale: "en", locales: ["fr"], localesPath: "locales" },
    "locales/en.json": { a: "A", b: "B" },
    "locales/fr.json": { a: "A-fr" },
  });
  const code = main(["check", "--cwd", root, "--reporter", "sarif", "--output", "out.sarif"]);
  assert.equal(code, 1);
  const sarif = JSON.parse(fs.readFileSync(path.join(root, "out.sarif"), "utf8"));
  assert.equal(sarif.version, "2.1.0");
  assert.equal(sarif.runs[0].tool.driver.name, "LocaleGuard");
  assert.ok(sarif.runs[0].results.length >= 1);
});

test("--update-baseline writes a file, then the check passes; new issues still fail", () => {
  const root = tempProject({
    "localeguard.config.json": { sourceLocale: "en", locales: ["fr"], localesPath: "locales" },
    "locales/en.json": { a: "A", b: "B" },
    "locales/fr.json": { a: "A-fr" }, // b missing
  });

  // Record the pre-existing issue.
  const write = main(["check", "--cwd", root, "--update-baseline"]);
  assert.equal(write, 0);
  assert.ok(fs.existsSync(path.join(root, "localeguard-baseline.json")));

  // Now it passes (the missing 'b' is baselined).
  assert.equal(main(["check", "--cwd", root, "--no-color"]), 0);

  // Introduce a new issue: drop 'a' too.
  fs.writeFileSync(path.join(root, "locales/fr.json"), JSON.stringify({}));
  assert.equal(main(["check", "--cwd", root, "--no-color"]), 1);
});

test("--fix adds missing keys to JSON target locales", () => {
  const root = tempProject({
    "localeguard.config.json": { sourceLocale: "en", locales: ["fr"], localesPath: "locales" },
    "locales/en.json": { a: "A", b: "B" },
    "locales/fr.json": { a: "A-fr" }, // b missing
  });
  assert.equal(main(["check", "--cwd", root, "--fix"]), 0);
  const fr = JSON.parse(fs.readFileSync(path.join(root, "locales/fr.json"), "utf8"));
  assert.equal(fr.b, "B"); // stubbed with the source value
  // After fixing, the check passes.
  assert.equal(main(["check", "--cwd", root, "--no-color"]), 0);
});

test("--fix is rejected for non-JSON locale formats", () => {
  const root = tempProject({
    "localeguard.config.json": {
      framework: "angular",
      sourceLocale: "en",
      locales: ["fr"],
      localesPath: "loc",
    },
    "loc/messages.xlf": '<xliff version="1.2"><file><body><trans-unit id="a"><source>A</source></trans-unit></body></file></xliff>',
    "loc/messages.fr.xlf": '<xliff version="1.2"><file><body></body></file></xliff>',
  });
  assert.equal(main(["check", "--cwd", root, "--fix"]), 1);
});

test("unknown reporter is rejected", () => {
  const root = tempProject({
    "localeguard.config.json": { sourceLocale: "en", locales: ["fr"], localesPath: "locales" },
    "locales/en.json": { a: "A" },
    "locales/fr.json": { a: "A-fr" },
  });
  const code = main(["check", "--cwd", root, "--reporter", "xml"]);
  assert.equal(code, 1);
});

test("undefined-key flags a key used in code but missing from the locale", () => {
  const root = tempProject({
    "localeguard.config.json": { sourceLocale: "en", locales: ["fr"], localesPath: "locales" },
    "locales/en.json": { greeting: "Hi", app: { title: "T" } },
    "locales/fr.json": { greeting: "Salut", app: { title: "T-fr" } },
    "src/App.tsx": "export const A = () => { const t = (k: string) => k; return t('app.title') + t('app.missing'); };",
  });
  const { code, out } = captureStdout(() => main(["check", "--cwd", root, "--reporter", "json"]));
  const report = JSON.parse(out);
  assert.equal(report.stats.byType["undefined-key"], 1); // app.missing only
  assert.equal(code, 1); // undefined-key is blocking by default
});

test("unusedKeys config reports keys never referenced in code", () => {
  const root = tempProject({
    "localeguard.config.json": {
      sourceLocale: "en",
      locales: ["fr"],
      localesPath: "locales",
      unusedKeys: true,
    },
    "locales/en.json": { used: "U", dead: "D" },
    "locales/fr.json": { used: "U", dead: "D" },
    "src/App.tsx": "export const A = () => { const t = (k: string) => k; return t('used'); };",
  });
  const { out } = captureStdout(() => main(["check", "--cwd", root, "--reporter", "json"]));
  const report = JSON.parse(out);
  assert.equal(report.stats.byType["unused-key"], 1); // dead
});

test("blockOn can make hardcoded text fail the build", () => {
  const root = tempProject({
    "localeguard.config.json": {
      sourceLocale: "en",
      locales: ["fr"],
      localesPath: "locales",
      blockOn: ["hardcoded-string"],
    },
    "locales/en.json": { a: "A" },
    "locales/fr.json": { a: "A-fr" },
    "src/App.tsx": "export const App = () => <h1>Hardcoded Title</h1>;",
  });
  const { code } = captureStdout(() => main(["check", "--cwd", root, "--no-color"]));
  assert.equal(code, 1);
});
