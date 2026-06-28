/**
 * `localeguard check` — run the locale-parity and source-code checks, merge the
 * results, and report them.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import {
  applyBaseline,
  checkKeyUsage,
  createBaseline,
  formatJson,
  formatMarkdown,
  formatSarif,
  formatText,
  loadLocale,
  LocaleGuardError,
  runCheck,
  sortIssues,
  summarizeIssues,
} from "@localeguard/core";
import type { Baseline, CheckResult, Issue, KeyReference } from "@localeguard/core";
import {
  analyzeProject,
  extractInlineTemplates,
  extractKeyReferences,
} from "@localeguard/react-analyzer";
import {
  analyzeTemplates,
  analyzeVueI18nBlocks,
  extractTemplateKeyReferences,
  scanAngularTemplate,
  scanTemplateString,
} from "@localeguard/template-analyzer";

import { ConfigError, loadConfig } from "../config";
import { applyFix } from "../fix";
import { filterIssuesToChanged, getChangedFiles, GitError } from "../git-changed";

export type Reporter = "text" | "json" | "markdown" | "sarif";

export interface CheckArgs {
  cwd: string;
  configPath?: string;
  reporter: Reporter;
  color: boolean;
  /** Run source-code analysis (hardcoded text). Defaults to true. */
  code: boolean;
  /** Write the report to this file instead of stdout. */
  output?: string;
  /** Tool version, shown in markdown/sarif output. */
  toolVersion: string;
  /** When set, only report issues touching files changed vs this git ref. */
  changedBase?: string;
  /** Path to the baseline file (overrides config). */
  baselinePath?: string;
  /** Write the current issues to the baseline file and exit. */
  updateBaseline: boolean;
  /** Add missing keys to JSON target locales and exit. */
  fix: boolean;
}

/** Returns the process exit code. */
export function runCheckCommand(args: CheckArgs): number {
  let loaded;
  try {
    loaded = loadConfig({ cwd: args.cwd, configPath: args.configPath });
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(`localeguard: ${err.message}\n`);
      return 1;
    }
    throw err;
  }

  const { config, rootDir } = loaded;

  let localeResult: CheckResult;
  try {
    localeResult = runCheck(config, { rootDir });
  } catch (err) {
    if (err instanceof LocaleGuardError) {
      process.stderr.write(`localeguard: ${err.message}\n`);
      return 1;
    }
    throw err;
  }

  const codeIssues: Issue[] = [];
  if (args.code) {
    codeIssues.push(
      ...analyzeProject(
        {
          include: config.include,
          ignore: config.ignore,
          translationComponents: config.translationComponents,
        },
        { rootDir },
      ),
      ...analyzeTemplates(
        {
          include: config.include,
          ignore: config.ignore,
          translationComponents: config.translationComponents,
          framework: config.framework,
        },
        { rootDir },
      ),
    );

    // Inline Angular templates (`@Component({ template: `…` })`): scan for
    // hardcoded text and collect their key references.
    const inlineRefs: KeyReference[] = [];
    if (config.framework === "ngx-translate" || config.framework === "angular") {
      for (const tmpl of extractInlineTemplates(
        { include: config.include, ignore: config.ignore },
        { rootDir },
      )) {
        codeIssues.push(
          ...scanAngularTemplate(tmpl.source, tmpl.file, config.translationComponents, tmpl.line),
        );
        inlineRefs.push(...scanTemplateString(tmpl.source, tmpl.file, tmpl.line).references);
      }
    }

    // Key-usage: compare literal key references in code against the source locale.
    const reactRefs = extractKeyReferences(
      {
        include: config.include,
        ignore: config.ignore,
        translationFunctions: config.translationFunctions,
        translationComponents: config.translationComponents,
      },
      { rootDir },
    );
    const templateRefs = extractTemplateKeyReferences(
      { include: config.include, ignore: config.ignore, framework: config.framework },
      { rootDir },
    );
    const source = loadLocale(config.sourceLocale, {
      rootDir,
      localesPath: config.localesPath,
      messageFormat: config.messageFormat,
      localeFormat: config.localeFormat,
      sourceLocale: config.sourceLocale,
    });
    codeIssues.push(
      ...checkKeyUsage(
        source.entries,
        [...reactRefs.references, ...templateRefs.references, ...inlineRefs],
        {
          unusedKeys: config.unusedKeys,
          hasDynamicKeys: reactRefs.hasDynamicKeys || templateRefs.hasDynamicKeys,
        },
      ),
    );
  }

  // Vue <i18n> SFC blocks: per-component message parity (locale check, always on).
  const blockIssues =
    config.framework === "vue-i18n"
      ? analyzeVueI18nBlocks(
          {
            sourceLocale: config.sourceLocale,
            locales: config.locales,
            framework: config.framework,
            include: config.include,
            ignore: config.ignore,
          },
          { rootDir },
        )
      : [];

  let issues = [...localeResult.issues, ...codeIssues, ...blockIssues];

  if (args.changedBase !== undefined) {
    let changed: Set<string>;
    try {
      changed = getChangedFiles(rootDir, args.changedBase);
    } catch (err) {
      if (err instanceof GitError) {
        process.stderr.write(`localeguard: ${err.message}\n`);
        return 1;
      }
      throw err;
    }
    issues = filterIssuesToChanged(issues, changed, config.localesPath);
  }

  sortIssues(issues);

  // --fix: stub missing keys into JSON target locales, then stop.
  if (args.fix) {
    if ((config.localeFormat && config.localeFormat !== "json") || config.messageFormat === "icu-descriptor") {
      process.stderr.write("localeguard: --fix only supports plain JSON locales.\n");
      return 1;
    }
    const source = loadLocale(config.sourceLocale, {
      rootDir,
      localesPath: config.localesPath,
      messageFormat: config.messageFormat,
    });
    const result = applyFix({
      issues,
      sourceEntries: source.entries,
      rootDir,
      localesPath: config.localesPath,
    });
    process.stderr.write(
      `localeguard: added ${result.fixed} missing key(s) to ${result.files} file(s). Re-run to verify.\n`,
    );
    return 0;
  }

  const baselinePath = path.resolve(args.cwd, args.baselinePath ?? config.baseline ?? "localeguard-baseline.json");

  // Write/update the baseline from the full current issue set, then stop.
  if (args.updateBaseline) {
    fs.writeFileSync(baselinePath, JSON.stringify(createBaseline(issues), null, 2) + "\n", "utf8");
    process.stderr.write(
      `localeguard: wrote baseline with ${issues.length} issue(s) to ${baselinePath}\n`,
    );
    return 0;
  }

  // Suppress issues already recorded in the baseline file, if present.
  let suppressed = 0;
  if (fs.existsSync(baselinePath)) {
    try {
      const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8")) as Baseline;
      const applied = applyBaseline(issues, baseline);
      issues = applied.issues;
      suppressed = applied.suppressed;
    } catch (err) {
      process.stderr.write(`localeguard: could not read baseline ${baselinePath}: ${(err as Error).message}\n`);
      return 1;
    }
  }

  const stats = summarizeIssues(issues, {
    sourceLocale: config.sourceLocale,
    sourceKeyCount: localeResult.stats.sourceKeyCount,
    locales: config.locales,
    blockOn: config.blockOn,
  });
  const result: CheckResult = { issues, stats, missingLocales: localeResult.missingLocales };

  const report = render(result, args);

  if (args.output) {
    const outPath = path.resolve(args.cwd, args.output);
    fs.writeFileSync(outPath, report + "\n", "utf8");
    process.stderr.write(`localeguard: wrote ${args.reporter} report to ${outPath}\n`);
  } else {
    process.stdout.write(report + "\n");
  }

  if (suppressed > 0) {
    process.stderr.write(`localeguard: ${suppressed} issue(s) suppressed by baseline.\n`);
  }

  return result.stats.failed ? 1 : 0;
}

function render(result: CheckResult, args: CheckArgs): string {
  switch (args.reporter) {
    case "json":
      return formatJson(result);
    case "markdown":
      return formatMarkdown(result, { toolVersion: args.toolVersion });
    case "sarif":
      return formatSarif(result, { toolVersion: args.toolVersion });
    default:
      return formatText(result, { color: args.color });
  }
}
