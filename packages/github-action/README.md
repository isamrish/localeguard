# LocaleGuard GitHub Action

Run [LocaleGuard](https://github.com/isamrish/localeguard) as a pull-request
quality gate. The action:

- runs `localeguard check` and **fails the job** on blocking issues,
- writes a **Markdown summary** to the job page (`$GITHUB_STEP_SUMMARY`), and
- uploads **SARIF** to GitHub code scanning, so findings appear as **inline
  annotations on the PR diff**.

## Usage

```yaml
name: Localization
on: pull_request

permissions:
  contents: read
  security-events: write   # required to upload SARIF

jobs:
  localeguard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: isamrish/localeguard/packages/github-action@main
```

> Requires `localeguard` ≥ 0.2.0 on npm (adds the SARIF/Markdown reporters the
> action uses). Pin to a release tag like `@v0.2.0` once it's published.

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `config` | _(auto)_ | Path to a `localeguard.config.json`. |
| `working-directory` | `.` | Directory to run in. |
| `version` | `latest` | Version of the `localeguard` npm package to run. |
| `node-version` | `20` | Node.js version to set up. |
| `args` | `""` | Extra args for `localeguard check` (e.g. `--no-code`). |
| `upload-sarif` | `true` | Upload SARIF to code scanning for inline annotations. |
| `changed-only` | `false` | Only report issues in files changed vs the base ref. |
| `base` | _(PR base)_ | Base ref for `changed-only`; defaults to the PR base on `pull_request`. |

### Changed-files-only mode

For fast feedback on large repos, report only issues touching files changed in
the PR:

```yaml
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0          # required so the base ref is available
      - uses: isamrish/localeguard/packages/github-action@main
        with:
          changed-only: true
```

## Notes

- `security-events: write` permission is required for the SARIF upload. If you
  set `upload-sarif: false`, that permission is not needed.
- SARIF file paths are resolved relative to `working-directory`. For a monorepo,
  set `working-directory` to the app root so annotations land on the right files.
- Don't want inline annotations? The job summary and pass/fail gate work on their
  own with `upload-sarif: false`.
