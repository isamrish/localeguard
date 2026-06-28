# Angular (ngx-translate) example

Demonstrates LocaleGuard's `ngx-translate` preset on JSON translation files
(`src/assets/i18n/{lang}.json`).

```bash
localeguard check --config examples/ngx-translate-app/localeguard.config.json
```

It reports `NAV.SETTINGS` missing in `fr` and the renamed `{{name}}` → `{{nom}}`
interpolation in `GREETING`.

## Scope

This preset covers **locale-file checks** (parity, interpolation) for
ngx-translate's JSON files with `{{var}}` interpolation. Hardcoded-text detection
in Angular HTML templates is not supported.

**Native Angular i18n** (the `@angular/localize` / `i18n` attribute approach) uses
XLIFF/XMB XML message files instead of JSON — that requires a dedicated XLIFF
parser and is tracked on the roadmap, not covered by this preset.
