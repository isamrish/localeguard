/**
 * Minimal glob-based file discovery (zero dependencies).
 *
 * Supports the subset of glob syntax LocaleGuard configs use:
 *   - `**`  matches any number of path segments
 *   - `*`   matches anything except a path separator
 *   - `?`   matches a single non-separator character
 *   - `{a,b}` matches any of the comma-separated alternatives
 *
 * Paths are matched in POSIX form relative to the root directory.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const ALWAYS_SKIP = new Set(["node_modules", ".git", "dist", "build", "coverage"]);

function escapeLiteral(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function globToRegExp(glob: string): RegExp {
  let re = "";
  let i = 0;
  while (i < glob.length) {
    const c = glob[i]!;
    if (c === "*") {
      if (glob[i + 1] === "*") {
        if (glob[i + 2] === "/") {
          re += "(?:[^/]+/)*"; // **/ — zero or more segments
          i += 3;
        } else {
          re += ".*"; // ** — anything, including separators
          i += 2;
        }
        continue;
      }
      re += "[^/]*";
      i += 1;
      continue;
    }
    if (c === "?") {
      re += "[^/]";
      i += 1;
      continue;
    }
    if (c === "{") {
      const end = glob.indexOf("}", i);
      if (end !== -1) {
        const alts = glob.slice(i + 1, end).split(",").map(escapeLiteral);
        re += `(?:${alts.join("|")})`;
        i = end + 1;
        continue;
      }
    }
    re += escapeLiteral(c);
    i += 1;
  }
  return new RegExp(`^${re}$`);
}

export interface FindFilesOptions {
  rootDir: string;
  include: string[];
  ignore?: string[];
}

/** Return absolute paths of files under `rootDir` matching the patterns. */
export function findFiles(opts: FindFilesOptions): string[] {
  const includeRe = opts.include.map(globToRegExp);
  const ignoreRe = (opts.ignore ?? []).map(globToRegExp);
  const results: string[] = [];

  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const rel = toPosix(path.relative(opts.rootDir, abs));
      if (entry.isDirectory()) {
        if (ALWAYS_SKIP.has(entry.name)) continue;
        if (ignoreRe.some((re) => re.test(rel))) continue;
        walk(abs);
      } else if (entry.isFile()) {
        if (ignoreRe.some((re) => re.test(rel))) continue;
        if (includeRe.some((re) => re.test(rel))) results.push(abs);
      }
    }
  };

  walk(opts.rootDir);
  results.sort();
  return results;
}

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}
