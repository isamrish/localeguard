/**
 * Human-readable terminal reporter.
 */

import type { CheckResult, Issue } from "../types";

export interface TextReporterOptions {
  /** Emit ANSI color codes. */
  color?: boolean;
}

const ANSI = {
  reset: "[0m",
  bold: "[1m",
  dim: "[2m",
  red: "[31m",
  green: "[32m",
  yellow: "[33m",
  cyan: "[36m",
};

export function formatText(result: CheckResult, opts: TextReporterOptions = {}): string {
  const color = opts.color ?? false;
  const c = (code: string, text: string) => (color ? `${code}${text}${ANSI.reset}` : text);

  const lines: string[] = [];
  lines.push(c(ANSI.bold, "LocaleGuard"));
  lines.push("");
  lines.push(
    `${c(ANSI.green, "✓")} ${result.stats.sourceLocale} reference locale loaded ` +
      c(ANSI.dim, `(${result.stats.sourceKeyCount} keys)`),
  );

  if (result.issues.length === 0) {
    lines.push("");
    lines.push(c(ANSI.green, "✓ Localization check passed."));
    return lines.join("\n");
  }

  // Group issues by locale (issues without a locale go under "general").
  const groups = new Map<string, Issue[]>();
  for (const issue of result.issues) {
    const key = issue.locale ?? "general";
    const list = groups.get(key) ?? [];
    list.push(issue);
    groups.set(key, list);
  }

  for (const [locale, group] of groups) {
    lines.push("");
    lines.push(c(ANSI.bold, locale === "general" ? "general" : locale));
    for (const issue of group) {
      const symbol = issue.severity === "error" ? c(ANSI.red, "✗") : c(ANSI.yellow, "⚠");
      const where = issue.line ? `${issue.file}:${issue.line}` : issue.file;
      const tag = c(ANSI.dim, `[${issue.type}]`);
      lines.push(`  ${symbol} ${c(ANSI.cyan, where)} ${tag} ${issue.message}`);
      if (issue.suggestion) {
        lines.push(`    ${c(ANSI.dim, `→ ${issue.suggestion}`)}`);
      }
    }
  }

  lines.push("");
  lines.push(summaryLine(result, c));
  lines.push("");
  lines.push(
    result.stats.failed
      ? c(ANSI.red, "Localization check failed.")
      : c(ANSI.green, "Localization check passed (warnings only)."),
  );

  return lines.join("\n");
}

function summaryLine(
  result: CheckResult,
  c: (code: string, text: string) => string,
): string {
  const t = result.stats.byType;
  const parts: string[] = [];
  if (t["missing-key"]) parts.push(`${t["missing-key"]} missing`);
  if (t["extra-key"]) parts.push(`${t["extra-key"]} extra`);
  if (t["placeholder-mismatch"]) parts.push(`${t["placeholder-mismatch"]} interpolation`);
  if (t["duplicate-key"]) parts.push(`${t["duplicate-key"]} duplicate`);
  if (t["invalid-json"]) parts.push(`${t["invalid-json"]} invalid-json`);
  if (t["hardcoded-string"]) parts.push(`${t["hardcoded-string"]} hardcoded-text`);
  if (t["hardcoded-attribute"]) parts.push(`${t["hardcoded-attribute"]} hardcoded-attr`);
  const detail = parts.length ? parts.join(", ") : "no issues";
  return c(ANSI.bold, "Summary: ") + detail;
}
