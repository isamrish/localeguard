# Vue I18n example

Demonstrates LocaleGuard's `vue-i18n` preset on JSON message files.

```bash
localeguard check --config examples/vue-i18n-app/localeguard.config.json
```

It reports `nav.settings` missing in `fr` and the renamed `{name}` → `{nom}`
interpolation in `greeting`. The `"a | b | c"` pluralization string is treated as
plain text, so its differing wording is **not** flagged as long as the named
variables (`{count}`) match.

## Scope

This preset covers **locale-file checks** (parity, interpolation). Hardcoded-text
detection inside `.vue` `<template>` blocks is not yet supported — that requires a
Vue SFC parser and is tracked separately. Run with `--no-code` is unnecessary here
since there are no `.ts`/`.tsx` sources to scan.
