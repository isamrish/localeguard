/**
 * Flatten a parsed JSON locale tree into a map of leaf keys.
 *
 * Keys are joined with "." so they line up with the paths produced by the
 * JSON parser (see `json/parse.ts`). Only leaves (primitives) are emitted;
 * objects and arrays are recursed into.
 */

import type { JsonPrimitive, JsonValue } from "./types";

export function flatten(value: JsonValue, prefix = ""): Map<string, JsonPrimitive> {
  const out = new Map<string, JsonPrimitive>();
  walk(value, prefix, out);
  return out;
}

function walk(value: JsonValue, path: string, out: Map<string, JsonPrimitive>): void {
  if (value !== null && typeof value === "object") {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        walk(item, path ? `${path}.${index}` : String(index), out);
      });
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      walk(child, path ? `${path}.${key}` : key, out);
    }
    return;
  }
  // Leaf: string, number, boolean, or null.
  out.set(path, value);
}
