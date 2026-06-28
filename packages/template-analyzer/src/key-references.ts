/**
 * Extract literal translation-key references from Vue/Angular templates so the
 * key-usage checks (undefined-key / unused-key) cover them too.
 *
 * Recognizes:
 *   - `{{ t('key') }}` / `{{ $t('key') }}`            (Vue / vue-i18n)
 *   - `v-t="'key'"`, `<i18n-t keypath="key">`         (Vue)
 *   - `{{ 'KEY' | translate }}`, `[translate]="'KEY'"` (Angular ngx-translate)
 *
 * Templates rarely carry a resolvable namespace, so references are emitted
 * without one (matched exactly or by namespaced-key suffix downstream).
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { findFiles } from "@localeguard/core";
import type { Framework, KeyReference } from "@localeguard/core";

const T_CALL = /(?:\b|\$)t\(\s*(['"])([^'"]+)\1/g;
const T_DYNAMIC = /(?:\b|\$)t\(\s*[^'"\s)]/;
const TRANSLATE_PIPE = /(['"])([^'"]+)\1\s*\|\s*translate\b/g;
const V_T = /\bv-t\s*=\s*(?:"\s*'([^']+)'\s*"|'\s*"([^"]+)"\s*')/g;
const KEYPATH = /\bkeypath\s*=\s*(?:"([^"]+)"|'([^']+)')/g;
const TRANSLATE_ATTR = /\[translate\]\s*=\s*(?:"\s*'([^']+)'\s*"|'\s*"([^"]+)"\s*')/g;

export interface TemplateKeyConfig {
  include?: string[];
  ignore?: string[];
  framework?: Framework;
}

export interface AnalyzeOptions {
  rootDir: string;
}

export interface TemplateKeyResult {
  references: KeyReference[];
  hasDynamicKeys: boolean;
}

function defaultInclude(framework?: Framework): string[] {
  if (framework === "vue-i18n") return ["src/**/*.vue"];
  if (framework === "ngx-translate" || framework === "angular") return ["src/**/*.html"];
  return [];
}

export function extractTemplateKeyReferences(
  config: TemplateKeyConfig,
  opts: AnalyzeOptions,
): TemplateKeyResult {
  const include = config.include ?? defaultInclude(config.framework);
  if (include.length === 0) return { references: [], hasDynamicKeys: false };

  const files = findFiles({ rootDir: opts.rootDir, include, ignore: config.ignore });
  const references: KeyReference[] = [];
  let hasDynamicKeys = false;

  for (const absFile of files) {
    const ext = path.extname(absFile).toLowerCase();
    if (ext !== ".vue" && ext !== ".html") continue;
    let text: string;
    try {
      text = fs.readFileSync(absFile, "utf8");
    } catch {
      continue;
    }
    const relPath = path.relative(opts.rootDir, absFile) || absFile;
    collect(text, relPath, references);
    if (T_DYNAMIC.test(text)) hasDynamicKeys = true;
  }

  return { references, hasDynamicKeys };
}

function collect(text: string, file: string, refs: KeyReference[]): void {
  const add = (key: string | undefined, index: number): void => {
    if (key) refs.push({ key, file, line: lineAt(text, index) });
  };
  for (const m of text.matchAll(T_CALL)) add(m[2], m.index ?? 0);
  for (const m of text.matchAll(TRANSLATE_PIPE)) add(m[2], m.index ?? 0);
  for (const m of text.matchAll(V_T)) add(m[1] ?? m[2], m.index ?? 0);
  for (const m of text.matchAll(KEYPATH)) add(m[1] ?? m[2], m.index ?? 0);
  for (const m of text.matchAll(TRANSLATE_ATTR)) add(m[1] ?? m[2], m.index ?? 0);
}

function lineAt(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}
