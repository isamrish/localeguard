/**
 * Run the full locale-parity check: missing/extra/duplicate keys, invalid
 * JSON, and interpolation mismatches across every configured locale.
 *
 * Source-code checks (hardcoded text) live in `@localeguard/react-analyzer`
 * and are composed with these results by the CLI. The helpers here
 * (`summarizeIssues`, `sortIssues`) operate on any issue list so a combined
 * report can be produced.
 */

import { applyFramework } from "./framework";
import { compareKeys } from "./key-comparator/compare";
import { loadLocale } from "./locale-parser/load";
import { comparePlaceholders } from "./placeholder-validator/placeholder";
import { DEFAULT_BLOCK_ON, ISSUE_TYPES, SEVERITY_BY_TYPE } from "./types";
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

export function runCheck(rawConfig: LocaleGuardConfig, opts: RunCheckOptions): CheckResult {
  const config = applyFramework(rawConfig);
  const issues: Issue[] = [];
  const missingLocales: string[] = [];

  const loadOpts = {
    rootDir: opts.rootDir,
    localesPath: config.localesPath,
    messageFormat: config.messageFormat,
    localeFormat: config.localeFormat,
    sourceLocale: config.sourceLocale,
  };
  const source = loadLocale(config.sourceLocale, loadOpts);
  if (!source.found) {
    throw new LocaleGuardError(
      `Source locale "${config.sourceLocale}" not found under "${config.localesPath}". ` +
        `Check "sourceLocale" and "localesPath" in your config.`,
    );
  }
  issues.push(...source.issues);

  for (const locale of config.locales) {
    if (locale === config.sourceLocale) continue;

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
  const stats = summarizeIssues(issues, {
    sourceLocale: config.sourceLocale,
    sourceKeyCount: source.entries.size,
    locales: config.locales,
    blockOn: config.blockOn,
  });
  return { issues, stats, missingLocales };
}

export interface SummarizeParams {
  sourceLocale: string;
  sourceKeyCount: number;
  locales: string[];
  blockOn?: IssueType[];
}

/** Build aggregate statistics for an arbitrary set of issues. */
export function summarizeIssues(issues: Issue[], params: SummarizeParams): CheckStats {
  const blockOn = params.blockOn ?? DEFAULT_BLOCK_ON;

  const byType = Object.fromEntries(ISSUE_TYPES.map((t) => [t, 0])) as Record<IssueType, number>;

  const byLocale: CheckStats["byLocale"] = {};
  for (const locale of params.locales) {
    if (locale !== params.sourceLocale) {
      byLocale[locale] = { missing: 0, extra: 0, placeholder: 0 };
    }
  }

  let errorCount = 0;
  let warningCount = 0;
  let failed = false;

  for (const issue of issues) {
    byType[issue.type]++;
    if (issue.severity === "error") errorCount++;
    else warningCount++;
    if (blockOn.includes(issue.type)) failed = true;

    if (issue.locale) {
      const bucket = (byLocale[issue.locale] ??= { missing: 0, extra: 0, placeholder: 0 });
      if (issue.type === "missing-key") bucket.missing++;
      else if (issue.type === "extra-key") bucket.extra++;
      else if (issue.type === "placeholder-mismatch") bucket.placeholder++;
    }
  }

  return {
    sourceLocale: params.sourceLocale,
    sourceKeyCount: params.sourceKeyCount,
    byType,
    byLocale,
    errorCount,
    warningCount,
    failed,
  };
}

const TYPE_ORDER: IssueType[] = ISSUE_TYPES;

/** Sort issues by locale, then type, then key, then file/line. */
export function sortIssues(issues: Issue[]): void {
  issues.sort((a, b) => {
    const byLoc = (a.locale ?? "").localeCompare(b.locale ?? "");
    if (byLoc) return byLoc;
    const byType = TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
    if (byType) return byType;
    const byFile = a.file.localeCompare(b.file);
    if (byFile) return byFile;
    const byLine = (a.line ?? 0) - (b.line ?? 0);
    if (byLine) return byLine;
    return (a.key ?? "").localeCompare(b.key ?? "");
  });
}
