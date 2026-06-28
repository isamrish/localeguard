/**
 * Extract literal translation-key references from React/TypeScript source so
 * they can be checked against the locale keys (used-but-missing / unused).
 *
 * Recognizes:
 *   - `t('key')`, `i18n.t('key')`, `intl.formatMessage({ id: 'key' })`
 *   - `<FormattedMessage id="key" />`, `<Trans i18nKey="key" />`
 *   - `useTranslations('NS')` / `useTranslation('ns')` to resolve a file-level
 *     namespace applied to bare `t('key')` calls.
 *
 * Non-literal keys (`t(name)`, template strings with substitutions) are not
 * resolvable and are reported via `hasDynamicKeys` so the unused-key check can
 * stay conservative.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import ts from "typescript";

import { findFiles } from "@localeguard/core";
import type { KeyReference } from "@localeguard/core";

const NAMESPACE_SETTERS = new Set(["useTranslations", "getTranslations", "useTranslation"]);
const DEFAULT_TRANSLATION_FUNCTIONS = ["t", "i18n.t", "formatMessage", "intl.formatMessage"];
const DEFAULT_TRANSLATION_COMPONENTS = ["FormattedMessage", "Trans"];

export interface KeyReferenceConfig {
  include?: string[];
  ignore?: string[];
  translationFunctions?: string[];
  translationComponents?: string[];
}

export interface AnalyzeOptions {
  rootDir: string;
}

export interface KeyReferenceResult {
  references: KeyReference[];
  hasDynamicKeys: boolean;
}

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"]);

export function extractKeyReferences(
  config: KeyReferenceConfig,
  opts: AnalyzeOptions,
): KeyReferenceResult {
  const include = config.include ?? ["src/**/*.{ts,tsx}"];
  const functions = new Set(config.translationFunctions ?? DEFAULT_TRANSLATION_FUNCTIONS);
  const components = new Set(config.translationComponents ?? DEFAULT_TRANSLATION_COMPONENTS);

  const files = findFiles({ rootDir: opts.rootDir, include, ignore: config.ignore });
  const references: KeyReference[] = [];
  let hasDynamicKeys = false;

  for (const absFile of files) {
    if (!SOURCE_EXTENSIONS.has(path.extname(absFile).toLowerCase())) continue;
    let text: string;
    try {
      text = fs.readFileSync(absFile, "utf8");
    } catch {
      continue;
    }
    const relPath = path.relative(opts.rootDir, absFile) || absFile;
    const result = extractFromSource(text, relPath, functions, components);
    references.push(...result.references);
    hasDynamicKeys = hasDynamicKeys || result.hasDynamicKeys;
  }

  return { references, hasDynamicKeys };
}

interface RawRef {
  key: string;
  line: number;
  useFileNamespace: boolean;
}

export function extractFromSource(
  text: string,
  fileName: string,
  functions: Set<string>,
  components: Set<string>,
): KeyReferenceResult {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, scriptKindFor(fileName));
  const raw: RawRef[] = [];
  let fileNamespace: string | undefined;
  let hasDynamicKeys = false;

  const lineOf = (node: ts.Node): number =>
    sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = calleeName(node.expression, sf);
      if (callee && NAMESPACE_SETTERS.has(callee.name)) {
        const ns = stringArg(node.arguments[0]);
        if (ns && fileNamespace === undefined) fileNamespace = ns;
      } else if (callee && (functions.has(callee.name) || functions.has(callee.full))) {
        const arg = node.arguments[0];
        if (arg && ts.isObjectLiteralExpression(arg)) {
          // formatMessage({ id: '...' })
          const id = objectStringProp(arg, "id");
          if (id !== undefined) raw.push({ key: id, line: lineOf(node), useFileNamespace: false });
          else hasDynamicKeys = true;
        } else {
          const key = stringArg(arg);
          if (key !== undefined) raw.push({ key, line: lineOf(node), useFileNamespace: true });
          else if (arg) hasDynamicKeys = true;
        }
      }
    } else if (ts.isJsxAttribute(node)) {
      const attrName = node.name.getText(sf);
      if (attrName === "id" || attrName === "i18nKey") {
        const tag = enclosingJsxTagName(node);
        if (tag && components.has(tag)) {
          const value = jsxAttrString(node);
          if (value !== undefined) {
            raw.push({ key: value, line: lineOf(node), useFileNamespace: attrName === "i18nKey" });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  const references: KeyReference[] = raw.map((r) => ({
    key: r.key,
    namespace: r.useFileNamespace ? fileNamespace : undefined,
    file: fileName,
    line: r.line,
  }));
  return { references, hasDynamicKeys };
}

function calleeName(expr: ts.Expression, sf: ts.SourceFile): { name: string; full: string } | null {
  if (ts.isIdentifier(expr)) return { name: expr.text, full: expr.text };
  if (ts.isPropertyAccessExpression(expr)) {
    return { name: expr.name.text, full: expr.getText(sf) };
  }
  return null;
}

function stringArg(arg: ts.Expression | undefined): string | undefined {
  if (!arg) return undefined;
  if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) return arg.text;
  return undefined;
}

function objectStringProp(obj: ts.ObjectLiteralExpression, name: string): string | undefined {
  for (const prop of obj.properties) {
    if (ts.isPropertyAssignment(prop) && prop.name.getText() === name) {
      return stringArg(prop.initializer);
    }
  }
  return undefined;
}

function jsxAttrString(node: ts.JsxAttribute): string | undefined {
  const init = node.initializer;
  if (!init) return undefined;
  if (ts.isStringLiteral(init)) return init.text;
  if (ts.isJsxExpression(init) && init.expression && ts.isStringLiteralLike(init.expression)) {
    return init.expression.text;
  }
  return undefined;
}

function enclosingJsxTagName(node: ts.Node): string | undefined {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isJsxOpeningElement(current) || ts.isJsxSelfClosingElement(current)) {
      const tag = current.tagName;
      if (ts.isIdentifier(tag)) return tag.text;
      if (ts.isPropertyAccessExpression(tag)) return tag.name.text;
      return undefined;
    }
    current = current.parent;
  }
  return undefined;
}

function scriptKindFor(fileName: string): ts.ScriptKind {
  switch (path.extname(fileName)) {
    case ".tsx":
      return ts.ScriptKind.TSX;
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".js":
      return ts.ScriptKind.JS;
    case ".ts":
      return ts.ScriptKind.TS;
    default:
      return ts.ScriptKind.TSX;
  }
}
