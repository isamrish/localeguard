/**
 * Framework presets. Selecting a `framework` in the config fills in sensible
 * defaults for translation functions/components and the locale message format,
 * which a user can still override explicitly.
 */

import type { Framework, LocaleGuardConfig, MessageFormat } from "./types";

export interface FrameworkPreset {
  translationFunctions: string[];
  translationComponents: string[];
  messageFormat: MessageFormat;
}

export const FRAMEWORK_PRESETS: Record<Framework, FrameworkPreset> = {
  "react-i18next": {
    translationFunctions: ["t", "i18n.t"],
    translationComponents: ["Trans"],
    messageFormat: "plain",
  },
  "react-intl": {
    // FormatJS: intl.formatMessage(...) and <FormattedMessage> / <FormattedHTMLMessage>.
    translationFunctions: ["formatMessage", "intl.formatMessage", "$t"],
    translationComponents: ["FormattedMessage", "FormattedHTMLMessage", "Trans"],
    messageFormat: "icu-descriptor",
  },
};

/**
 * Return a config with framework-preset defaults filled in for any fields the
 * user did not set explicitly. Idempotent; a no-op when `framework` is unset.
 */
export function applyFramework(config: LocaleGuardConfig): LocaleGuardConfig {
  if (!config.framework) return config;
  const preset = FRAMEWORK_PRESETS[config.framework];
  return {
    ...config,
    translationFunctions: config.translationFunctions ?? preset.translationFunctions,
    translationComponents: config.translationComponents ?? preset.translationComponents,
    messageFormat: config.messageFormat ?? preset.messageFormat,
  };
}
