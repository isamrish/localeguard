# localeguard-action (planned — Phase 3)

A dedicated GitHub Action wrapping the LocaleGuard CLI, for one-line adoption:

```yaml
- uses: localeguard/localeguard-action@v1
```

Planned capabilities:

- Changed-files-only mode for fast PR feedback
- Markdown PR summary comment
- SARIF output for GitHub code scanning
- Configurable failure thresholds via `blockOn`

Until this ships, run the CLI directly in CI — see the
[README](../../README.md#continuous-integration). This package is a placeholder
and is **not yet published**.
