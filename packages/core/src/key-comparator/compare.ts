/**
 * Compare the key sets of two locales.
 */

export interface KeyDiff {
  /** Keys present in the source but absent from the target. */
  missing: string[];
  /** Keys present in the target but absent from the source. */
  extra: string[];
  /** Keys present in both (candidates for placeholder validation). */
  shared: string[];
}

export function compareKeys(sourceKeys: Iterable<string>, targetKeys: Iterable<string>): KeyDiff {
  const source = sourceKeys instanceof Set ? sourceKeys : new Set(sourceKeys);
  const target = targetKeys instanceof Set ? targetKeys : new Set(targetKeys);

  const missing: string[] = [];
  const shared: string[] = [];
  for (const key of source) {
    if (target.has(key)) {
      shared.push(key);
    } else {
      missing.push(key);
    }
  }

  const extra: string[] = [];
  for (const key of target) {
    if (!source.has(key)) {
      extra.push(key);
    }
  }

  missing.sort();
  extra.sort();
  shared.sort();
  return { missing, extra, shared };
}
