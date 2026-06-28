# Angular (ngx-translate) example

Demonstrates LocaleGuard's `ngx-translate` preset on JSON translation files
(`src/assets/i18n/{lang}.json`).

```bash
localeguard check --config examples/ngx-translate-app/localeguard.config.json
```

It reports `NAV.SETTINGS` missing in `fr` and the renamed `{{name}}` → `{{nom}}`
interpolation in `GREETING`.

It also scans `src/app/app.component.html` and flags the hardcoded `<h1>` text and
the literal `alt`, while leaving the `translate` pipe, the bound
`[attr.aria-label]`, and the `i18n`-marked paragraph alone.

## Scope

This covers locale-file checks (parity, interpolation) for ngx-translate's JSON
files **and** hardcoded-text detection in Angular `.html` templates.

**Native Angular i18n** (the `@angular/localize` / `i18n` attribute approach) uses
XLIFF/XMB XML message files instead of JSON — that requires a dedicated XLIFF
locale parser and is tracked on the roadmap, not covered by this preset.
