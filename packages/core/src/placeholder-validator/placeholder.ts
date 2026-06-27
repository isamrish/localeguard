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

export function extractPlaceholders(value: JsonPrimitive): Set<string> {
  const names = new Set<string>();
  if (typeof value !== "string") {
    return names;
  }
  const cleaned = value.replace(DOUBLE_BRACE, (_match, name: string) => {
    names.add(name);
    return " ";
  });
  for (const match of cleaned.matchAll(SINGLE_BRACE)) {
    names.add(match[1] as string);
  }
  return names;
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
