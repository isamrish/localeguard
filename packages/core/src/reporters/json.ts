/**
 * Machine-readable JSON reporter, suitable for piping into other tooling.
 */

import type { CheckResult } from "../types";

export function formatJson(result: CheckResult): string {
  return JSON.stringify(
    {
      schemaVersion: 1,
      tool: "localeguard",
      stats: result.stats,
      missingLocales: result.missingLocales,
      issues: result.issues,
    },
    null,
    2,
  );
}
