/**
 * A small recursive-descent JSON parser.
 *
 * `JSON.parse` silently keeps the last value when a key is duplicated and
 * gives no location information. LocaleGuard needs both, so this parser:
 *   - reports the 1-based line/column of syntax errors, and
 *   - records duplicate keys (per object) with their location.
 *
 * It implements the JSON grammar from RFC 8259.
 */

import type { JsonValue } from "../types";

export class JsonParseError extends Error {
  constructor(
    message: string,
    public readonly line: number,
    public readonly column: number,
  ) {
    super(message);
    this.name = "JsonParseError";
  }
}

export interface ParsedJson {
  value: JsonValue;
  /** Flattened key path -> 1-based line where the key is declared. */
  keyLines: Map<string, number>;
  /** Keys that appear more than once within the same object. */
  duplicates: { path: string; line: number }[];
}

const ESCAPES: Record<string, string> = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
};

class Parser {
  private pos = 0;
  private line = 1;
  private col = 1;
  readonly keyLines = new Map<string, number>();
  readonly duplicates: { path: string; line: number }[] = [];

  constructor(private readonly text: string) {}

  parse(): JsonValue {
    this.skipWhitespace();
    const value = this.parseValue("");
    this.skipWhitespace();
    if (this.pos < this.text.length) {
      throw this.error(`Unexpected token ${JSON.stringify(this.peek())}`);
    }
    return value;
  }

  private error(message: string): JsonParseError {
    return new JsonParseError(message, this.line, this.col);
  }

  private peek(): string {
    return this.text[this.pos] ?? "";
  }

  private advance(): string {
    const ch = this.text[this.pos] ?? "";
    this.pos++;
    if (ch === "\n") {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
    return ch;
  }

  private skipWhitespace(): void {
    while (this.pos < this.text.length) {
      const ch = this.peek();
      if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
        this.advance();
      } else {
        break;
      }
    }
  }

  private expect(ch: string): void {
    if (this.peek() !== ch) {
      throw this.error(`Expected ${JSON.stringify(ch)} but found ${JSON.stringify(this.peek() || "<eof>")}`);
    }
    this.advance();
  }

  private parseValue(path: string): JsonValue {
    const ch = this.peek();
    switch (ch) {
      case "{":
        return this.parseObject(path);
      case "[":
        return this.parseArray(path);
      case '"':
        return this.parseString();
      case "t":
      case "f":
        return this.parseBoolean();
      case "n":
        return this.parseNull();
      default:
        if (ch === "-" || (ch >= "0" && ch <= "9")) {
          return this.parseNumber();
        }
        throw this.error(`Unexpected token ${JSON.stringify(ch || "<eof>")}`);
    }
  }

  private parseObject(path: string): JsonValue {
    this.expect("{");
    const obj: { [key: string]: JsonValue } = {};
    const seen = new Set<string>();
    this.skipWhitespace();
    if (this.peek() === "}") {
      this.advance();
      return obj;
    }
    for (;;) {
      this.skipWhitespace();
      if (this.peek() !== '"') {
        throw this.error("Expected string key in object");
      }
      const keyLine = this.line;
      const key = this.parseString();
      const childPath = path ? `${path}.${key}` : key;
      this.skipWhitespace();
      this.expect(":");
      this.skipWhitespace();
      const value = this.parseValue(childPath);
      if (seen.has(key)) {
        this.duplicates.push({ path: childPath, line: keyLine });
      } else {
        seen.add(key);
      }
      this.keyLines.set(childPath, keyLine);
      obj[key] = value;
      this.skipWhitespace();
      const next = this.peek();
      if (next === ",") {
        this.advance();
        continue;
      }
      if (next === "}") {
        this.advance();
        return obj;
      }
      throw this.error(`Expected ',' or '}' but found ${JSON.stringify(next || "<eof>")}`);
    }
  }

  private parseArray(path: string): JsonValue {
    this.expect("[");
    const arr: JsonValue[] = [];
    this.skipWhitespace();
    if (this.peek() === "]") {
      this.advance();
      return arr;
    }
    for (let index = 0; ; index++) {
      this.skipWhitespace();
      const childPath = path ? `${path}.${index}` : String(index);
      const value = this.parseValue(childPath);
      this.keyLines.set(childPath, this.line);
      arr.push(value);
      this.skipWhitespace();
      const next = this.peek();
      if (next === ",") {
        this.advance();
        continue;
      }
      if (next === "]") {
        this.advance();
        return arr;
      }
      throw this.error(`Expected ',' or ']' but found ${JSON.stringify(next || "<eof>")}`);
    }
  }

  private parseString(): string {
    this.expect('"');
    let out = "";
    for (;;) {
      const ch = this.advance();
      if (ch === "") {
        throw this.error("Unterminated string");
      }
      if (ch === '"') {
        return out;
      }
      if (ch === "\\") {
        const esc = this.advance();
        if (esc === "u") {
          let hex = "";
          for (let i = 0; i < 4; i++) {
            const h = this.advance();
            if (!/[0-9a-fA-F]/.test(h)) {
              throw this.error("Invalid unicode escape");
            }
            hex += h;
          }
          out += String.fromCharCode(parseInt(hex, 16));
        } else if (esc in ESCAPES) {
          out += ESCAPES[esc];
        } else {
          throw this.error(`Invalid escape \\${esc}`);
        }
      } else if (ch.charCodeAt(0) < 0x20) {
        throw this.error("Control character in string");
      } else {
        out += ch;
      }
    }
  }

  private parseNumber(): number {
    const start = this.pos;
    if (this.peek() === "-") this.advance();
    while (/[0-9]/.test(this.peek())) this.advance();
    if (this.peek() === ".") {
      this.advance();
      while (/[0-9]/.test(this.peek())) this.advance();
    }
    if (this.peek() === "e" || this.peek() === "E") {
      this.advance();
      if (this.peek() === "+" || this.peek() === "-") this.advance();
      while (/[0-9]/.test(this.peek())) this.advance();
    }
    const raw = this.text.slice(start, this.pos);
    const num = Number(raw);
    if (Number.isNaN(num)) {
      throw this.error(`Invalid number ${JSON.stringify(raw)}`);
    }
    return num;
  }

  private parseKeyword(word: string): void {
    for (const expected of word) {
      if (this.advance() !== expected) {
        throw this.error(`Invalid literal, expected ${JSON.stringify(word)}`);
      }
    }
  }

  private parseBoolean(): boolean {
    if (this.peek() === "t") {
      this.parseKeyword("true");
      return true;
    }
    this.parseKeyword("false");
    return false;
  }

  private parseNull(): null {
    this.parseKeyword("null");
    return null;
  }
}

export function parseJson(text: string): ParsedJson {
  const parser = new Parser(text);
  const value = parser.parse();
  return { value, keyLines: parser.keyLines, duplicates: parser.duplicates };
}
