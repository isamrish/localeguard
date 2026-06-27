# @localeguard/react-analyzer (planned — Phase 2)

Static analysis of React/TypeScript source to catch **hardcoded** UI text that
never reaches the locale files at all:

- Hardcoded JSX text: `<Button>Create Cluster</Button>`
- Unlocalized accessibility attributes: `aria-label`, `title`, `alt`, and
  `placeholder`

It will use the TypeScript compiler API to report the file, line, attribute, and
a suggested remediation, and feed results through the same reporters as the core
checks.

This package is a placeholder and is **not yet published**. See the
[roadmap](../../README.md#roadmap).
