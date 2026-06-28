# localeguard

**Prevent untranslated, inconsistent, and broken localization from reaching
production.** An open-source localization quality gate for React and TypeScript.

```bash
npm install --save-dev localeguard
npx localeguard init     # writes localeguard.config.json
npx localeguard check
```

LocaleGuard detects, in a single CI-safe command:

- Missing / extra / duplicate translation keys
- Invalid locale JSON (reported with line numbers)
- Interpolation mismatches — e.g. `{{userName}}` dropped in a translation
- Hardcoded JSX text and unlocalized `aria-label` / `title` / `alt` / `placeholder`

It exits non-zero when a blocking issue is found, so it fails CI automatically.
Run `localeguard check --no-code` to check locale files only, or
`--reporter json` for machine-readable output.

```yaml
# .github/workflows/i18n.yml
- run: npx localeguard check
```

See the [full documentation](https://github.com/isamrish/localeguard#readme),
including configuration and the "How is this different?" comparison.

## License

[Apache-2.0](https://github.com/isamrish/localeguard/blob/main/LICENSE)
