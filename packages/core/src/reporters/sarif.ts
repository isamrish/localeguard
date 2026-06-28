/**
 * SARIF 2.1.0 reporter — for GitHub code scanning, which renders results as
 * inline annotations on the pull-request diff.
 *
 * Spec: https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html
 */

import { ISSUE_TYPES } from "../types";
import type { CheckResult, Issue, IssueType } from "../types";

export interface SarifReporterOptions {
  toolVersion?: string;
}

const RULE_DESCRIPTIONS: Record<IssueType, string> = {
  "invalid-json": "Locale file is not valid JSON.",
  "missing-key": "A key in the source locale is missing from a target locale.",
  "extra-key": "A key exists in a target locale but not in the source locale.",
  "duplicate-key": "A key is declared more than once within a file.",
  "placeholder-mismatch": "Interpolation variables differ between source and target.",
  "hardcoded-string": "Hardcoded, user-facing JSX text that should be localized.",
  "hardcoded-attribute": "Hardcoded localizable attribute value (aria-label, title, alt, placeholder).",
};

function sarifLevel(issue: Issue): "error" | "warning" {
  return issue.severity === "error" ? "error" : "warning";
}

export function formatSarif(result: CheckResult, opts: SarifReporterOptions = {}): string {
  const rules = ISSUE_TYPES.map((id) => ({
    id,
    name: toPascalCase(id),
    shortDescription: { text: RULE_DESCRIPTIONS[id] },
    defaultConfiguration: { level: id === "extra-key" ? "warning" : "error" },
  }));

  const results = result.issues.map((issue) => ({
    ruleId: issue.type,
    level: sarifLevel(issue),
    message: { text: issue.message },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: toUri(issue.file) },
          region: { startLine: Math.max(1, issue.line ?? 1) },
        },
      },
    ],
  }));

  const sarif = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "LocaleGuard",
            informationUri: "https://github.com/isamrish/localeguard",
            version: opts.toolVersion ?? "0.1.0",
            rules,
          },
        },
        results,
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}

function toUri(file: string): string {
  return file.split("\\").join("/");
}

function toPascalCase(id: string): string {
  return id
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
