/**
 * `localeguard init` — write a starter localeguard.config.json.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const TEMPLATE = {
  $schema:
    "https://raw.githubusercontent.com/isamrish/localeguard/main/schema/localeguard.config.schema.json",
  sourceLocale: "en",
  locales: ["fr", "tr", "ja", "es"],
  localesPath: "public/locales",
  include: ["src/**/*.{ts,tsx}"],
  translationFunctions: ["t", "i18n.t"],
  translationComponents: ["Trans"],
  ignore: ["**/*.test.tsx", "**/*.stories.tsx"],
  blockOn: ["missing-key", "placeholder-mismatch", "invalid-json", "duplicate-key"],
};

export interface InitArgs {
  cwd: string;
}

/** Returns the process exit code. */
export function runInitCommand(args: InitArgs): number {
  const target = path.join(args.cwd, "localeguard.config.json");
  if (fs.existsSync(target)) {
    process.stderr.write(`localeguard: ${target} already exists; not overwriting.\n`);
    return 1;
  }
  fs.writeFileSync(target, JSON.stringify(TEMPLATE, null, 2) + "\n", "utf8");
  process.stdout.write(`Created ${target}\n`);
  process.stdout.write("Edit it to match your project, then run: localeguard check\n");
  return 0;
}
