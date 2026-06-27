#!/usr/bin/env node
/**
 * LocaleGuard CLI entry point.
 */

import { parseArgs } from "node:util";

import { runCheckCommand } from "./commands/check";
import { runInitCommand } from "./commands/init";

const VERSION = "0.1.0";

const HELP = `LocaleGuard ${VERSION}
Localization quality gate for React and TypeScript projects.

Usage:
  localeguard <command> [options]

Commands:
  check            Validate locale files against the source locale
  init             Create a starter localeguard.config.json
  help             Show this help

Options:
  -c, --config <path>     Path to a config file
  -r, --reporter <type>   Output format: text (default) or json
      --cwd <dir>         Run as if from this directory
      --no-color          Disable colored output
  -h, --help              Show help
  -v, --version           Show version

Examples:
  localeguard init
  localeguard check
  localeguard check --reporter json
`;

export function main(argv: string[]): number {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        config: { type: "string", short: "c" },
        reporter: { type: "string", short: "r" },
        cwd: { type: "string" },
        color: { type: "boolean" },
        "no-color": { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    });
  } catch (err) {
    process.stderr.write(`localeguard: ${(err as Error).message}\n`);
    return 1;
  }

  const { values, positionals } = parsed;

  if (values.version) {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }

  const command = positionals[0] ?? (values.help ? "help" : undefined);

  if (!command || command === "help" || values.help) {
    process.stdout.write(HELP);
    return command && command !== "help" ? 1 : 0;
  }

  const cwd = values.cwd ? values.cwd : process.cwd();

  switch (command) {
    case "check": {
      const reporter = values.reporter === "json" ? "json" : "text";
      if (values.reporter && reporter !== values.reporter) {
        process.stderr.write(`localeguard: unknown reporter "${values.reporter}"\n`);
        return 1;
      }
      const color = resolveColor(values.color, values["no-color"]);
      return runCheckCommand({ cwd, configPath: values.config, reporter, color });
    }
    case "init":
      return runInitCommand({ cwd });
    default:
      process.stderr.write(`localeguard: unknown command "${command}"\n\n${HELP}`);
      return 1;
  }
}

function resolveColor(color?: boolean, noColor?: boolean): boolean {
  if (noColor) return false;
  if (color) return true;
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}

// Run when invoked directly (not when imported by tests).
if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
