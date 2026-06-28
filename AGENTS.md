# AGENTS.md

For agentic coding tools working in this repo. `CLAUDE.md` is a symlink to this
file. Human contributors: see [CONTRIBUTING.md](./CONTRIBUTING.md).

LocaleGuard is a localization quality gate for React/TypeScript, Vue, and Angular,
shipped as an npm-workspaces monorepo of four packages with **minimal runtime
dependencies**.

## Environment

- Node `>=18` (CI matrix: 18, 20, 22).
- TypeScript, **strict**, compiled with `tsc -b` (composite project references).
- Module format: **CommonJS**. Tests use the built-in `node:test` runner.
- Runtime deps: `core` and `template-analyzer` are **zero-dependency**;
  `react-analyzer` depends only on `typescript`. `cli` depends on the three.

## Primary commands

- `npm install` — install workspaces (symlinks the local packages).
- `npm run build` — `tsc -b` across all packages. **Always build via this**, not
  bare `tsc` — order matters (core → analyzers → cli).
- `npm test` — builds, then runs every `node:test` suite.
- `npm run check:example` — run the CLI against `examples/react-i18next-app`.
- `npm run pack:check` — `npm pack --workspaces --dry-run`; inspect publish contents.
- `npm run clean` — `tsc -b --clean`.

## Single-test / targeted runs

Tests run from **compiled `dist/test`**, not `src`, so build first:

```bash
npm run build
node --test packages/core/dist/test/check.test.js          # one file
node --test --test-name-pattern="placeholder" packages/core/dist/test/*.test.js
```

## Verification after non-trivial changes

1. `npm run build` (must be clean — strict TS).
2. `npm test` (all suites).
3. `npm run check:example` (sanity-check real output).
4. `npm run pack:check` before any release.

## Project layout

```text
packages/core/              parsers (JSON/YAML/XLIFF/PO), key comparison,
                            interpolation, key-usage, baseline, framework presets,
                            reporters (text/json/markdown/sarif), summarize/sort.
packages/react-analyzer/    React/TSX via the TypeScript compiler API: hardcoded
                            text/attrs, key references, inline Angular templates.
packages/template-analyzer/ hand-written HTML scanner for .vue/.html: hardcoded
                            text, key references, Vue <i18n> blocks.
packages/cli/               the `localeguard` bin: config loading + composition.
examples/                   synthetic apps, one per framework/format.
schema/                     JSON Schema for localeguard.config.json.
```

The CLI is the composition root: `runCheck` (locale parity, in core) + the two
analyzers, merged into one issue list, then baseline → reporters → exit code.
Analyzers import only `core` (types + the shared `findFiles` glob); `cli` imports
all three. No cycles.

## Conventions

- **Keep dependencies minimal** (see above) — discuss before adding any.
- **Low false positives beat completeness.** Only flag clearly literal/static
  values; every detector needs adversarial test cases (see the existing
  `*.test.ts` for the patterns we deliberately do *not* flag).
- **Strict TS, tests required**, actionable output (file/line/type/severity/
  message/suggestion), **synthetic fixtures only**.

## Gotchas (things that have bitten us)

- **`node --test` globs must be shell-expanded, not quoted** in `package.json` —
  Node < 21 doesn't expand globs itself, which breaks CI on Node 18/20.
- **Reporters must be updated for every new `IssueType`.** SARIF
  `RULE_DESCRIPTIONS` is a `Record<IssueType, string>` (a missing entry fails the
  build); the text/markdown summary lines are not type-checked, so update them too.
- **macOS symlinked paths.** `git rev-parse --show-toplevel` returns the canonical
  `/private/var/...`; canonicalize `rootDir` (`fs.realpathSync`) before
  relativizing or paths won't match (see `cli/src/git-changed.ts`).
- **The React analyzer must skip non-JS extensions** even if an `include` glob
  matches them, or `.vue`/`.html` get double-flagged (parsed as TSX *and* by the
  template analyzer).
- **Placeholder extraction is self-canceling for parity:** identical placeholders
  on both sides cancel out, so heuristic over-capture is safe. ICU
  `plural`/`select` blocks are stripped via balanced-brace matching so their
  sub-messages aren't mistaken for variables.
- **XLIFF/PO are source-vs-target:** an empty `<target>`/`msgstr` means
  untranslated → a missing key. For PO the source value prefers `msgstr` over
  `msgid` (symbolic-id projects put the source text in `msgstr`).
- **Baseline signatures are line-independent** (`type|file|locale|key|message`) —
  do not add line numbers to the signature.
- **Hardcoded version strings** (`VERSION` in `cli/src/index.ts`, the SARIF
  reporter default) carry an `// x-release-please-version` annotation so
  release-please bumps them automatically. If you add another, annotate it and
  list its file under `extra-files` in `release-please-config.json`.

## Where things plug in

- **New issue type** → `core/src/types.ts` (`IssueType`, `ISSUE_TYPES`,
  `SEVERITY_BY_TYPE`, maybe `DEFAULT_BLOCK_ON`) + SARIF rule descriptions +
  text/markdown summaries.
- **New framework** → `FRAMEWORK_PRESETS` in `core/src/framework.ts` and
  `VALID_FRAMEWORKS` in `cli/src/config.ts`.
- **New locale format** → a parser under `core/src/<format>/` + a dispatch branch
  in `core/src/locale-parser/load.ts`; extend `LocaleFormat` and
  `VALID_LOCALE_FORMATS`.

## Commit messages & releases

- **Conventional Commits** (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`) —
  release automation depends on this. Keep them concise and plain (verbs like
  "add"/"fix"/"update"); **no automated co-author trailers**.
- Releases are managed by **release-please**: merging its release PR bumps
  versions, updates changelogs, tags, and publishes.
