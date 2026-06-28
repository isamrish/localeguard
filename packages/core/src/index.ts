/**
 * @localeguard/core — public API.
 */

export * from "./types";
export { FRAMEWORK_PRESETS, applyFramework } from "./framework";
export type { FrameworkPreset } from "./framework";
export { parseJson, JsonParseError } from "./json/parse";
export type { ParsedJson } from "./json/parse";
export { flatten } from "./flatten";
export type { FlattenOptions } from "./flatten";
export { findFiles, globToRegExp } from "./glob";
export type { FindFilesOptions } from "./glob";
export { compareKeys } from "./key-comparator/compare";
export type { KeyDiff } from "./key-comparator/compare";
export { checkKeyUsage } from "./key-usage";
export type { KeyUsageOptions } from "./key-usage";
export {
  extractPlaceholders,
  comparePlaceholders,
} from "./placeholder-validator/placeholder";
export type { PlaceholderDiff } from "./placeholder-validator/placeholder";
export { loadLocale } from "./locale-parser/load";
export type { LoadOptions } from "./locale-parser/load";
export { parseXliff } from "./locale-parser/xliff";
export type { ParsedXliff, XliffUnit } from "./locale-parser/xliff";
export { runCheck, summarizeIssues, sortIssues, LocaleGuardError } from "./check";
export type { RunCheckOptions, SummarizeParams } from "./check";
export { formatText } from "./reporters/text";
export type { TextReporterOptions } from "./reporters/text";
export { formatJson } from "./reporters/json";
export { formatMarkdown } from "./reporters/markdown";
export type { MarkdownReporterOptions } from "./reporters/markdown";
export { formatSarif } from "./reporters/sarif";
export type { SarifReporterOptions } from "./reporters/sarif";
