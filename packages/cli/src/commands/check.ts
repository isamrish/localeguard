/**
 * `localeguard check` — run the locale-parity and source-code checks, merge the
 * results, and report them.
 */

import {
  formatJson,
  formatText,
  LocaleGuardError,
  runCheck,
  sortIssues,
  summarizeIssues,
} from "@localeguard/core";
import type { CheckResult, Issue } from "@localeguard/core";
import { analyzeProject } from "@localeguard/react-analyzer";

import { ConfigError, loadConfig } from "../config";

export interface CheckArgs {
  cwd: string;
  configPath?: string;
  reporter: "text" | "json";
  color: boolean;
  /** Run source-code analysis (hardcoded text). Defaults to true. */
  code: boolean;
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

  if (args.reporter === "json") {
    process.stdout.write(formatJson(result) + "\n");
  } else {
    process.stdout.write(formatText(result, { color: args.color }) + "\n");
  }

  return result.stats.failed ? 1 : 0;
}
