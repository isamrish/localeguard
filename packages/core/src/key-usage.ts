/**
 * Compare translation-key references found in source code against the source
 * locale's keys.
 *
 *   - `undefined-key`: a literal key used in code that is missing from the
 *     source locale (a real defect — it renders the raw key).
 *   - `unused-key`: a key defined in the locale but never referenced in code
 *     (opt-in; skipped when dynamic key usage is detected, since those keys
 *     cannot be resolved statically).
 *
 * Matching is deliberately conservative to keep false positives low — see
 * `matchKey` for how namespaces (next-intl `useTranslations`, react-i18next
 * `ns:key`, and default-namespace directory layouts) are resolved.
 */

import { SEVERITY_BY_TYPE } from "./types";
import type { Issue, KeyReference, LocaleEntry } from "./types";

export interface KeyUsageOptions {
  /** Report keys defined in the locale but never referenced. */
  unusedKeys?: boolean;
  /** True when at least one dynamic (non-literal) key usage was seen. */
  hasDynamicKeys?: boolean;
}

export function checkKeyUsage(
  sourceEntries: Map<string, LocaleEntry>,
  references: KeyReference[],
  options: KeyUsageOptions = {},
): Issue[] {
  const issues: Issue[] = [];
  const sourceKeys = new Set(sourceEntries.keys());

  // Map of the part after a "namespace:" prefix back to the full key, so a bare
  // reference can resolve to a namespaced key without knowing the namespace.
  const bySuffix = new Map<string, string>();
  for (const key of sourceKeys) {
    const colon = key.indexOf(":");
    if (colon !== -1) bySuffix.set(key.slice(colon + 1), key);
  }

  const referenced = new Set<string>();

  for (const ref of references) {
    const matched = matchKey(ref, sourceKeys, bySuffix);
    if (matched) {
      referenced.add(matched);
      continue;
    }
    if (!isSpecific(ref)) continue; // too ambiguous to flag safely

    const resolved = ref.namespace ? `${ref.namespace}.${ref.key}` : ref.key;
    issues.push({
      type: "undefined-key",
      severity: SEVERITY_BY_TYPE["undefined-key"],
      key: resolved,
      file: ref.file,
      line: ref.line,
      message: `Translation key "${resolved}" is used in code but not defined in the source locale.`,
      suggestion: "Add the key to the source locale, or fix the typo in the code.",
    });
  }

  // Unused keys: opt-in, and only meaningful when we actually collected
  // references and saw no dynamic usage that could hide a key.
  if (options.unusedKeys && !options.hasDynamicKeys && references.length > 0) {
    for (const [key, entry] of sourceEntries) {
      if (referenced.has(key)) continue;
      issues.push({
        type: "unused-key",
        severity: SEVERITY_BY_TYPE["unused-key"],
        key,
        file: entry.file,
        line: entry.line,
        message: `Key "${key}" is defined in the source locale but never referenced in code.`,
        suggestion: "Remove it if it is dead, or confirm it is used via a dynamic key.",
      });
    }
  }

  return issues;
}

function matchKey(
  ref: KeyReference,
  sourceKeys: Set<string>,
  bySuffix: Map<string, string>,
): string | null {
  const candidates = [ref.key];
  if (ref.namespace) {
    candidates.push(`${ref.namespace}.${ref.key}`, `${ref.namespace}:${ref.key}`);
  }
  for (const candidate of candidates) {
    if (sourceKeys.has(candidate)) return candidate;
  }
  // Default/unspecified namespace: match a "namespace:key" entry by its key part.
  return bySuffix.get(ref.key) ?? null;
}

/** Only flag references specific enough to be confident about (avoid noise). */
function isSpecific(ref: KeyReference): boolean {
  return ref.key.includes(".") || ref.key.includes(":") || ref.namespace != null;
}
