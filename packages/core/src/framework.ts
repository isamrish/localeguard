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
  "next-intl": {
    // App Router next-intl: useTranslations()/getTranslations() -> t(), ICU {var}
    // syntax, plain nested-namespace messages (messages/{locale}.json). It has no
    // <Trans>-style wrapper component. (For Pages Router next-i18next, use the
    // "react-i18next" preset — it is react-i18next under the hood.)
    translationFunctions: ["t", "useTranslations", "getTranslations"],
    translationComponents: [],
    messageFormat: "plain",
  },
  "vue-i18n": {
    // Vue I18n: t()/$t()/tc(), <i18n-t> component, plain nested JSON messages,
    // single-brace {var} interpolation (and "a | b | c" pluralization, which is
    // plain text to the parity check). NOTE: hardcoded-text detection in .vue
    // <template> blocks is not yet supported — only locale-file checks apply.
    translationFunctions: ["t", "$t", "tc", "$tc"],
    translationComponents: ["i18n-t", "I18nT"],
    messageFormat: "plain",
  },
  "ngx-translate": {
    // Angular ngx-translate: TranslateService.instant/get(), `translate` pipe and
    // directive, plain nested JSON (assets/i18n/{lang}.json), {{var}} interpolation.
    // Template hardcoded-text detection is out of scope. (For *native* Angular
    // i18n, which uses XLIFF/XMB files, see the roadmap.)
    translationFunctions: ["instant", "get", "stream", "translate"],
    translationComponents: [],
    messageFormat: "plain",
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
