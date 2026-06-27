# @localeguard/react-analyzer

Static analysis for LocaleGuard that catches **hardcoded** UI text in
React/TypeScript source — strings that never make it into the locale files at
all. Powered by the TypeScript compiler API; no project compilation required.

It reports two issue types:

- **`hardcoded-string`** — literal JSX text, e.g. `<Button>Create Cluster</Button>`
- **`hardcoded-attribute`** — literal `aria-label`, `title`, `alt`, or
  `placeholder`, e.g. `<button aria-label="Close dialog">`

## Design: low false positives

Only **literal** values are flagged. Anything already dynamic is left alone:

| Code | Flagged? |
| --- | --- |
| `<h1>Cluster Manager</h1>` | ✅ hardcoded-string |
| `<p>{t("app.title")}</p>` | ❌ already localized |
| `<Trans i18nKey="x">Welcome</Trans>` | ❌ inside a translation component |
| `<span>100%</span>` | ❌ no letters |
| `<button aria-label="Close">` | ✅ hardcoded-attribute |
| `<button aria-label={t("close")}>` | ❌ already localized |
| `<img alt="" />` | ❌ decorative empty alt |

Translation component names (default `Trans`) are configurable via
`translationComponents` in your LocaleGuard config.

## Usage

This package is composed automatically by the `localeguard` CLI — running
`localeguard check` includes source-code analysis using your config's `include`,
`ignore`, and `translationComponents`. Disable it with `localeguard check --no-code`.

It can also be used directly:

```ts
import { analyzeProject } from "@localeguard/react-analyzer";

const issues = analyzeProject(
  { include: ["src/**/*.{ts,tsx}"], translationComponents: ["Trans"] },
  { rootDir: process.cwd() },
);
```
