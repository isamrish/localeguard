#!/usr/bin/env node
/**
 * LocaleGuard CLI entry point.
 */

import { parseArgs } from "node:util";

import { runCheckCommand } from "./commands/check";
import type { Reporter } from "./commands/check";
import { runInitCommand } from "./commands/init";

const VERSION = "0.5.0";
const REPORTERS: Reporter[] = ["text", "json", "markdown", "sarif"];

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
  -r, --reporter <type>   Output format: text (default), json, markdown, sarif
  -o, --output <file>     Write the report to a file instead of stdout
      --changed           Only report issues in files changed vs --base
      --base <ref>        Git ref to diff against for --changed (default: HEAD)
      --baseline <path>   Baseline file of pre-existing issues to suppress
      --update-baseline   Write current issues to the baseline file and exit
      --fix               Add missing keys to JSON target locales and exit
      --cwd <dir>         Run as if from this directory
      --no-code           Skip source-code analysis (locale files only)
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
        output: { type: "string", short: "o" },
        changed: { type: "boolean" },
        base: { type: "string" },
        baseline: { type: "string" },
        "update-baseline": { type: "boolean" },
        fix: { type: "boolean" },
        cwd: { type: "string" },
        color: { type: "boolean" },
        "no-color": { type: "boolean" },
        code: { type: "boolean" },
        "no-code": { type: "boolean" },
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
      const reporter = (values.reporter ?? "text") as Reporter;
      if (!REPORTERS.includes(reporter)) {
        process.stderr.write(
          `localeguard: unknown reporter "${values.reporter}" (expected ${REPORTERS.join(", ")})\n`,
        );
        return 1;
      }
      const color = resolveColor(values.color, values["no-color"]);
      const code = !values["no-code"];
      const changedBase = values.changed ? (values.base ?? "HEAD") : undefined;
      return runCheckCommand({
        cwd,
        configPath: values.config,
        reporter,
        output: values.output,
        color,
        code,
        toolVersion: VERSION,
        changedBase,
        baselinePath: values.baseline,
        updateBaseline: Boolean(values["update-baseline"]),
        fix: Boolean(values.fix),
      });
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
