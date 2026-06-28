/**
 * Locate, load, and validate `localeguard.config.json`.
 *
 * Resolution order:
 *   1. an explicit `--config <path>`
 *   2. `localeguard.config.json` in the working directory
 *   3. a `"localeguard"` field in the working directory's `package.json`
 *
 * The project root (paths in the config are relative to it) is the directory
 * that contains the resolved config.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { applyFramework, ISSUE_TYPES } from "@localeguard/core";
import type { Framework, IssueType, LocaleGuardConfig, MessageFormat } from "@localeguard/core";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export interface LoadedConfig {
  config: LocaleGuardConfig;
  rootDir: string;
  configPath: string;
}

const VALID_BLOCK_ON: IssueType[] = ISSUE_TYPES;
const VALID_FRAMEWORKS: Framework[] = [
  "react-i18next",
  "react-intl",
  "next-intl",
  "vue-i18n",
  "ngx-translate",
];
const VALID_MESSAGE_FORMATS: MessageFormat[] = ["plain", "icu-descriptor"];

export function loadConfig(opts: { cwd: string; configPath?: string }): LoadedConfig {
  const { cwd } = opts;

  if (opts.configPath) {
    const abs = path.resolve(cwd, opts.configPath);
    if (!fileExists(abs)) {
      throw new ConfigError(`Config file not found: ${abs}`);
    }
    return { config: validate(readJson(abs), abs), rootDir: path.dirname(abs), configPath: abs };
  }

  const defaultPath = path.join(cwd, "localeguard.config.json");
  if (fileExists(defaultPath)) {
    return {
      config: validate(readJson(defaultPath), defaultPath),
      rootDir: cwd,
      configPath: defaultPath,
    };
  }

  const pkgPath = path.join(cwd, "package.json");
  if (fileExists(pkgPath)) {
    const pkg = readJson(pkgPath) as Record<string, unknown>;
    if (pkg.localeguard && typeof pkg.localeguard === "object") {
      return {
        config: validate(pkg.localeguard as Record<string, unknown>, pkgPath),
        rootDir: cwd,
        configPath: pkgPath,
      };
    }
  }

  throw new ConfigError(
    "No LocaleGuard config found. Run `localeguard init` to create localeguard.config.json.",
  );
}

function validate(raw: Record<string, unknown>, source: string): LocaleGuardConfig {
  const fail = (msg: string): never => {
    throw new ConfigError(`Invalid config (${source}): ${msg}`);
  };

  if (typeof raw.sourceLocale !== "string" || raw.sourceLocale.length === 0) {
    fail('"sourceLocale" must be a non-empty string.');
  }
  if (!Array.isArray(raw.locales) || raw.locales.some((l) => typeof l !== "string")) {
    fail('"locales" must be an array of strings.');
  }
  if (typeof raw.localesPath !== "string" || raw.localesPath.length === 0) {
    fail('"localesPath" must be a non-empty string.');
  }
  if (raw.blockOn !== undefined) {
    if (!Array.isArray(raw.blockOn) || raw.blockOn.some((b) => !VALID_BLOCK_ON.includes(b as IssueType))) {
      fail(`"blockOn" must be an array of: ${VALID_BLOCK_ON.join(", ")}.`);
    }
  }
  if (raw.framework !== undefined && !VALID_FRAMEWORKS.includes(raw.framework as Framework)) {
    fail(`"framework" must be one of: ${VALID_FRAMEWORKS.join(", ")}.`);
  }
  if (raw.messageFormat !== undefined && !VALID_MESSAGE_FORMATS.includes(raw.messageFormat as MessageFormat)) {
    fail(`"messageFormat" must be one of: ${VALID_MESSAGE_FORMATS.join(", ")}.`);
  }
  if (raw.unusedKeys !== undefined && typeof raw.unusedKeys !== "boolean") {
    fail('"unusedKeys" must be a boolean.');
  }

  // Fill in framework-preset defaults for any fields the user left unset.
  return applyFramework({
    framework: raw.framework as Framework | undefined,
    messageFormat: raw.messageFormat as MessageFormat | undefined,
    sourceLocale: raw.sourceLocale as string,
    locales: raw.locales as string[],
    localesPath: raw.localesPath as string,
    include: raw.include as string[] | undefined,
    translationFunctions: raw.translationFunctions as string[] | undefined,
    translationComponents: raw.translationComponents as string[] | undefined,
    ignore: raw.ignore as string[] | undefined,
    blockOn: raw.blockOn as IssueType[] | undefined,
    unusedKeys: raw.unusedKeys as boolean | undefined,
  });
}

function readJson(file: string): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch (err) {
    throw new ConfigError(`Could not parse ${file}: ${(err as Error).message}`);
  }
}

function fileExists(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}
