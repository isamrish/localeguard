/**
 * `localeguard check` — run the locale-parity check and report results.
 */

import { formatJson, formatText, LocaleGuardError, runCheck } from "@localeguard/core";

import { ConfigError, loadConfig } from "../config";

export interface CheckArgs {
  cwd: string;
  configPath?: string;
  reporter: "text" | "json";
  color: boolean;
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

  let result;
  try {
    result = runCheck(loaded.config, { rootDir: loaded.rootDir });
  } catch (err) {
    if (err instanceof LocaleGuardError) {
      process.stderr.write(`localeguard: ${err.message}\n`);
      return 1;
    }
    throw err;
  }

  if (args.reporter === "json") {
    process.stdout.write(formatJson(result) + "\n");
  } else {
    process.stdout.write(formatText(result, { color: args.color }) + "\n");
  }

  return result.stats.failed ? 1 : 0;
}
