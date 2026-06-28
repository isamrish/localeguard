# Native Angular i18n (XLIFF) example

Demonstrates LocaleGuard's `angular` preset on XLIFF message files produced by
`@angular/localize` (`ng extract-i18n`).

```bash
localeguard check --config examples/angular-i18n-app/localeguard.config.json
```

Layout (`localeFormat: "xliff"`, set by the `angular` preset):

```text
src/locale/messages.xlf        # source (<source> per trans-unit)
src/locale/messages.fr.xlf     # French (<target> per trans-unit)
```

It reports:

- `app.items` **missing** in `fr` — the trans-unit has no `<target>`, so it's
  treated as untranslated.
- `app.greeting` **interpolation mismatch** — the source placeholder
  `<x id="INTERPOLATION"/>` was changed to `<x id="AUTRE"/>` in the translation.

Supports XLIFF 1.2 (`<trans-unit>`) and 2.0 (`<unit>`). XMB/XTB is not yet
supported.
