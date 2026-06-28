/**
 * Flatten a parsed JSON locale tree into a map of leaf keys.
 *
 * Keys are joined with "." so they line up with the paths produced by the
 * JSON parser (see `json/parse.ts`). Only leaves (primitives) are emitted;
 * objects and arrays are recursed into.
 */

import type { JsonPrimitive, JsonValue } from "./types";

export interface FlattenOptions {
  /**
   * Treat FormatJS/react-intl message descriptors — objects with a string
   * `defaultMessage` — as message leaves (key = path, value = `defaultMessage`)
   * rather than recursing into them.
   */
  messageDescriptors?: boolean;
}

export function flatten(value: JsonValue, options: FlattenOptions = {}): Map<string, JsonPrimitive> {
  const out = new Map<string, JsonPrimitive>();
  walk(value, "", out, options);
  return out;
}

function walk(
  value: JsonValue,
  path: string,
  out: Map<string, JsonPrimitive>,
  options: FlattenOptions,
): void {
  if (value !== null && typeof value === "object") {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        walk(item, path ? `${path}.${index}` : String(index), out, options);
      });
      return;
    }
    if (options.messageDescriptors && typeof (value as Record<string, JsonValue>).defaultMessage === "string") {
      out.set(path, (value as Record<string, JsonValue>).defaultMessage as string);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      walk(child, path ? `${path}.${key}` : key, out, options);
    }
    return;
  }
  // Leaf: string, number, boolean, or null.
  out.set(path, value);
}
