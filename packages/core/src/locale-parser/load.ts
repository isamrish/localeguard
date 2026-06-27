/**
 * Load a locale from disk into a flat key map.
 *
 * Two on-disk layouts are supported:
 *   - single file:   `<localesPath>/<locale>.json`
 *   - per-namespace: `<localesPath>/<locale>/<namespace>.json`
 *
 * When namespaces are used, keys are qualified as `namespace:key` so they stay
 * distinct across files.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { flatten } from "../flatten";
import { JsonParseError, parseJson } from "../json/parse";
import { SEVERITY_BY_TYPE } from "../types";
import type { Issue, LoadedLocale, LocaleEntry } from "../types";

export interface LoadOptions {
  /** Absolute project root; reported file paths are relative to this. */
  rootDir: string;
  /** Locales directory, relative to `rootDir`. */
  localesPath: string;
}

interface LocaleFile {
  absPath: string;
  namespace: string | null;
}

function listLocaleFiles(locale: string, opts: LoadOptions): LocaleFile[] {
  const base = path.resolve(opts.rootDir, opts.localesPath);
  const files: LocaleFile[] = [];

  const singleFile = path.join(base, `${locale}.json`);
  if (isFile(singleFile)) {
    files.push({ absPath: singleFile, namespace: null });
  }

  const dir = path.join(base, locale);
  if (isDirectory(dir)) {
    for (const entry of fs.readdirSync(dir).sort()) {
      if (entry.endsWith(".json")) {
        files.push({
          absPath: path.join(dir, entry),
          namespace: entry.slice(0, -".json".length),
        });
      }
    }
  }

  return files;
}

export function loadLocale(locale: string, opts: LoadOptions): LoadedLocale {
  const files = listLocaleFiles(locale, opts);
  const entries = new Map<string, LocaleEntry>();
  const issues: Issue[] = [];

  for (const { absPath, namespace } of files) {
    const relPath = path.relative(opts.rootDir, absPath) || absPath;
    let text: string;
    try {
      text = fs.readFileSync(absPath, "utf8");
    } catch (err) {
      issues.push({
        type: "invalid-json",
        severity: SEVERITY_BY_TYPE["invalid-json"],
        locale,
        namespace: namespace ?? undefined,
        file: relPath,
        message: `Could not read locale file: ${(err as Error).message}`,
      });
      continue;
    }

    let parsed;
    try {
      parsed = parseJson(text);
    } catch (err) {
      const pe = err as JsonParseError;
      issues.push({
        type: "invalid-json",
        severity: SEVERITY_BY_TYPE["invalid-json"],
        locale,
        namespace: namespace ?? undefined,
        file: relPath,
        line: pe.line,
        message: `Invalid JSON: ${pe.message}`,
        suggestion: "Fix the JSON syntax so the locale can be parsed.",
      });
      continue;
    }

    for (const dup of parsed.duplicates) {
      issues.push({
        type: "duplicate-key",
        severity: SEVERITY_BY_TYPE["duplicate-key"],
        locale,
        namespace: namespace ?? undefined,
        key: qualify(namespace, dup.path),
        file: relPath,
        line: dup.line,
        message: `Duplicate key "${dup.path}"`,
        suggestion: "Remove the duplicate; only the last value is kept.",
      });
    }

    for (const [flatKey, value] of flatten(parsed.value)) {
      const fqKey = qualify(namespace, flatKey);
      entries.set(fqKey, {
        value,
        file: relPath,
        line: parsed.keyLines.get(flatKey) ?? 1,
      });
    }
  }

  return { locale, entries, issues, found: files.length > 0 };
}

function qualify(namespace: string | null, key: string): string {
  return namespace ? `${namespace}:${key}` : key;
}

function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
