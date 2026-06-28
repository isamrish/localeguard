/**
 * `localeguard check` — run the locale-parity and source-code checks, merge the
 * results, and report them.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import {
  formatJson,
  formatMarkdown,
  formatSarif,
  formatText,
  LocaleGuardError,
  runCheck,
  sortIssues,
  summarizeIssues,
} from "@localeguard/core";
import type { CheckResult, Issue } from "@localeguard/core";
import { analyzeProject } from "@localeguard/react-analyzer";

import { ConfigError, loadConfig } from "../config";

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

  const codeIssues: Issue[] = args.code
    ? analyzeProject(
        {
          include: config.include,
          ignore: config.ignore,
          translationComponents: config.translationComponents,
        },
        { rootDir },
      )
    : [];

  const issues = [...localeResult.issues, ...codeIssues];
  sortIssues(issues);
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
