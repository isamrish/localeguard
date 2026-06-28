# @localeguard/core

Core localization checks for [LocaleGuard](https://github.com/isamrish/localeguard) —
the engine behind the `localeguard` CLI. Zero runtime dependencies.

Provides:

- A JSON parser that reports duplicate keys and syntax errors **with line numbers**
- Key flattening and source-vs-target key comparison
- Interpolation validation for `{{double-brace}}` (i18next) and `{single-brace}`
  (ICU / react-intl), with ICU `plural`/`select` handled conservatively
- Text and JSON reporters

Most users should install the [`localeguard`](https://www.npmjs.com/package/localeguard)
CLI rather than this package directly.

```ts
import { runCheck, formatText } from "@localeguard/core";

const result = runCheck(
  { sourceLocale: "en", locales: ["fr"], localesPath: "public/locales" },
  { rootDir: process.cwd() },
);
console.log(formatText(result, { color: true }));
process.exitCode = result.stats.failed ? 1 : 0;
```

See the [main README](https://github.com/isamrish/localeguard#readme) for full docs.

## License

[Apache-2.0](https://github.com/isamrish/localeguard/blob/main/LICENSE)
