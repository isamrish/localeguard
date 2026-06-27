/**
 * Shared type definitions for LocaleGuard's core checks.
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type IssueSeverity = "error" | "warning";

/**
 * The categories of problems LocaleGuard can detect in this release.
 * Code-analysis categories (hardcoded-string, etc.) are reserved for Phase 2.
 */
export type IssueType =
  | "invalid-json"
  | "missing-key"
  | "extra-key"
  | "duplicate-key"
  | "placeholder-mismatch";

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

export interface LocaleGuardConfig {
  /** Reference locale every other locale is compared against. */
  sourceLocale: string;
  /** Target locales to validate. */
  locales: string[];
  /** Directory holding locale files, relative to the project root. */
  localesPath: string;
  /** Glob patterns of source files (reserved for Phase 2 code analysis). */
  include?: string[];
  /** Translation function names (reserved for Phase 2). */
  translationFunctions?: string[];
  /** Translation component names (reserved for Phase 2). */
  translationComponents?: string[];
  /** Glob patterns to ignore (reserved for Phase 2). */
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
};
