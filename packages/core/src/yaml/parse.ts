/**
 * A minimal YAML parser for the subset used by locale files: indentation-based
 * nested mappings, scalar values, comments, and simple scalar lists. It returns
 * the same shape as the JSON parser (value + key lines + duplicates) so the
 * locale loader can treat YAML and JSON the same way.
 *
 * Not supported (uncommon in locale files): anchors/aliases, block scalars
 * (`|`, `>`), flow style (`{}`, `[]`), and multi-document streams.
 */

import type { JsonValue } from "../types";

export class YamlParseError extends Error {
  constructor(
    message: string,
    public readonly line: number,
  ) {
    super(message);
    this.name = "YamlParseError";
  }
}

export interface ParsedYaml {
  value: JsonValue;
  keyLines: Map<string, number>;
  duplicates: { path: string; line: number }[];
}

interface Frame {
  indent: number;
  node: Record<string, JsonValue> | JsonValue[] | null;
  parent: Record<string, JsonValue> | JsonValue[] | null;
  attach: string | number | null;
  path: string;
  seen: Set<string>;
  nextIndex: number;
}

export function parseYaml(text: string): ParsedYaml {
  const keyLines = new Map<string, number>();
  const duplicates: { path: string; line: number }[] = [];
  const root: Record<string, JsonValue> = {};
  const stack: Frame[] = [
    { indent: -1, node: root, parent: null, attach: null, path: "", seen: new Set(), nextIndex: 0 },
  ];

  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const rawLine = stripComment(lines[i] ?? "");
    if (rawLine.trim() === "") continue;
    if (rawLine.startsWith("\t")) throw new YamlParseError("Tabs are not allowed in indentation", lineNo);

    const indent = rawLine.length - rawLine.trimStart().length;
    const content = rawLine.trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1]!.indent) {
      const popped = stack.pop()!;
      if (popped.node === null && popped.parent !== null && popped.attach !== null) {
        (popped.parent as Record<string, JsonValue>)[popped.attach as string] = null;
      }
    }
    const frame = stack[stack.length - 1]!;

    if (content.startsWith("- ")) {
      const arr = materialize(frame, true) as JsonValue[];
      const index = frame.nextIndex++;
      arr.push(parseScalar(content.slice(2).trim()));
      keyLines.set(frame.path ? `${frame.path}.${index}` : String(index), lineNo);
      continue;
    }

    const match = /^("(?:[^"]|\\.)*"|'[^']*'|[^:]+?)\s*:(?:\s+(.*))?$/.exec(content);
    if (!match) throw new YamlParseError("Invalid YAML line", lineNo);
    const key = unquote(match[1]!.trim());
    const rest = match[2]?.trim() ?? "";
    const map = materialize(frame, false) as Record<string, JsonValue>;
    const fullPath = frame.path ? `${frame.path}.${key}` : key;

    if (frame.seen.has(key)) duplicates.push({ path: fullPath, line: lineNo });
    else frame.seen.add(key);
    keyLines.set(fullPath, lineNo);

    if (rest === "") {
      stack.push({
        indent,
        node: null,
        parent: map,
        attach: key,
        path: fullPath,
        seen: new Set(),
        nextIndex: 0,
      });
    } else {
      map[key] = parseScalar(rest);
    }
  }

  // Materialize any trailing deferred frames as null.
  for (let i = 1; i < stack.length; i++) {
    const f = stack[i]!;
    if (f.node === null && f.parent !== null && f.attach !== null) {
      (f.parent as Record<string, JsonValue>)[f.attach as string] = null;
    }
  }

  return { value: root, keyLines, duplicates };
}

function materialize(frame: Frame, asArray: boolean): Record<string, JsonValue> | JsonValue[] {
  if (frame.node === null) {
    frame.node = asArray ? [] : {};
    if (frame.parent !== null && frame.attach !== null) {
      (frame.parent as Record<string, JsonValue>)[frame.attach as string] = frame.node;
    }
  }
  return frame.node;
}

function parseScalar(text: string): JsonValue {
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    try {
      return JSON.parse(text) as JsonValue;
    } catch {
      return text.slice(1, -1);
    }
  }
  if (text.length >= 2 && text.startsWith("'") && text.endsWith("'")) {
    return text.slice(1, -1).replace(/''/g, "'");
  }
  if (text === "true") return true;
  if (text === "false") return false;
  if (text === "null" || text === "~") return null;
  if (/^-?\d+$/.test(text)) return Number(text);
  if (/^-?\d*\.\d+$/.test(text)) return Number(text);
  return text;
}

function unquote(text: string): string {
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    try {
      return JSON.parse(text) as string;
    } catch {
      return text.slice(1, -1);
    }
  }
  if (text.length >= 2 && text.startsWith("'") && text.endsWith("'")) {
    return text.slice(1, -1).replace(/''/g, "'");
  }
  return text;
}

function stripComment(line: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === "#" && !inSingle && !inDouble && (i === 0 || line[i - 1] === " " || line[i - 1] === "\t")) {
      return line.slice(0, i);
    }
  }
  return line;
}
