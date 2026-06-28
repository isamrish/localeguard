# Changelog

All notable changes to LocaleGuard are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/isamrish/localeguard/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/isamrish/localeguard/releases/tag/v0.1.0
