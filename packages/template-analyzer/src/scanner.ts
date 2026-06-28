/**
 * A small, dependency-free scanner for HTML-style templates (Vue `<template>`
 * blocks and Angular component templates). It flags hardcoded, user-facing text
 * while staying conservative to keep false positives low:
 *
 *   - `{{ … }}` interpolation is dynamic and ignored.
 *   - Bound attributes (`:title`, `[title]`, `v-bind:title`) are ignored.
 *   - Text inside translation components (`<i18n-t>`), Angular `i18n`-marked
 *     elements, `translate`/`v-t` directives, and technical/raw elements
 *     (`script`, `style`, `code`, `pre`, …) is ignored.
 *
 * This is a pragmatic tokenizer, not a spec-complete HTML parser.
 */

import { SEVERITY_BY_TYPE } from "@localeguard/core";
import type { Issue } from "@localeguard/core";

export type TemplateMode = "vue" | "angular";

export interface ScanOptions {
  mode: TemplateMode;
  fileName: string;
  /** 1-based line of the first character of `source` within the real file. */
  startLine?: number;
  /** Extra element names whose text should be treated as already-translated. */
  translationComponents?: string[];
}

const LOCALIZABLE_ATTRS = new Set(["aria-label", "title", "alt", "placeholder"]);

/** Text inside these elements is technical or raw, never prose. */
const NON_LOCALIZABLE_ELEMENTS = new Set([
  "script",
  "style",
  "code",
  "pre",
  "kbd",
  "samp",
  "var",
  "textarea",
]);

/** Elements parsed as raw text (their contents are not markup). */
const RAW_TEXT_ELEMENTS = new Set(["script", "style"]);

const HAS_LETTER = /\p{L}/u;
const HTML_ENTITY = /&[a-zA-Z]+;|&#\d+;/g;
const INTERPOLATION = /\{\{[\s\S]*?\}\}/g;

interface Attr {
  name: string;
  value?: string;
}

interface StackEntry {
  name: string;
  /** True when text within this element (and descendants) must be skipped. */
  skipText: boolean;
}

export function scanTemplate(source: string, options: ScanOptions): Issue[] {
  const issues: Issue[] = [];
  const translationComponents = new Set(
    (options.translationComponents ?? []).map((c) => c.toLowerCase()),
  );
  const stack: StackEntry[] = [];
  let pos = 0;
  let line = options.startLine ?? 1;

  const advanceTo = (next: number): void => {
    for (let i = pos; i < next; i++) {
      if (source[i] === "\n") line += 1;
    }
    pos = next;
  };

  const skipping = (): boolean => stack.length > 0 && stack[stack.length - 1]!.skipText;

  while (pos < source.length) {
    const lt = source.indexOf("<", pos);

    // Trailing text after the last tag.
    if (lt === -1) {
      maybeText(source.slice(pos), line, skipping(), options, issues);
      break;
    }

    if (lt > pos) {
      const text = source.slice(pos, lt);
      maybeText(text, line, skipping(), options, issues);
      advanceTo(lt);
    }

    // Comment.
    if (source.startsWith("<!--", pos)) {
      const end = source.indexOf("-->", pos + 4);
      advanceTo(end === -1 ? source.length : end + 3);
      continue;
    }

    // Closing tag.
    if (source.startsWith("</", pos)) {
      const gt = source.indexOf(">", pos);
      const name = source.slice(pos + 2, gt === -1 ? source.length : gt).trim().toLowerCase();
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i]!.name === name) {
          stack.length = i;
          break;
        }
      }
      advanceTo(gt === -1 ? source.length : gt + 1);
      continue;
    }

    // Opening tag (or stray '<').
    const gt = findTagEnd(source, pos);
    if (gt === -1) {
      advanceTo(source.length);
      break;
    }
    const raw = source.slice(pos, gt + 1);
    const tagLine = line;
    const parsed = parseTag(raw);
    if (!parsed) {
      advanceTo(gt + 1);
      continue;
    }
    const { name, attrs, selfClosing } = parsed;

    emitAttributeIssues(name, attrs, tagLine, options, issues);

    advanceTo(gt + 1);

    if (RAW_TEXT_ELEMENTS.has(name) && !selfClosing) {
      const close = source.toLowerCase().indexOf(`</${name}`, pos);
      advanceTo(close === -1 ? source.length : close);
      continue;
    }

    if (!selfClosing && !isVoidElement(name)) {
      const parentSkip = skipping();
      stack.push({
        name,
        skipText: parentSkip || elementSkipsText(name, attrs, translationComponents, options.mode),
      });
    }
  }

  return issues;
}

function maybeText(
  rawText: string,
  textLine: number,
  skip: boolean,
  options: ScanOptions,
  issues: Issue[],
): void {
  if (skip) return;
  const withoutInterp = rawText.replace(INTERPOLATION, " ");
  const collapsed = withoutInterp.replace(/\s+/g, " ").trim();
  if (collapsed.length === 0) return;
  if (!HAS_LETTER.test(collapsed.replace(HTML_ENTITY, ""))) return;

  // Line of the first non-whitespace character of the (original) text.
  const leading = rawText.length - rawText.replace(/^\s+/, "").length;
  const line = textLine + countNewlines(rawText.slice(0, leading));

  issues.push({
    type: "hardcoded-string",
    severity: SEVERITY_BY_TYPE["hardcoded-string"],
    file: options.fileName,
    line,
    message: `Hardcoded template text: ${quote(collapsed)}`,
    suggestion: "Move user-facing text into a translation message.",
  });
}

function emitAttributeIssues(
  name: string,
  attrs: Attr[],
  tagLine: number,
  options: ScanOptions,
  issues: Issue[],
): void {
  const attrNames = new Set(attrs.map((a) => a.name.toLowerCase()));
  for (const attr of attrs) {
    const lower = attr.name.toLowerCase();
    if (isBoundAttr(lower)) continue;
    if (!LOCALIZABLE_ATTRS.has(lower)) continue;
    if (attr.value === undefined || !HAS_LETTER.test(attr.value)) continue;
    // Angular: i18n-<attr> marks the attribute as translatable.
    if (options.mode === "angular" && attrNames.has(`i18n-${lower}`)) continue;

    issues.push({
      type: "hardcoded-attribute",
      severity: SEVERITY_BY_TYPE["hardcoded-attribute"],
      file: options.fileName,
      line: tagLine,
      message: `Hardcoded ${lower} value: ${quote(attr.value)}`,
      suggestion: `Localize the ${lower} attribute.`,
    });
  }
}

function elementSkipsText(
  name: string,
  attrs: Attr[],
  translationComponents: Set<string>,
  mode: TemplateMode,
): boolean {
  if (NON_LOCALIZABLE_ELEMENTS.has(name)) return true;
  if (translationComponents.has(name)) return true;

  const attrNames = new Set(attrs.map((a) => a.name.toLowerCase()));
  if (mode === "vue") {
    if (attrNames.has("v-t") || attrNames.has("v-text") || attrNames.has("v-html")) return true;
  } else {
    // Angular: a bare `i18n` attribute marks the element's text as translatable;
    // `translate` is the ngx-translate directive; innerHTML/textContent bindings
    // replace the text dynamically.
    if (attrNames.has("i18n") || attrNames.has("translate")) return true;
    if (attrNames.has("[innerhtml]") || attrNames.has("[textcontent]")) return true;
  }
  return false;
}

function isBoundAttr(name: string): boolean {
  return (
    name.startsWith(":") ||
    name.startsWith("@") ||
    name.startsWith("[") ||
    name.startsWith("(") ||
    name.startsWith("*") ||
    name.startsWith("#") ||
    name.startsWith("v-bind:") ||
    name.startsWith("v-on:") ||
    name.startsWith("bind-") ||
    name.startsWith("on-")
  );
}

function parseTag(raw: string): { name: string; attrs: Attr[]; selfClosing: boolean } | null {
  // raw includes the surrounding < … >
  const inner = raw.slice(1, raw.endsWith("/>") ? -2 : -1).trim();
  const selfClosing = raw.endsWith("/>");
  const nameMatch = /^[a-zA-Z][\w.-]*/.exec(inner);
  if (!nameMatch) return null;
  const name = nameMatch[0].toLowerCase();
  const attrs = parseAttributes(inner.slice(nameMatch[0].length));
  return { name, attrs, selfClosing };
}

function parseAttributes(text: string): Attr[] {
  const attrs: Attr[] = [];
  // Attribute names in Vue/Angular can include : @ [ ] ( ) * # . - _ and letters.
  const re = /([:@#[\]()*.\w-]+)(\s*=\s*("([^"]*)"|'([^']*)'|(\S+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (!m[1]) continue;
    const value = m[4] ?? m[5] ?? m[6];
    attrs.push({ name: m[1], value });
  }
  return attrs;
}

function findTagEnd(source: string, start: number): number {
  // Find the '>' that closes this tag, skipping any inside quoted attribute values.
  let quoteCh: string | null = null;
  for (let i = start + 1; i < source.length; i++) {
    const ch = source[i];
    if (quoteCh) {
      if (ch === quoteCh) quoteCh = null;
    } else if (ch === '"' || ch === "'") {
      quoteCh = ch;
    } else if (ch === ">") {
      return i;
    }
  }
  return -1;
}

const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

function isVoidElement(name: string): boolean {
  return VOID_ELEMENTS.has(name);
}

function countNewlines(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") count += 1;
  }
  return count;
}

function quote(value: string): string {
  const max = 50;
  const truncated = value.length > max ? `${value.slice(0, max - 1)}…` : value;
  return JSON.stringify(truncated);
}
