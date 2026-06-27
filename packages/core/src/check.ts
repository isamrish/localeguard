/**
 * Run the full locale-parity check: missing/extra/duplicate keys, invalid
 * JSON, and interpolation mismatches across every configured locale.
 */

import { compareKeys } from "./key-comparator/compare";
import { loadLocale } from "./locale-parser/load";
import { comparePlaceholders } from "./placeholder-validator/placeholder";
import {
  DEFAULT_BLOCK_ON,
  SEVERITY_BY_TYPE,
} from "./types";
import type {
  CheckResult,
  CheckStats,
  Issue,
  IssueType,
  LocaleGuardConfig,
} from "./types";

export class LocaleGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocaleGuardError";
  }
}

export interface RunCheckOptions {
  /** Absolute project root; reported file paths are relative to this. */
  rootDir: string;
}

export function runCheck(config: LocaleGuardConfig, opts: RunCheckOptions): CheckResult {
  const blockOn = config.blockOn ?? DEFAULT_BLOCK_ON;
  const issues: Issue[] = [];
  const missingLocales: string[] = [];

  const loadOpts = { rootDir: opts.rootDir, localesPath: config.localesPath };
  const source = loadLocale(config.sourceLocale, loadOpts);
  if (!source.found) {
    throw new LocaleGuardError(
      `Source locale "${config.sourceLocale}" not found under "${config.localesPath}". ` +
        `Check "sourceLocale" and "localesPath" in your config.`,
    );
  }
  issues.push(...source.issues);

  const byLocale: CheckStats["byLocale"] = {};

  for (const locale of config.locales) {
    if (locale === config.sourceLocale) continue;
    byLocale[locale] = { missing: 0, extra: 0, placeholder: 0 };

    const target = loadLocale(locale, loadOpts);
    if (!target.found) {
      missingLocales.push(locale);
      issues.push({
        type: "missing-key",
        severity: SEVERITY_BY_TYPE["missing-key"],
        locale,
        file: `${config.localesPath}/${locale}`,
        message: `No locale files found for "${locale}".`,
        suggestion: `Create "${config.localesPath}/${locale}.json" (or a "${locale}/" directory).`,
      });
      continue;
    }
    issues.push(...target.issues);

    const diff = compareKeys(source.entries.keys(), target.entries.keys());

    for (const key of diff.missing) {
      const ref = source.entries.get(key)!;
      byLocale[locale].missing++;
      issues.push({
        type: "missing-key",
        severity: SEVERITY_BY_TYPE["missing-key"],
        locale,
        key,
        file: ref.file,
        line: ref.line,
        message: `Key "${key}" is missing in "${locale}".`,
        suggestion: `Add "${key}" to the "${locale}" locale.`,
      });
    }

    for (const key of diff.extra) {
      const ref = target.entries.get(key)!;
      byLocale[locale].extra++;
      issues.push({
        type: "extra-key",
        severity: SEVERITY_BY_TYPE["extra-key"],
        locale,
        key,
        file: ref.file,
        line: ref.line,
        message: `Key "${key}" exists in "${locale}" but not in source "${config.sourceLocale}".`,
        suggestion: `Remove "${key}" from "${locale}", or add it to the source locale.`,
      });
    }

    for (const key of diff.shared) {
      const sourceEntry = source.entries.get(key)!;
      const targetEntry = target.entries.get(key)!;
      const pdiff = comparePlaceholders(sourceEntry.value as never, targetEntry.value as never);
      if (pdiff) {
        byLocale[locale].placeholder++;
        const parts: string[] = [];
        if (pdiff.missing.length) {
          parts.push(`missing ${pdiff.missing.map((v) => `{${v}}`).join(", ")}`);
        }
        if (pdiff.extra.length) {
          parts.push(`unexpected ${pdiff.extra.map((v) => `{${v}}`).join(", ")}`);
        }
        issues.push({
          type: "placeholder-mismatch",
          severity: SEVERITY_BY_TYPE["placeholder-mismatch"],
          locale,
          key,
          file: targetEntry.file,
          line: targetEntry.line,
          message: `Interpolation mismatch in "${key}" (${locale}): ${parts.join("; ")}.`,
          suggestion: "Keep the same interpolation variables as the source string.",
        });
      }
    }
  }

  sortIssues(issues);
  const stats = buildStats(config, source.entries.size, issues, byLocale, blockOn);
  return { issues, stats, missingLocales };
}

const TYPE_ORDER: IssueType[] = [
  "invalid-json",
  "duplicate-key",
  "missing-key",
  "extra-key",
  "placeholder-mismatch",
];

function sortIssues(issues: Issue[]): void {
  issues.sort((a, b) => {
    const byLoc = (a.locale ?? "").localeCompare(b.locale ?? "");
    if (byLoc) return byLoc;
    const byType = TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
    if (byType) return byType;
    return (a.key ?? "").localeCompare(b.key ?? "");
  });
}

function buildStats(
  config: LocaleGuardConfig,
  sourceKeyCount: number,
  issues: Issue[],
  byLocale: CheckStats["byLocale"],
  blockOn: IssueType[],
): CheckStats {
  const byType: Record<IssueType, number> = {
    "invalid-json": 0,
    "missing-key": 0,
    "extra-key": 0,
    "duplicate-key": 0,
    "placeholder-mismatch": 0,
  };
  let errorCount = 0;
  let warningCount = 0;
  let failed = false;

  for (const issue of issues) {
    byType[issue.type]++;
    if (issue.severity === "error") errorCount++;
    else warningCount++;
    if (blockOn.includes(issue.type)) failed = true;
  }

  return {
    sourceLocale: config.sourceLocale,
    sourceKeyCount,
    byType,
    byLocale,
    errorCount,
    warningCount,
    failed,
  };
}
