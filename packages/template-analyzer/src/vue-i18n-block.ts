/**
 * Vue I18n single-file-component `<i18n>` custom blocks. These hold per-component
 * messages, typically as a JSON object keyed by locale:
 *
 *   <i18n>
 *   { "en": { "hello": "Hello {name}" }, "fr": { "hello": "Bonjour {name}" } }
 *   </i18n>
 *
 * We check parity between the locales declared *within each block* (missing /
 * extra keys and interpolation), scoped to the `.vue` file.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import {
  compareKeys,
  comparePlaceholders,
  findFiles,
  flatten,
  JsonParseError,
  parseJson,
  SEVERITY_BY_TYPE,
} from "@localeguard/core";
import type { Framework, Issue, JsonValue } from "@localeguard/core";

export interface VueI18nBlockConfig {
  sourceLocale: string;
  locales: string[];
  framework?: Framework;
  include?: string[];
  ignore?: string[];
}

export interface AnalyzeOptions {
  rootDir: string;
}

const BLOCK_RE = /<i18n\b([^>]*)>([\s\S]*?)<\/i18n>/gi;
const LANG_RE = /\blang\s*=\s*["']([^"']+)["']/i;
const LOCALE_ATTR_RE = /\blocale\s*=\s*["']([^"']+)["']/i;

export function analyzeVueI18nBlocks(config: VueI18nBlockConfig, opts: AnalyzeOptions): Issue[] {
  const include = config.include ?? ["src/**/*.vue"];
  const files = findFiles({ rootDir: opts.rootDir, include, ignore: config.ignore });
  const issues: Issue[] = [];

  for (const absFile of files) {
    if (path.extname(absFile).toLowerCase() !== ".vue") continue;
    let text: string;
    try {
      text = fs.readFileSync(absFile, "utf8");
    } catch {
      continue;
    }
    const relPath = path.relative(opts.rootDir, absFile) || absFile;
    analyzeBlocks(text, relPath, config, issues);
  }
  return issues;
}

function analyzeBlocks(
  text: string,
  file: string,
  config: VueI18nBlockConfig,
  issues: Issue[],
): void {
  for (const match of text.matchAll(BLOCK_RE)) {
    const attrs = match[1] ?? "";
    const body = match[2] ?? "";
    // Only JSON blocks; `locale="x"` single-locale blocks can't be compared alone.
    const lang = LANG_RE.exec(attrs)?.[1]?.toLowerCase();
    if ((lang && lang !== "json") || LOCALE_ATTR_RE.test(attrs)) continue;

    const blockLine = lineAt(text, match.index ?? 0);

    let value: JsonValue;
    try {
      value = parseJson(body).value;
    } catch (err) {
      const pe = err as JsonParseError;
      issues.push({
        type: "invalid-json",
        severity: SEVERITY_BY_TYPE["invalid-json"],
        file,
        line: blockLine + (pe.line - 1),
        message: `Invalid JSON in <i18n> block: ${pe.message}`,
        suggestion: "Fix the JSON inside the <i18n> block.",
      });
      continue;
    }
    if (value === null || typeof value !== "object" || Array.isArray(value)) continue;

    const messages = value as Record<string, JsonValue>;
    const sourceMessages = messages[config.sourceLocale];
    if (sourceMessages === undefined) continue;
    const sourceFlat = flatten(sourceMessages);

    for (const locale of config.locales) {
      if (locale === config.sourceLocale) continue;
      const targetMessages = messages[locale];
      if (targetMessages === undefined) continue; // locale not declared in this block
      const targetFlat = flatten(targetMessages);
      const diff = compareKeys(sourceFlat.keys(), targetFlat.keys());

      for (const key of diff.missing) {
        issues.push(blockIssue("missing-key", locale, key, file, blockLine, `Key "${key}" is missing in "${locale}" (<i18n> block).`));
      }
      for (const key of diff.extra) {
        issues.push(blockIssue("extra-key", locale, key, file, blockLine, `Key "${key}" in "${locale}" is not in source "${config.sourceLocale}" (<i18n> block).`));
      }
      for (const key of diff.shared) {
        const pdiff = comparePlaceholders(sourceFlat.get(key)!, targetFlat.get(key)!);
        if (pdiff) {
          const parts: string[] = [];
          if (pdiff.missing.length) parts.push(`missing ${pdiff.missing.map((v) => `{${v}}`).join(", ")}`);
          if (pdiff.extra.length) parts.push(`unexpected ${pdiff.extra.map((v) => `{${v}}`).join(", ")}`);
          issues.push(blockIssue("placeholder-mismatch", locale, key, file, blockLine, `Interpolation mismatch in "${key}" (${locale}, <i18n> block): ${parts.join("; ")}.`));
        }
      }
    }
  }
}

function blockIssue(
  type: "missing-key" | "extra-key" | "placeholder-mismatch",
  locale: string,
  key: string,
  file: string,
  line: number,
  message: string,
): Issue {
  return { type, severity: SEVERITY_BY_TYPE[type], locale, key, file, line, message };
}

function lineAt(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}
