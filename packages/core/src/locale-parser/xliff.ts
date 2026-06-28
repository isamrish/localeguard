/**
 * A pragmatic, dependency-free parser for Angular's XLIFF translation files
 * (`@angular/localize` output), supporting XLIFF 1.2 (`<trans-unit>`) and
 * 2.0 (`<unit>`).
 *
 * Each unit is reduced to an `id` plus a normalized text in which placeholder
 * elements (`<x>`, `<ph>`) become `{id}` tokens. That lets the same
 * interpolation comparison used for JSON locales work on XLIFF too.
 */

export interface XliffUnit {
  id: string;
  source: string;
  target?: string;
  /** 1-based line of the unit's opening tag. */
  line: number;
}

export interface ParsedXliff {
  version: "1.2" | "2.0" | "unknown";
  units: XliffUnit[];
  duplicates: { id: string; line: number }[];
}

export function parseXliff(text: string): ParsedXliff {
  const versionMatch = /<xliff\b[^>]*\bversion="([^"]+)"/.exec(text);
  const version: ParsedXliff["version"] = versionMatch
    ? versionMatch[1]!.startsWith("2")
      ? "2.0"
      : "1.2"
    : "unknown";
  const unitTag = version === "2.0" ? "unit" : "trans-unit";

  const units: XliffUnit[] = [];
  const duplicates: { id: string; line: number }[] = [];
  const seen = new Set<string>();

  const openRe = new RegExp(`<${unitTag}\\b[^>]*?>`, "g");
  const closeStr = `</${unitTag}>`;
  let match: RegExpExecArray | null;

  while ((match = openRe.exec(text)) !== null) {
    const openTag = match[0];
    if (openTag.endsWith("/>")) continue; // empty unit
    const idMatch = /\bid="([^"]*)"/.exec(openTag);
    if (!idMatch) continue;
    const id = decodeEntities(idMatch[1]!);

    const contentStart = openRe.lastIndex;
    // trans-unit / unit elements do not nest, so the next close tag ends it.
    const closeIdx = text.indexOf(closeStr, contentStart);
    const end = closeIdx === -1 ? text.length : closeIdx;
    const inner = text.slice(contentStart, end);

    const source = extractTag(inner, "source");
    const target = extractTag(inner, "target");
    const line = lineAt(text, match.index);

    if (seen.has(id)) duplicates.push({ id, line });
    else seen.add(id);

    units.push({
      id,
      source: source === undefined ? "" : normalize(source),
      target: target === undefined ? undefined : normalize(target),
      line,
    });

    openRe.lastIndex = closeIdx === -1 ? text.length : end + closeStr.length;
  }

  return { version, units, duplicates };
}

function extractTag(inner: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = re.exec(inner);
  if (m) return m[1];
  // Self-closing (e.g. empty <target/>).
  if (new RegExp(`<${tag}\\b[^>]*/>`, "i").test(inner)) return "";
  return undefined;
}

function normalize(content: string): string {
  return decodeEntities(
    content
      // Placeholder elements -> {id}.
      .replace(/<x\b[^>]*\bid="([^"]*)"[^>]*\/?>/gi, (_m, id: string) => `{${id}}`)
      .replace(/<ph\b[^>]*\bid="([^"]*)"[^>]*>[\s\S]*?<\/ph>/gi, (_m, id: string) => `{${id}}`)
      .replace(/<ph\b[^>]*\bid="([^"]*)"[^>]*\/>/gi, (_m, id: string) => `{${id}}`)
      // Strip remaining inline structural tags (pc, g, mrk, ...), keep their text.
      .replace(/<[^>]+>/g, ""),
  ).trim();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&");
}

function lineAt(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === "\n") line += 1;
  }
  return line;
}
