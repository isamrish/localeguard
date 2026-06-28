# Vue I18n example

Demonstrates LocaleGuard's `vue-i18n` preset on JSON message files.

```bash
localeguard check --config examples/vue-i18n-app/localeguard.config.json
```

It reports `nav.settings` missing in `fr` and the renamed `{name}` → `{nom}`
interpolation in `greeting`. The `"a | b | c"` pluralization string is treated as
plain text, so its differing wording is **not** flagged as long as the named
variables (`{count}`) match.

It also scans `src/components/HelloWorld.vue` and flags the hardcoded `<h1>` text
and the literal `alt` attribute, while leaving `{{ t(...) }}` interpolation and the
bound `:aria-label` alone.

The component also has an `<i18n>` SFC block; LocaleGuard checks parity between
the locales declared inside it (here `tagline` is missing in `fr`).

## Scope

This covers locale-file checks (parity, interpolation), `<i18n>` SFC block parity,
**and** hardcoded-text detection in `.vue` `<template>` blocks. Disable code
analysis with `--no-code`.
