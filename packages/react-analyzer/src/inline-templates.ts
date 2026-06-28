/**
 * Extract inline Angular component templates — `@Component({ template: `…` })` —
 * from TypeScript source, so the template analyzer can scan them like external
 * `.html` files. `templateUrl` (external) files are handled separately.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import ts from "typescript";

import { findFiles } from "@localeguard/core";

export interface InlineTemplate {
  source: string;
  file: string;
  /** 1-based line in the file where the template content begins. */
  line: number;
}

export interface InlineTemplateConfig {
  include?: string[];
  ignore?: string[];
}

export interface AnalyzeOptions {
  rootDir: string;
}

const TS_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);

export function extractInlineTemplates(
  config: InlineTemplateConfig,
  opts: AnalyzeOptions,
): InlineTemplate[] {
  const include = config.include ?? ["src/**/*.{ts,tsx}"];
  const files = findFiles({ rootDir: opts.rootDir, include, ignore: config.ignore });
  const templates: InlineTemplate[] = [];

  for (const absFile of files) {
    if (!TS_EXTENSIONS.has(path.extname(absFile).toLowerCase())) continue;
    let text: string;
    try {
      text = fs.readFileSync(absFile, "utf8");
    } catch {
      continue;
    }
    const relPath = path.relative(opts.rootDir, absFile) || absFile;
    collect(text, relPath, templates);
  }
  return templates;
}

function collect(text: string, fileName: string, out: InlineTemplate[]): void {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "Component" &&
      node.arguments[0] &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      for (const prop of node.arguments[0].properties) {
        if (
          ts.isPropertyAssignment(prop) &&
          prop.name.getText(sf) === "template" &&
          (ts.isStringLiteral(prop.initializer) ||
            ts.isNoSubstitutionTemplateLiteral(prop.initializer))
        ) {
          const valueNode = prop.initializer;
          // Line of the first character of the string content (after the quote).
          const line = sf.getLineAndCharacterOfPosition(valueNode.getStart(sf) + 1).line + 1;
          out.push({ source: valueNode.text, file: fileName, line });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
