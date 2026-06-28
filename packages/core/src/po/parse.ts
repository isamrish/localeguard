/**
 * A small parser for gettext PO files. Each entry has a `msgid` (the source
 * string, used as the key) and a `msgstr` (the translation). `msgctxt` adds a
 * context that disambiguates the key. Multi-line strings (continuation lines)
 * and the standard escapes are supported.
 *
 * Interpolation in PO varies by project; LocaleGuard recognizes `{name}` /
 * `{{name}}` style placeholders (not printf `%s` / `%(name)s`).
 */

export interface PoEntry {
  context?: string;
  msgid: string;
  msgstr: string;
  /** 1-based line of the entry's msgid. */
  line: number;
}

export interface ParsedPo {
  entries: PoEntry[];
  duplicates: { key: string; line: number }[];
}

export function poKey(entry: { context?: string; msgid: string }): string {
  return entry.context ? `${entry.context}|${entry.msgid}` : entry.msgid;
}

export function parsePo(text: string): ParsedPo {
  const entries: PoEntry[] = [];
  const lines = text.split("\n");

  let current: Partial<PoEntry> & { line: number } = { line: 0 };
  let started = false;
  let field: "msgctxt" | "msgid" | "msgstr" | "other" | null = null;

  const flush = (): void => {
    if (started && current.msgid !== undefined) {
      entries.push({
        context: current.context,
        msgid: current.msgid,
        msgstr: current.msgstr ?? "",
        line: current.line,
      });
    }
    current = { line: 0 };
    started = false;
    field = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const trimmed = (lines[i] ?? "").trim();
    if (trimmed === "") {
      flush();
      continue;
    }
    if (trimmed.startsWith("#")) continue;

    if (trimmed.startsWith('"')) {
      const piece = unescape(quoted(trimmed));
      if (field === "msgid") current.msgid = (current.msgid ?? "") + piece;
      else if (field === "msgstr") current.msgstr = (current.msgstr ?? "") + piece;
      else if (field === "msgctxt") current.context = (current.context ?? "") + piece;
      continue;
    }

    const match = /^(msgctxt|msgid_plural|msgid|msgstr(?:\[\d+\])?)\s+(.*)$/.exec(trimmed);
    if (!match) continue;
    const keyword = match[1]!;
    const value = unescape(quoted(match[2]!));
    started = true;

    if (keyword === "msgctxt") {
      current.context = value;
      field = "msgctxt";
    } else if (keyword === "msgid") {
      current.msgid = value;
      current.line = lineNo;
      field = "msgid";
    } else if (keyword === "msgid_plural") {
      field = "other";
    } else if (keyword === "msgstr" || keyword === "msgstr[0]") {
      current.msgstr = value;
      field = "msgstr";
    } else {
      field = "other"; // msgstr[1], msgstr[2], ...
    }
  }
  flush();

  // Drop the header entry (msgid "").
  const real = entries.filter((e) => e.msgid !== "");

  const duplicates: { key: string; line: number }[] = [];
  const seen = new Set<string>();
  for (const entry of real) {
    const key = poKey(entry);
    if (seen.has(key)) duplicates.push({ key, line: entry.line });
    else seen.add(key);
  }

  return { entries: real, duplicates };
}

function quoted(text: string): string {
  const m = /^"((?:[^"\\]|\\.)*)"/.exec(text);
  return m ? m[1]! : "";
}

function unescape(text: string): string {
  return text.replace(/\\(.)/g, (_m, ch: string) => {
    switch (ch) {
      case "n":
        return "\n";
      case "t":
        return "\t";
      case "r":
        return "\r";
      default:
        return ch; // \" \\ etc.
    }
  });
}
