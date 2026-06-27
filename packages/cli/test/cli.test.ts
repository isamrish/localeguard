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
