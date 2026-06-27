/**
 * @localeguard/core — public API.
 */

export * from "./types";
export { parseJson, JsonParseError } from "./json/parse";
export type { ParsedJson } from "./json/parse";
export { flatten } from "./flatten";
export { compareKeys } from "./key-comparator/compare";
export type { KeyDiff } from "./key-comparator/compare";
export {
  extractPlaceholders,
  comparePlaceholders,
} from "./placeholder-validator/placeholder";
export type { PlaceholderDiff } from "./placeholder-validator/placeholder";
export { loadLocale } from "./locale-parser/load";
export type { LoadOptions } from "./locale-parser/load";
export { runCheck, summarizeIssues, sortIssues, LocaleGuardError } from "./check";
export type { RunCheckOptions, SummarizeParams } from "./check";
export { formatText } from "./reporters/text";
export type { TextReporterOptions } from "./reporters/text";
export { formatJson } from "./reporters/json";
