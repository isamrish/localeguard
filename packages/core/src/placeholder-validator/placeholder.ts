/**
 * Interpolation-variable extraction and comparison.
 *
 * Supports the two most common styles:
 *   - i18next double-brace: `{{userName}}`, `{{count, number}}`
 *   - ICU / react-intl single-brace: `{userName}`, `{count, number}`
 *
 * Note: extraction is intentionally a heuristic. For parity checks this is
 * safe — a placeholder that is captured identically in both the source and
 * target value cancels out, so only genuine divergences are reported.
 */

import type { JsonPrimitive } from "../types";

const DOUBLE_BRACE = /\{\{\s*([\w$.\-]+)[\s\S]*?\}\}/g;
const SINGLE_BRACE = /\{\s*([\w$.\-]+)\s*(?:,[^{}]*)?\}/g;
const ICU_HEAD = /^\s*([A-Za-z_]\w*)\s*,\s*(?:plural|select|selectordinal)\b/;

export function extractPlaceholders(value: JsonPrimitive): Set<string> {
  const names = new Set<string>();
  if (typeof value !== "string") {
    return names;
  }

  // Remove ICU plural/select/selectordinal blocks first (matching braces),
  // recording only their argument name. This stops their sub-message bodies —
  // e.g. `{He}` in `{gender, select, male {He} ...}` — from being misread as
  // interpolation variables, which would otherwise be a false positive.
  const withoutIcu = stripIcuBlocks(value, names);

  // i18next double-brace: {{userName}}, {{date, datetime}}.
  const cleaned = withoutIcu.replace(DOUBLE_BRACE, (_match, name: string) => {
    names.add(name);
    return " ";
  });

  // ICU / react-intl single-brace: {userName}, {count, number}, {0}.
  for (const match of cleaned.matchAll(SINGLE_BRACE)) {
    names.add(match[1] as string);
  }
  return names;
}

function stripIcuBlocks(input: string, names: Set<string>): string {
  let out = "";
  let i = 0;
  while (i < input.length) {
    if (input[i] !== "{") {
      out += input[i];
      i += 1;
      continue;
    }
    const end = matchingBrace(input, i);
    if (end === -1) {
      out += input[i];
      i += 1;
      continue;
    }
    const inner = input.slice(i + 1, end);
    const head = ICU_HEAD.exec(inner);
    if (head) {
      names.add(head[1] as string); // record the ICU argument, drop sub-messages
    } else {
      out += input.slice(i, end + 1); // not ICU — leave for brace-based scanning
    }
    i = end + 1;
  }
  return out;
}

/** Index of the `}` matching the `{` at `start`, or -1 if unbalanced. */
function matchingBrace(s: string, start: number): number {
  let depth = 0;
  for (let i = start; i < s.length; i += 1) {
    if (s[i] === "{") depth += 1;
    else if (s[i] === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export interface PlaceholderDiff {
  /** Variables in the source value that are absent from the target. */
  missing: string[];
  /** Variables in the target value that are absent from the source. */
  extra: string[];
}

/**
 * Compare interpolation variables between a source and target value.
 * Returns `null` when the variable sets match.
 */
export function comparePlaceholders(
  sourceValue: JsonPrimitive,
  targetValue: JsonPrimitive,
): PlaceholderDiff | null {
  // Only meaningful when both sides are strings.
  if (typeof sourceValue !== "string" || typeof targetValue !== "string") {
    return null;
  }
  const source = extractPlaceholders(sourceValue);
  const target = extractPlaceholders(targetValue);
  const missing = [...source].filter((name) => !target.has(name)).sort();
  const extra = [...target].filter((name) => !source.has(name)).sort();
  if (missing.length === 0 && extra.length === 0) {
    return null;
  }
  return { missing, extra };
}
