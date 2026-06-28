# Contributing to LocaleGuard

Thanks for your interest in improving LocaleGuard! This guide covers local
development and the expectations for contributions.

## Development setup

LocaleGuard is an npm-workspaces monorepo. You need **Node.js 18+**.

```bash
git clone https://github.com/isamrish/localeguard.git
cd localeguard
npm install
npm run build      # tsc -b across all packages
npm test           # build + run the test suites
```

Run the CLI against the bundled example:

```bash
npm run check:example
```

## Repository layout

```text
packages/
  core/             @localeguard/core — parsing, key comparison, placeholder validation, reporters
  react-analyzer/     @localeguard/react-analyzer — hardcoded text in React/TSX (TS compiler API)
  template-analyzer/  @localeguard/template-analyzer — hardcoded text in Vue/Angular templates
  cli/                localeguard — the CLI, config loader, and result composition
examples/
  react-i18next-app/   a small fixture used by check:example and the docs
```

## Guidelines

- **Keep runtime dependencies minimal.** `core` and `cli` rely only on Node
  built-ins; `react-analyzer` depends only on `typescript` (for its compiler
  API). Please discuss before adding any new dependency.
- **Add tests.** Use the built-in `node:test` runner; place tests under each
  package's `test/` directory. All checks should have unit coverage, and
  behavior changes should add an end-to-end case in `packages/core/test/check.test.ts`.
- **Favor a low false-positive rate.** A check that fires on correct code is
  worse than a missing check — developers disable noisy tools.
- **Always make output actionable.** Every issue should report file, line,
  problem, severity, and a suggested fix.

## Use synthetic examples only

All fixtures and examples in this repository must be **synthetic**. Do not
contribute proprietary locale files, internal key names, customer data, or any
content derived from a private codebase. Write examples from scratch.

## Submitting changes

1. Fork and create a feature branch.
2. `npm test` must pass and `npm run build` must be clean.
3. Open a pull request describing the change and the motivation.

By contributing, you agree that your contributions are licensed under the
[Apache License 2.0](./LICENSE).
