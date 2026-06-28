/**
 * Changed-files-only support: limit reported issues to files affected by the
 * current change set (e.g. a pull request), for fast, focused CI feedback.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import type { Issue } from "@localeguard/core";

export class GitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitError";
  }
}

/**
 * Return the set of files changed relative to `base`, as paths relative to
 * `rootDir` (POSIX-separated). Throws GitError if not in a git repo or the
 * base ref cannot be resolved.
 */
export function getChangedFiles(rootDir: string, base: string): Set<string> {
  let gitRoot: string;
  try {
    gitRoot = run(rootDir, ["rev-parse", "--show-toplevel"]).trim();
  } catch {
    throw new GitError("not a git repository — cannot use --changed");
  }

  let output: string;
  try {
    output = run(rootDir, ["diff", "--name-only", "--diff-filter=d", base]);
  } catch (err) {
    const first = (err as Error).message.split("\n")[0] ?? "";
    throw new GitError(`could not diff against "${base}": ${first}`);
  }

  // `git rev-parse --show-toplevel` returns a canonical path (e.g. /private/var
  // on macOS), so canonicalize rootDir too before relativizing — otherwise
  // symlinked roots produce mismatched paths.
  const realRoot = fs.realpathSync(rootDir);

  const changed = new Set<string>();
  for (const line of output.split("\n")) {
    const file = line.trim();
    if (!file) continue;
    const abs = path.resolve(gitRoot, file);
    changed.add(path.relative(realRoot, abs).split(path.sep).join("/"));
  }
  return changed;
}

/**
 * Keep an issue when its own file changed, or — for locale-parity issues, which
 * may be reported against the source file — when any of the target locale's
 * files changed.
 */
export function filterIssuesToChanged(
  issues: Issue[],
  changed: Set<string>,
  localesPath: string,
): Issue[] {
  const lp = localesPath.replace(/\/+$/, "");
  return issues.filter((issue) => {
    if (changed.has(issue.file)) return true;
    if (issue.locale && localeFilesChanged(changed, lp, issue.locale)) return true;
    return false;
  });
}

function localeFilesChanged(changed: Set<string>, localesPath: string, locale: string): boolean {
  const singleFile = `${localesPath}/${locale}.json`;
  const dirPrefix = `${localesPath}/${locale}/`;
  for (const file of changed) {
    if (file === singleFile || file.startsWith(dirPrefix)) return true;
  }
  return false;
}

function run(cwd: string, args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}
