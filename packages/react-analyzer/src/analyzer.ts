/**
 * Detect hardcoded, user-facing strings in React/TypeScript source using the
 * TypeScript compiler API.
 *
 * Two categories are reported:
 *   - `hardcoded-string`    — literal JSX text, e.g. `<Button>Create</Button>`
 *   - `hardcoded-attribute` — literal `aria-label`/`title`/`alt`/`placeholder`,
 *                             e.g. `<button aria-label="Close dialog">`
 *
 * Design goal: a low false-positive rate. We only flag *literal* values; any
 * value that is already an expression (`{t('...')}`, `{label}`) is left alone,
 * and text inside configured translation components (e.g. `<Trans>`) is ignored.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import ts from "typescript";

import { SEVERITY_BY_TYPE } from "@localeguard/core";
import type { Issue } from "@localeguard/core";

import { findFiles } from "./glob";

export const DEFAULT_INCLUDE = ["src/**/*.{ts,tsx}"];
export const DEFAULT_TRANSLATION_COMPONENTS = ["Trans"];

/** Only these extensions are parsed as React/TypeScript source. */
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"]);

/** Accessibility / UX attributes whose values reach end users. */
const LOCALIZABLE_ATTRS = new Set(["aria-label", "title", "alt", "placeholder"]);

/** Elements whose text is technical, not prose — never flagged. */
const NON_LOCALIZABLE_ELEMENTS = new Set([
  "code",
  "pre",
  "kbd",
  "samp",
  "var",
  "tt",
  "script",
  "style",
]);

const HAS_LETTER = /\p{L}/u;
const HTML_ENTITY = /&[a-zA-Z]+;|&#\d+;/g;

export interface AnalyzerConfig {
  include?: string[];
  ignore?: string[];
  translationComponents?: string[];
}

export interface AnalyzeOptions {
  /** Absolute project root; reported file paths are relative to this. */
  rootDir: string;
}

export function analyzeProject(config: AnalyzerConfig, opts: AnalyzeOptions): Issue[] {
  const include = config.include ?? DEFAULT_INCLUDE;
  const translationComponents = new Set(
    config.translationComponents ?? DEFAULT_TRANSLATION_COMPONENTS,
  );
  const files = findFiles({ rootDir: opts.rootDir, include, ignore: config.ignore });

  const issues: Issue[] = [];
  for (const absFile of files) {
    // Only parse JS/TS sources — never .vue/.html (those go to the template
    // analyzer), even when an `include` glob happens to match them.
    if (!SOURCE_EXTENSIONS.has(path.extname(absFile).toLowerCase())) continue;
    let text: string;
    try {
      text = fs.readFileSync(absFile, "utf8");
    } catch {
      continue;
    }
    const relPath = path.relative(opts.rootDir, absFile) || absFile;
    analyzeSource(text, relPath, translationComponents, issues);
  }
  return issues;
}

/** Analyze a single source string. Exported for testing. */
export function analyzeSource(
  text: string,
  fileName: string,
  translationComponents: Set<string>,
  issues: Issue[] = [],
): Issue[] {
  const sf = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    scriptKindFor(fileName),
  );

  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      checkJsxText(node, sf, fileName, translationComponents, issues);
    } else if (ts.isJsxAttribute(node)) {
      checkJsxAttribute(node, sf, fileName, issues);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return issues;
}

function checkJsxText(
  node: ts.JsxText,
  sf: ts.SourceFile,
  fileName: string,
  translationComponents: Set<string>,
  issues: Issue[],
): void {
  const raw = node.getText(sf);
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (!isLocalizableText(collapsed)) return;
  if (isInsideSkippedElement(node, translationComponents)) return;

  const leading = raw.length - raw.replace(/^\s+/, "").length;
  const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf) + leading);
  issues.push({
    type: "hardcoded-string",
    severity: SEVERITY_BY_TYPE["hardcoded-string"],
    file: fileName,
    line: line + 1,
    message: `Hardcoded JSX text: ${quote(collapsed)}`,
    suggestion: "Wrap user-facing text in a translation call, e.g. {t('...')}.",
  });
}

function checkJsxAttribute(
  node: ts.JsxAttribute,
  sf: ts.SourceFile,
  fileName: string,
  issues: Issue[],
): void {
  const name = node.name.getText(sf);
  if (!LOCALIZABLE_ATTRS.has(name)) return;

  const value = literalValueOf(node.initializer);
  if (value === undefined) return; // expression or no value — already dynamic
  if (!HAS_LETTER.test(value)) return; // empty or non-text (e.g. alt="")

  const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  issues.push({
    type: "hardcoded-attribute",
    severity: SEVERITY_BY_TYPE["hardcoded-attribute"],
    file: fileName,
    line: line + 1,
    message: `Hardcoded ${name} value: ${quote(value)}`,
    suggestion: `Localize the ${name} attribute, e.g. ${name}={t('...')}.`,
  });
}

/** Returns the literal text of an attribute value, or undefined if dynamic. */
function literalValueOf(init: ts.JsxAttribute["initializer"]): string | undefined {
  if (!init) return undefined;
  if (ts.isStringLiteral(init)) return init.text;
  // `attr={"literal"}` is still hardcoded; `attr={expr}` is not.
  if (ts.isJsxExpression(init) && init.expression && ts.isStringLiteralLike(init.expression)) {
    return init.expression.text;
  }
  return undefined;
}

/**
 * True when the node is inside a translation component (e.g. `<Trans>`, whose
 * text is intentional) or a technical element (e.g. `<code>`, whose text is not
 * prose). Either way the text should not be flagged.
 */
function isInsideSkippedElement(node: ts.Node, components: Set<string>): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isJsxElement(current)) {
      const name = jsxTagName(current.openingElement.tagName);
      if (name && (components.has(name) || NON_LOCALIZABLE_ELEMENTS.has(name))) {
        return true;
      }
    }
    current = current.parent;
  }
  return false;
}

function jsxTagName(tag: ts.JsxTagNameExpression): string | undefined {
  if (ts.isIdentifier(tag)) return tag.text;
  if (ts.isPropertyAccessExpression(tag)) return tag.name.text;
  return undefined;
}

function isLocalizableText(collapsed: string): boolean {
  if (collapsed.length === 0) return false;
  return HAS_LETTER.test(collapsed.replace(HTML_ENTITY, ""));
}

function quote(value: string): string {
  const max = 50;
  const truncated = value.length > max ? `${value.slice(0, max - 1)}…` : value;
  return JSON.stringify(truncated);
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
