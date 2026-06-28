/**
 * @localeguard/template-analyzer — detect hardcoded text in Vue (`.vue`) and
 * Angular (`.html`) templates. Zero runtime dependencies.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { findFiles } from "@localeguard/core";
import type { Framework, Issue } from "@localeguard/core";

import { scanAngularTemplate } from "./angular";
import { scanVueSfc } from "./vue";

export interface TemplateAnalyzerConfig {
  include?: string[];
  ignore?: string[];
  translationComponents?: string[];
  framework?: Framework;
}

export interface AnalyzeOptions {
  /** Absolute project root; reported file paths are relative to this. */
  rootDir: string;
}

/** Default globs by framework when `include` is not set. */
function defaultInclude(framework?: Framework): string[] {
  if (framework === "vue-i18n") return ["src/**/*.vue"];
  if (framework === "ngx-translate" || framework === "angular") return ["src/**/*.html"];
  return [];
}

function isAngular(framework?: Framework): boolean {
  return framework === "ngx-translate" || framework === "angular";
}

export function analyzeTemplates(config: TemplateAnalyzerConfig, opts: AnalyzeOptions): Issue[] {
  const include = config.include ?? defaultInclude(config.framework);
  if (include.length === 0) return [];

  const files = findFiles({ rootDir: opts.rootDir, include, ignore: config.ignore });
  const angular = isAngular(config.framework);
  const issues: Issue[] = [];

  for (const absFile of files) {
    const ext = path.extname(absFile).toLowerCase();
    // `.vue` is unambiguous; only treat `.html` as a template for Angular, so we
    // never scan arbitrary HTML pages in other projects.
    if (ext !== ".vue" && !(ext === ".html" && angular)) continue;

    let text: string;
    try {
      text = fs.readFileSync(absFile, "utf8");
    } catch {
      continue;
    }
    const rel = path.relative(opts.rootDir, absFile) || absFile;

    if (ext === ".vue") {
      issues.push(...scanVueSfc(text, rel, config.translationComponents));
    } else {
      issues.push(...scanAngularTemplate(text, rel, config.translationComponents));
    }
  }
  return issues;
}

export { scanTemplate } from "./scanner";
export type { ScanOptions, TemplateMode } from "./scanner";
export { scanVueSfc } from "./vue";
export { scanAngularTemplate } from "./angular";
export { extractTemplateKeyReferences } from "./key-references";
export type { TemplateKeyConfig, TemplateKeyResult } from "./key-references";
