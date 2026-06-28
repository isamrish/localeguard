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
      - uses: isamrish/localeguard/packages/github-action@v0.1.0
```

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `config` | _(auto)_ | Path to a `localeguard.config.json`. |
| `working-directory` | `.` | Directory to run in. |
| `version` | `latest` | Version of the `localeguard` npm package to run. |
| `node-version` | `20` | Node.js version to set up. |
| `args` | `""` | Extra args for `localeguard check` (e.g. `--no-code`). |
| `upload-sarif` | `true` | Upload SARIF to code scanning for inline annotations. |

## Notes

- `security-events: write` permission is required for the SARIF upload. If you
  set `upload-sarif: false`, that permission is not needed.
- SARIF file paths are resolved relative to `working-directory`. For a monorepo,
  set `working-directory` to the app root so annotations land on the right files.
- Don't want inline annotations? The job summary and pass/fail gate work on their
  own with `upload-sarif: false`.
