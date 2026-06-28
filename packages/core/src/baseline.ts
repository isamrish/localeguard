/**
 * Baseline support: record the issues that already exist in a project so that
 * subsequent runs only fail on *new* issues. This lets teams adopt LocaleGuard
 * on an existing codebase without fixing everything up front.
 *
 * Issues are matched by a line-independent signature (type + file + locale +
 * key + message), so edits elsewhere in a file don't invalidate the baseline.
 */

import type { Issue } from "./types";

export interface BaselineEntry {
  type: string;
  file: string;
  locale?: string;
  key?: string;
  message: string;
}

export interface Baseline {
  version: number;
  createdAt: string;
  issues: BaselineEntry[];
}

export const BASELINE_VERSION = 1;

export function issueSignature(issue: {
  type: string;
  file: string;
  locale?: string;
  key?: string;
  message: string;
}): string {
  return JSON.stringify([
    issue.type,
    issue.file,
    issue.locale ?? "",
    issue.key ?? "",
    issue.message,
  ]);
}

export function createBaseline(issues: Issue[]): Baseline {
  return {
    version: BASELINE_VERSION,
    createdAt: new Date().toISOString(),
    issues: issues.map((i) => ({
      type: i.type,
      file: i.file,
      locale: i.locale,
      key: i.key,
      message: i.message,
    })),
  };
}

/** Split issues into those not in the baseline (kept) and a suppressed count. */
export function applyBaseline(
  issues: Issue[],
  baseline: Baseline,
): { issues: Issue[]; suppressed: number } {
  const signatures = new Set(baseline.issues.map(issueSignature));
  const kept: Issue[] = [];
  let suppressed = 0;
  for (const issue of issues) {
    if (signatures.has(issueSignature(issue))) suppressed += 1;
    else kept.push(issue);
  }
  return { issues: kept, suppressed };
}
