/**
 * @localeguard/react-analyzer — public API.
 */

export {
  analyzeProject,
  analyzeSource,
  DEFAULT_INCLUDE,
  DEFAULT_TRANSLATION_COMPONENTS,
} from "./analyzer";
export type { AnalyzerConfig, AnalyzeOptions } from "./analyzer";
export { findFiles, globToRegExp } from "./glob";
export type { FindFilesOptions } from "./glob";
