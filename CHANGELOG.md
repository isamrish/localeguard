# Changelog

All notable changes to LocaleGuard are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **`--fix`**: add missing keys to JSON target locale files, stubbed with the
  source value (plain JSON locales only).
- **Config JSON schema** (`schema/localeguard.config.schema.json`), referenced via
  `$schema` in the config written by `localeguard init`.
- **Baseline / suppressions**: `localeguard check --update-baseline` records
  current issues to `localeguard-baseline.json`; later runs suppress those
  pre-existing issues so only *new* ones fail. Entries match by a line-independent
  signature. Configurable via `--baseline <path>` or the `baseline` config option.

## [0.4.0] - 2026-06-28

Completes the framework adapters: native Angular (XLIFF), template key-usage,
inline Angular templates, and Vue `<i18n>` blocks.

### Added

- **Vue `<i18n>` SFC blocks**: per-component message blocks are parsed and checked
  for key + interpolation parity between the locales declared within each block.
- **Inline Angular templates**: `@Component({ template: `…` })` strings are now
  scanned for hardcoded text and key references (with line numbers offset back
  into the `.ts` file), alongside external `.html` templates.
- **Key-usage in templates**: `undefined-key`/`unused-key` now also cover Vue and
  Angular templates — extracting `{{ t('key') }}`, `v-t`, `keypath`,
  `{{ 'KEY' | translate }}`, and `[translate]` references.
- **Native Angular i18n (XLIFF)** via the `angular` framework preset and a
  `localeFormat: "xliff"` option. Reads `messages.xlf` + `messages.{locale}.xlf`
  (XLIFF 1.2 and 2.0): the trans-unit `id` is the key, an empty/missing
  `<target>` counts as untranslated (missing key), and `<x>`/`<ph>` placeholders
  are compared for interpolation parity.

### Fixed

- The React analyzer no longer parses `.vue`/`.html` files as TSX when an
  `include` glob matches them, which previously double-reported template text
  (once as JSX, once as template). It now scans only JS/TS source extensions.

## [0.3.0] - 2026-06-28

Pull-request integration, framework adapters, template analysis, and key-usage
checks. Adds the `@localeguard/template-analyzer` package.

### Added

- **Key-usage checks** (React/TypeScript): `undefined-key` flags a literal
  translation key used in code but missing from the source locale (blocking by
  default); `unused-key` flags locale keys never referenced in code (opt-in via
  `unusedKeys`, skipped when dynamic key usage is detected). Key references are
  resolved namespace-aware (next-intl `useTranslations`, react-i18next `ns:key`,
  default-namespace layouts), and only literal, specific keys are flagged.
- **Framework presets** via a `framework` config option. `react-intl` reads
  FormatJS message descriptors (`{ "id": { "defaultMessage": "…" } }`) — the id
  is the key and interpolation is validated against `defaultMessage` — and treats
  `<FormattedMessage>` as a translation component. `react-i18next` remains the
  default. A `messageFormat` option (`plain` | `icu-descriptor`) is also exposed.
- **`next-intl` preset** (App Router): nested-namespace `messages/{locale}.json`
  with ICU interpolation and `useTranslations()`/`t()`. (Pages Router
  `next-i18next` is covered by the `react-i18next` preset.)
- **`vue-i18n` preset**: JSON message files with `{var}` interpolation and
  `"a | b | c"` pluralization.
- **`ngx-translate` preset** (Angular): JSON files (`assets/i18n/{lang}.json`)
  with `{{var}}` interpolation. Native Angular i18n (XLIFF) is on the roadmap.
- **`@localeguard/template-analyzer`**: hardcoded-text detection in Vue (`.vue`)
  and Angular (`.html`) templates via a zero-dependency template scanner. It
  ignores `{{ interpolation }}`, bound attributes (`:title`/`[title]`),
  translation components/directives (`<i18n-t>`, `i18n`, `translate`), and
  technical elements. Composed automatically with the `vue-i18n`/`ngx-translate`
  presets.

## [0.2.0] - 2026-06-28

Pull-request integration.

### Added

- **Markdown reporter** (`--reporter markdown`) for PR comments and GitHub job
  summaries.
- **SARIF reporter** (`--reporter sarif`) for GitHub code scanning — findings
  render as inline annotations on the pull-request diff.
- **`--output <file>`** flag to write a report to a file (e.g. for SARIF upload).
- **GitHub Action** (`packages/github-action`): runs the check, writes a job
  summary, uploads SARIF, and gates the build on blocking issues.
- **Changed-files-only mode** (`--changed --base <ref>`) to report only issues
  touching files changed vs a base git ref. Locale-parity issues are retained
  when the relevant locale's files changed. The action exposes `changed-only`.

## [0.1.0] - 2026-06-28

First public release. Packages: `localeguard` (CLI), `@localeguard/core`,
`@localeguard/react-analyzer`.

### Added

- **Locale-file checks** — missing keys, extra keys, duplicate keys, invalid
  JSON (reported with line numbers), and interpolation mismatches.
- **Interpolation validation** for i18next `{{double-brace}}` and ICU /
  react-intl `{single-brace}` styles. ICU `plural` / `select` / `selectordinal`
  blocks are handled conservatively so their sub-messages are never misread as
  variables.
- **Source-code analysis** (`@localeguard/react-analyzer`) via the TypeScript
  compiler API — detects hardcoded JSX text and unlocalized `aria-label`,
  `title`, `alt`, and `placeholder` attributes. Text inside translation
  components (`<Trans>`) and technical elements (`<code>`, `<pre>`, `<kbd>`,
  `<samp>`, …) is skipped, and only literal values are flagged.
- **CLI** — `localeguard check` and `localeguard init`, with `--config`,
  `--reporter text|json`, `--cwd`, `--no-code`, and `--no-color` options.
  CI-safe exit codes driven by the `blockOn` config.
- **Configuration** via `localeguard.config.json` or a `"localeguard"` field in
  `package.json`. Supports `en.json` and `en/<namespace>.json` locale layouts.
- Apache-2.0 license, docs, and a synthetic example app.

### Notes

- Source-code findings (`hardcoded-string`, `hardcoded-attribute`) are warnings
  by default and non-blocking; add them to `blockOn` to enforce.

[Unreleased]: https://github.com/isamrish/localeguard/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/isamrish/localeguard/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/isamrish/localeguard/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/isamrish/localeguard/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/isamrish/localeguard/releases/tag/v0.1.0
