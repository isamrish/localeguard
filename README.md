# LocaleGuard

**Prevent untranslated, inconsistent, and broken localization from reaching production.**

LocaleGuard is an open-source localization quality gate for React and
TypeScript projects. It detects missing translation keys, broken interpolation
variables, duplicate keys, and invalid locale files — before they merge.

[![CI](https://github.com/isamrish/localeguard/actions/workflows/ci.yml/badge.svg)](https://github.com/isamrish/localeguard/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)

> **Status: `0.1.0` — early release.** Includes locale-file parity,
> interpolation validation, and source-code analysis for hardcoded JSX text and
> unlocalized `aria-label`/`alt`/`title`/`placeholder`. A dedicated GitHub Action
> and framework adapters are on the [roadmap](#roadmap).

---

## 30-second start

```bash
npm install --save-dev localeguard
npx localeguard init     # writes localeguard.config.json
npx localeguard check
```

Example output:

```text
LocaleGuard

✓ en reference locale loaded (6 keys)

tr
  ✗ public/locales/en/translation.json:8 [missing-key] Key "translation:actions.delete" is missing in "tr".
    → Add "translation:actions.delete" to the "tr" locale.
  ⚠ public/locales/tr/translation.json:10 [extra-key] Key "translation:legacy" exists in "tr" but not in source "en".
    → Remove "translation:legacy" from "tr", or add it to the source locale.
  ✗ public/locales/tr/translation.json:8 [placeholder-mismatch] Interpolation mismatch in "translation:welcome" (tr): missing {userName}; unexpected {kullanici}.
    → Keep the same interpolation variables as the source string.

Summary: 1 missing, 1 extra, 1 interpolation

Localization check failed.
```

LocaleGuard exits with a non-zero status when a blocking issue is found, so it
fails CI automatically.

## What it checks (0.1.0)

**Locale files**

| Check | Description |
| --- | --- |
| `missing-key` | A key in the source locale is absent from a translated locale |
| `extra-key` | A key exists in a translated locale but not in the source |
| `duplicate-key` | The same key is declared twice in one file |
| `invalid-json` | A locale file is not valid JSON (reported with line number) |
| `placeholder-mismatch` | Interpolation variables differ — e.g. `{{userName}}` dropped in translation |

Both `{{double-brace}}` (i18next) and `{single-brace}` (ICU / react-intl)
interpolation styles are recognized.

**Code ↔ locale keys** (React/TypeScript)

| Check | Description |
| --- | --- |
| `undefined-key` | A literal key used in code (`t('app.titel')`) that is missing from the source locale |
| `unused-key` | A locale key never referenced in code (opt-in via `unusedKeys`; skipped when dynamic keys are present) |

Key references are resolved namespace-aware: next-intl `useTranslations('Home')` +
`t('title')` → `Home.title`, react-i18next `t('ns:key')`, and default-namespace
directory layouts. Only **literal** keys are checked; `` t(`${x}`) `` is treated as
dynamic. `undefined-key` only fires on keys specific enough to be confident
(dotted/namespaced), keeping false positives low.

**Source code** — React/TypeScript JSX (via the TypeScript compiler API) and
Vue/Angular templates (via a dependency-free template scanner)

| Check | Description |
| --- | --- |
| `hardcoded-string` | Literal user-facing JSX or template text, e.g. `<Button>Create Cluster</Button>` |
| `hardcoded-attribute` | Literal `aria-label`, `title`, `alt`, or `placeholder` values |

Source-code findings are **warnings by default** (non-blocking) to keep false
positives from breaking builds — add them to `blockOn` to enforce. Anything
already dynamic is left alone: translation calls (`{t('...')}`), `<Trans>`
children, template `{{ interpolation }}`, bound attributes (`:title`, `[title]`),
Angular `i18n`-marked text, the `translate` directive, empty `alt`, and non-text
like `100%`. Technical elements (`<code>`, `<pre>`, …) are skipped. Disable code
analysis with `localeguard check --no-code`.

## How is this different?

Parts of LocaleGuard overlap with existing tools — `eslint-plugin-i18next`
(`no-literal-string`), `eslint-plugin-formatjs`, and the `i18n-ally` VS Code
extension. The individual checks are not novel. What LocaleGuard tries to do
better:

- **One CI gate instead of several tools.** Locale-file parity, interpolation
  validation, and hardcoded-text detection run from a single `localeguard check`
  with one config and a CI-safe exit code — rather than stitching together an
  ESLint rule, an editor extension, and a custom parity script.
- **Low false positives, by design and by measurement.** Only *literal* values
  are flagged; anything already dynamic (`{t('...')}`, `<Trans>` children) is
  left alone. Text inside technical elements (`<code>`, `<pre>`, `<kbd>`,
  `<samp>`) is skipped, and ICU `plural`/`select` sub-messages are not misread as
  variables. Against an adversarial fixture — ICU plurals and selects, positional
  args, reordered interpolation, technical blocks, and mixed dynamic/literal JSX —
  LocaleGuard reports **zero false positives** while still catching every genuine
  issue. (`no-literal-string`, by contrast, is well known for needing heavy
  per-project tuning.) The adversarial cases live in the test suites
  (`packages/core/test/placeholder.test.ts`,
  `packages/react-analyzer/test/analyzer.test.ts`).
- **Framework-agnostic locale checks.** Parity and interpolation validation work
  on plain JSON locale files regardless of the i18n runtime.

**What it is _not_ (yet):** a full ICU message validator, a key extractor, or a
replacement for translation-management platforms. Complex nested ICU is handled
conservatively — LocaleGuard under-reports rather than risk a false positive.

## Configuration

`localeguard init` creates a `localeguard.config.json`:

```json
{
  "sourceLocale": "en",
  "locales": ["fr", "tr", "ja", "es"],
  "localesPath": "public/locales",
  "blockOn": ["missing-key", "placeholder-mismatch", "invalid-json", "duplicate-key"]
}
```

| Field | Required | Description |
| --- | --- | --- |
| `sourceLocale` | yes | Reference locale every other locale is compared against |
| `locales` | yes | Target locales to validate |
| `localesPath` | yes | Directory holding locale files (relative to the config) |
| `blockOn` | no | Issue types that fail the check (defaults to all but `extra-key`) |
| `framework` | no | Preset: `react-i18next`, `react-intl`, `next-intl`, `vue-i18n`, `ngx-translate` |
| `messageFormat` | no | `plain` (default) or `icu-descriptor` (FormatJS message objects) |
| `localeFormat` | no | `json` (default) or `xliff` (Angular `.xlf` files) |
| `unusedKeys` | no | Report locale keys never referenced in code (default `false`) |
| `baseline` | no | Path to a baseline file (default `localeguard-baseline.json`) |
| `include` | no | Source globs for code analysis (default `src/**/*.{ts,tsx}`) |
| `translationFunctions`, `translationComponents` | no | Names treated as already-localized |
| `ignore` | no | Globs excluded from code analysis |

Configuration can also live under a `"localeguard"` key in `package.json`.

### Framework adapters

Set `framework` to apply sensible defaults for that stack (you can still override
any field):

| Framework | Translation components | Message format |
| --- | --- | --- |
| `react-i18next` (default) | `Trans` | `plain` — `{ "key": "value" }`, `{{var}}` |
| `react-intl` | `FormattedMessage`, `Trans` | `icu-descriptor` — `{ "id": { "defaultMessage": "…" } }`, `{var}` |
| `next-intl` | _(none)_ | `plain` nested namespaces, ICU `{var}` |
| `vue-i18n` | `i18n-t` | `plain` nested JSON, `{var}` + `a \| b` plurals |
| `ngx-translate` | _(none)_ | `plain` nested JSON, `{{var}}` |
| `angular` | native i18n | XLIFF `messages.{locale}.xlf` (1.2 & 2.0), `<x>`/`<ph>` placeholders |

With `react-intl`, LocaleGuard reads FormatJS message descriptors: the message
**id** is the key and interpolation is validated against `defaultMessage`, so
descriptors are never mistaken for nested namespaces. See
[`examples/react-intl-app`](./examples/react-intl-app).

`next-intl` (App Router) uses `useTranslations()`/`t()` and nested-namespace
`messages/{locale}.json` with ICU interpolation. See
[`examples/next-intl-app`](./examples/next-intl-app). **Pages Router
`next-i18next` is react-i18next under the hood — use the `react-i18next` preset.**

`vue-i18n` covers JSON message files (parity + interpolation, including
`"a | b | c"` pluralization), `<i18n>` SFC block parity, **and** hardcoded-text
detection in `.vue` `<template>` blocks. See
[`examples/vue-i18n-app`](./examples/vue-i18n-app).

For Angular, `ngx-translate` covers its JSON files (`assets/i18n/{lang}.json`,
`{{var}}`) **and** hardcoded-text detection in Angular `.html` templates
(respecting `i18n` markers, the `translate` directive, and bindings). See
[`examples/ngx-translate-app`](./examples/ngx-translate-app).

**Native Angular i18n** (`@angular/localize`) uses the `angular` preset, which
reads **XLIFF** message files (`messages.xlf` + `messages.{locale}.xlf`, XLIFF 1.2
and 2.0). The trans-unit `id` is the key, a unit with an empty/missing `<target>`
counts as untranslated (a missing key), and `<x>`/`<ph>` placeholders are compared
for interpolation parity. See [`examples/angular-i18n-app`](./examples/angular-i18n-app).
(XMB/XTB is not yet supported.)

Template hardcoded-text analysis (Vue/Angular) is handled by
[`@localeguard/template-analyzer`](./packages/template-analyzer); React/TypeScript
JSX is handled by `@localeguard/react-analyzer`.

### Locale file layouts

Both common layouts are supported automatically:

```text
public/locales/en.json                 # single file per locale
public/locales/en/translation.json     # per-namespace files (keys become "namespace:key")
```

## CLI

```text
localeguard check     Validate locale files against the source locale
localeguard init      Create a starter localeguard.config.json

Options:
  -c, --config <path>     Path to a config file
  -r, --reporter <type>   Output format: text (default) or json
      --cwd <dir>         Run as if from this directory
      --no-color          Disable colored output
```

The `json` reporter emits a stable, machine-readable report (`schemaVersion: 1`)
for piping into other tooling.

## Continuous integration

### GitHub Action (recommended)

The action fails the job on blocking issues, writes a Markdown summary to the job
page, and uploads SARIF so findings appear as **inline annotations on the PR diff**:

```yaml
name: Localization
on: pull_request
permissions:
  contents: read
  security-events: write   # for SARIF upload
jobs:
  localeguard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: isamrish/localeguard/packages/github-action@v0.2.0
```

See the [action docs](./packages/github-action/README.md) for inputs.

### Plain CLI

Or run it directly in any workflow:

```yaml
- run: npx localeguard check
```

### Adopting on an existing project (baseline)

Turning LocaleGuard on in a large codebase can surface a lot of pre-existing
findings. Record them once as a **baseline** so only *new* issues fail the build:

```bash
localeguard check --update-baseline   # writes localeguard-baseline.json
git add localeguard-baseline.json
localeguard check                      # pre-existing issues suppressed; new ones fail
```

Baseline entries are matched by a **line-independent** signature (type, file,
locale, key, message), so edits elsewhere in a file don't break them. As issues
are fixed and the baseline is regenerated, it shrinks toward zero. Point at a
different file with `--baseline <path>` or the `baseline` config option.

### Reporters

`localeguard check --reporter <type>` supports:

| Reporter | Use |
| --- | --- |
| `text` | Human-readable terminal output (default) |
| `json` | Machine-readable (`schemaVersion: 1`) for custom tooling |
| `markdown` | PR comment / job summary (`--output summary.md`) |
| `sarif` | GitHub code scanning inline annotations (`--output out.sarif`) |

### Changed-files-only mode

For fast PR feedback, report only issues touching files changed vs a base ref:

```bash
localeguard check --changed --base origin/main
```

Locale-parity issues are kept when the relevant locale's files changed, even
though they're reported against the source file.

## Roadmap

LocaleGuard follows an open-core model: the scanner, CLI, and CI integration are
free and open source forever.

- **Phase 1 ✅ (shipped):** locale-file parity + interpolation validation.
- **Phase 2 ✅ (shipped):** source-code analysis — hardcoded JSX text and
  unlocalized `aria-label`, `title`, `alt`, and `placeholder` attributes via the
  TypeScript compiler API.
- **Phase 3 ✅ (shipped):** PR integration — GitHub Action, Markdown summary,
  SARIF / code-scanning annotations, and changed-files-only mode.
- **Phase 4 ✅ (shipped):** framework adapters — `react-i18next`, `react-intl`,
  `next-intl`, `vue-i18n`, `ngx-translate`, and native `angular` (XLIFF), with
  hardcoded-text analysis for React JSX and Vue/Angular templates.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md)
and our [Code of Conduct](./CODE_OF_CONDUCT.md). Security reports: see
[SECURITY.md](./SECURITY.md).

## License

[Apache License 2.0](./LICENSE) — includes an explicit patent grant, the strong
default for a developer tool.
