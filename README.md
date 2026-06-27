# LocaleGuard

**Prevent untranslated, inconsistent, and broken localization from reaching production.**

LocaleGuard is an open-source localization quality gate for React and
TypeScript projects. It detects missing translation keys, broken interpolation
variables, duplicate keys, and invalid locale files — before they merge.

[![CI](https://github.com/localeguard/localeguard/actions/workflows/ci.yml/badge.svg)](https://github.com/localeguard/localeguard/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)

> **Status: `0.1.0` — early release.** This version focuses on locale-file
> parity and interpolation validation. Source-code analysis (hardcoded JSX text,
> unlocalized `aria-label`/`alt`/`title`) and a dedicated GitHub Action are on the
> [roadmap](#roadmap).

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

| Check | Description |
| --- | --- |
| `missing-key` | A key in the source locale is absent from a translated locale |
| `extra-key` | A key exists in a translated locale but not in the source |
| `duplicate-key` | The same key is declared twice in one file |
| `invalid-json` | A locale file is not valid JSON (reported with line number) |
| `placeholder-mismatch` | Interpolation variables differ — e.g. `{{userName}}` dropped in translation |

Both `{{double-brace}}` (i18next) and `{single-brace}` (ICU / react-intl)
interpolation styles are recognized.

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
| `include`, `translationFunctions`, `translationComponents`, `ignore` | no | Reserved for upcoming source-code analysis |

Configuration can also live under a `"localeguard"` key in `package.json`.

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

Until the dedicated action ships, add LocaleGuard to any workflow with two lines:

```yaml
name: Localization Check
on: pull_request
jobs:
  localeguard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npx localeguard check
```

## Roadmap

LocaleGuard follows an open-core model: the scanner, CLI, and CI integration are
free and open source forever.

- **Phase 1 (this release):** locale-file parity + interpolation validation.
- **Phase 2:** source-code analysis — hardcoded JSX text and unlocalized
  `aria-label`, `title`, `alt`, and placeholder attributes via the TypeScript
  compiler API.
- **Phase 3:** PR integration — dedicated GitHub Action, changed-files-only mode,
  Markdown PR summaries, SARIF output.
- **Phase 4:** framework adapters — `react-i18next`, `react-intl`, Next.js,
  Vue I18n, Angular.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md)
and our [Code of Conduct](./CODE_OF_CONDUCT.md). Security reports: see
[SECURITY.md](./SECURITY.md).

## License

[Apache License 2.0](./LICENSE) — includes an explicit patent grant, the strong
default for a developer tool.
