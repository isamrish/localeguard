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
import type { Issue, LoadedLocale, LocaleEntry, LocaleFormat, MessageFormat } from "../types";
import { parseXliff } from "./xliff";

export interface LoadOptions {
  /** Absolute project root; reported file paths are relative to this. */
  rootDir: string;
  /** Locales directory, relative to `rootDir`. */
  localesPath: string;
  /** How locale-file values are interpreted (defaults to "plain"). */
  messageFormat?: MessageFormat;
  /** On-disk locale format (defaults to "json"). */
  localeFormat?: LocaleFormat;
  /** The source locale, so XLIFF loading knows whether to read source or target. */
  sourceLocale?: string;
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
  if (opts.localeFormat === "xliff") {
    return loadXliffLocale(locale, opts);
  }
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

    const flat = flatten(parsed.value, {
      messageDescriptors: opts.messageFormat === "icu-descriptor",
    });
    for (const [flatKey, value] of flat) {
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

/**
 * Load an Angular XLIFF locale. The source locale reads `<source>`; target
 * locales read `<target>` (units with an empty/missing target are treated as
 * untranslated, surfacing as missing keys).
 */
function loadXliffLocale(locale: string, opts: LoadOptions): LoadedLocale {
  const isSource = opts.sourceLocale === locale;
  const base = path.resolve(opts.rootDir, opts.localesPath);
  const names = isSource
    ? [
        "messages.xlf",
        "messages.xliff",
        `messages.${locale}.xlf`,
        `messages.${locale}.xliff`,
        `${locale}.xlf`,
        `${locale}.xliff`,
      ]
    : [`messages.${locale}.xlf`, `messages.${locale}.xliff`, `${locale}.xlf`, `${locale}.xliff`];

  let absPath: string | undefined;
  for (const name of names) {
    const candidate = path.join(base, name);
    if (isFile(candidate)) {
      absPath = candidate;
      break;
    }
  }
  if (!absPath) return { locale, entries: new Map(), issues: [], found: false };

  const relPath = path.relative(opts.rootDir, absPath) || absPath;
  const entries = new Map<string, LocaleEntry>();
  const issues: Issue[] = [];

  let text: string;
  try {
    text = fs.readFileSync(absPath, "utf8");
  } catch (err) {
    issues.push({
      type: "invalid-json",
      severity: SEVERITY_BY_TYPE["invalid-json"],
      locale,
      file: relPath,
      message: `Could not read XLIFF file: ${(err as Error).message}`,
    });
    return { locale, entries, issues, found: true };
  }

  const parsed = parseXliff(text);
  if (parsed.version === "unknown" && parsed.units.length === 0) {
    issues.push({
      type: "invalid-json",
      severity: SEVERITY_BY_TYPE["invalid-json"],
      locale,
      file: relPath,
      line: 1,
      message: "Not a recognized XLIFF file (no <xliff> root or units found).",
      suggestion: "Ensure this is a valid XLIFF 1.2 or 2.0 file.",
    });
    return { locale, entries, issues, found: true };
  }

  for (const dup of parsed.duplicates) {
    issues.push({
      type: "duplicate-key",
      severity: SEVERITY_BY_TYPE["duplicate-key"],
      locale,
      key: dup.id,
      file: relPath,
      line: dup.line,
      message: `Duplicate unit id "${dup.id}"`,
      suggestion: "Remove the duplicate trans-unit/unit.",
    });
  }

  for (const unit of parsed.units) {
    if (isSource) {
      entries.set(unit.id, { value: unit.source, file: relPath, line: unit.line });
    } else if (unit.target && unit.target.trim().length > 0) {
      entries.set(unit.id, { value: unit.target, file: relPath, line: unit.line });
    }
  }

  return { locale, entries, issues, found: true };
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
