# Getting started

LocaleGuard validates your translated locale files against a single source
locale and fails fast when something is missing or inconsistent.

## 1. Install

```bash
npm install --save-dev localeguard
```

## 2. Create a config

```bash
npx localeguard init
```

This writes `localeguard.config.json`. Edit it to match your project:

```json
{
  "sourceLocale": "en",
  "locales": ["fr", "tr", "ja", "es"],
  "localesPath": "public/locales"
}
```

`localesPath` is resolved relative to the config file. LocaleGuard detects both
layouts automatically:

- `public/locales/en.json`
- `public/locales/en/translation.json` (namespaced — keys become `translation:key`)

## 3. Run the check

```bash
npx localeguard check
```

- Exit code `0` — no blocking issues.
- Exit code `1` — at least one issue whose type is in `blockOn`.

## 4. Wire it into CI

Add a step to your pull-request workflow:

```yaml
- run: npx localeguard check
```

## Tuning what blocks the build

By default everything except `extra-key` is blocking. To treat extra keys as a
hard failure too, or to relax a check, set `blockOn`:

```json
{
  "blockOn": ["missing-key", "placeholder-mismatch", "invalid-json"]
}
```

## Machine-readable output

```bash
npx localeguard check --reporter json
```

Emits a stable report (`schemaVersion: 1`) with `stats`, `missingLocales`, and a
flat `issues` array — useful for dashboards or custom CI annotations.
