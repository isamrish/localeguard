/**
 * Shared type definitions for LocaleGuard's core checks.
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type IssueSeverity = "error" | "warning";

/**
 * The categories of problems LocaleGuard can detect.
 *   - Locale-file checks: invalid-json, missing-key, extra-key, duplicate-key,
 *     placeholder-mismatch.
 *   - Source-code checks (Phase 2): hardcoded-string, hardcoded-attribute.
 */
export type IssueType =
  | "invalid-json"
  | "missing-key"
  | "extra-key"
  | "duplicate-key"
  | "placeholder-mismatch"
  | "hardcoded-string"
  | "hardcoded-attribute";

/** Every issue type, in display order. */
export const ISSUE_TYPES: IssueType[] = [
  "invalid-json",
  "duplicate-key",
  "missing-key",
  "extra-key",
  "placeholder-mismatch",
  "hardcoded-string",
  "hardcoded-attribute",
];

export interface Issue {
  type: IssueType;
  severity: IssueSeverity;
  /** Target locale the issue concerns (omitted for source-only issues). */
  locale?: string;
  /** Namespace (file basename) when locales are split into multiple files. */
  namespace?: string;
  /** Flattened, dot-delimited key path the issue concerns. */
  key?: string;
  /** Path to the file the issue was found in, relative to the project root. */
  file: string;
  /** 1-based line number within `file`, when known. */
  line?: number;
  message: string;
  /** Actionable remediation hint shown in reports. */
  suggestion?: string;
}

/** Supported framework presets (fill in sensible defaults for other fields). */
export type Framework =
  | "react-i18next"
  | "react-intl"
  | "next-intl"
  | "vue-i18n"
  | "ngx-translate";

/**
 * How values in a locale file are interpreted.
 *   - "plain": leaf strings are messages; nested objects are namespaces.
 *   - "icu-descriptor": FormatJS/react-intl objects with a string `defaultMessage`
 *     are messages (the key is the message id; `defaultMessage` is the string).
 */
export type MessageFormat = "plain" | "icu-descriptor";

export interface LocaleGuardConfig {
  /** Optional framework preset; fills defaults for the fields below. */
  framework?: Framework;
  /** How locale-file values are interpreted (defaults to "plain"). */
  messageFormat?: MessageFormat;
  /** Reference locale every other locale is compared against. */
  sourceLocale: string;
  /** Target locales to validate. */
  locales: string[];
  /** Directory holding locale files, relative to the project root. */
  localesPath: string;
  /** Glob patterns of source files to analyze (defaults to src/**\/*.{ts,tsx}). */
  include?: string[];
  /** Translation function names, e.g. "t", "i18n.t" (used by code analysis). */
  translationFunctions?: string[];
  /** Translation component names, e.g. "Trans" (text inside is not flagged). */
  translationComponents?: string[];
  /** Glob patterns to exclude from code analysis. */
  ignore?: string[];
  /** Issue types that should fail the check (non-zero exit). */
  blockOn?: IssueType[];
}

/** A single translation entry resolved from a locale file. */
export interface LocaleEntry {
  value: JsonValue;
  file: string;
  line: number;
}

/** All entries for one locale, keyed by `namespace:flatKey` (or `flatKey`). */
export interface LoadedLocale {
  locale: string;
  /** Map of fully-qualified key -> entry. */
  entries: Map<string, LocaleEntry>;
  /** Issues encountered while loading (invalid JSON, duplicate keys). */
  issues: Issue[];
  /** Whether any locale file was found for this locale. */
  found: boolean;
}

export interface CheckStats {
  sourceLocale: string;
  sourceKeyCount: number;
  byType: Record<IssueType, number>;
  byLocale: Record<string, { missing: number; extra: number; placeholder: number }>;
  errorCount: number;
  warningCount: number;
  /** True when at least one issue matches a `blockOn` type. */
  failed: boolean;
}

export interface CheckResult {
  issues: Issue[];
  stats: CheckStats;
  /** Locales that had no files on disk. */
  missingLocales: string[];
}

export const DEFAULT_BLOCK_ON: IssueType[] = [
  "invalid-json",
  "missing-key",
  "duplicate-key",
  "placeholder-mismatch",
];

/** Fixed severity per issue type for this release. */
export const SEVERITY_BY_TYPE: Record<IssueType, IssueSeverity> = {
  "invalid-json": "error",
  "missing-key": "error",
  "extra-key": "warning",
  "duplicate-key": "error",
  "placeholder-mismatch": "error",
  // Hardcoded text is reported but non-blocking by default: it is more
  // prone to false positives, so teams opt in via `blockOn`.
  "hardcoded-string": "warning",
  "hardcoded-attribute": "warning",
};
