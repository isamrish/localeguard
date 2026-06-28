/**
 * `--fix`: add missing keys to JSON target locale files, stubbed with the source
 * value, so translators have an entry to fill in. Scoped to plain JSON locales
 * (not XLIFF/YAML/PO, and not the icu-descriptor message format).
 */

import * as fs from "node:fs";
import * as path from "node:path";

import type { Issue, JsonValue, LocaleEntry } from "@localeguard/core";

export interface FixOptions {
  issues: Issue[];
  sourceEntries: Map<string, LocaleEntry>;
  rootDir: string;
  localesPath: string;
}

export interface FixResult {
  fixed: number;
  files: number;
}

export function applyFix(opts: FixOptions): FixResult {
  const byFile = new Map<string, { flatKey: string; value: JsonValue }[]>();

  for (const issue of opts.issues) {
    if (issue.type !== "missing-key" || !issue.key || !issue.locale) continue;
    const src = opts.sourceEntries.get(issue.key);
    if (!src) continue;

    const colon = issue.key.indexOf(":");
    const rel =
      colon === -1
        ? `${opts.localesPath}/${issue.locale}.json`
        : `${opts.localesPath}/${issue.locale}/${issue.key.slice(0, colon)}.json`;
    const flatKey = colon === -1 ? issue.key : issue.key.slice(colon + 1);

    const list = byFile.get(rel) ?? [];
    list.push({ flatKey, value: src.value });
    byFile.set(rel, list);
  }

  let fixed = 0;
  for (const [rel, additions] of byFile) {
    const abs = path.resolve(opts.rootDir, rel);
    let obj: Record<string, JsonValue> = {};
    if (fs.existsSync(abs)) {
      try {
        obj = JSON.parse(fs.readFileSync(abs, "utf8")) as Record<string, JsonValue>;
      } catch {
        continue; // don't clobber an unparseable file
      }
    } else {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
    }
    for (const { flatKey, value } of additions) {
      setDeep(obj, flatKey, value);
      fixed += 1;
    }
    fs.writeFileSync(abs, JSON.stringify(obj, null, 2) + "\n", "utf8");
  }

  return { fixed, files: byFile.size };
}

function setDeep(obj: Record<string, JsonValue>, dottedKey: string, value: JsonValue): void {
  const parts = dottedKey.split(".");
  let cursor: Record<string, JsonValue> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    const next = cursor[part];
    if (next === undefined || next === null || typeof next !== "object" || Array.isArray(next)) {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, JsonValue>;
  }
  cursor[parts[parts.length - 1]!] = value;
}
