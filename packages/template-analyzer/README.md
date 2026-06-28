# @localeguard/template-analyzer

Detect **hardcoded** user-facing text in Vue (`.vue`) and Angular (`.html`)
templates for [LocaleGuard](https://github.com/isamrish/localeguard). Zero runtime
dependencies — a small, focused HTML/template scanner (no `@vue/compiler-sfc` or
Angular compiler required).

Reports the same issue types as the React analyzer:

- **`hardcoded-string`** — static template text, e.g. `<h1>Cluster Manager</h1>`
- **`hardcoded-attribute`** — literal `aria-label`/`title`/`alt`/`placeholder`

## Design: low false positives

Only **static** content is flagged. Anything dynamic or already marked for
translation is ignored:

| Template | Flagged? |
| --- | --- |
| `<h1>Cluster Manager</h1>` | ✅ |
| `<p>{{ t('title') }}</p>` | ❌ interpolation |
| `<p>Hello {{ name }}</p>` | ✅ (only the static `Hello`) |
| `<img :alt="x" />` / `<img [alt]="x" />` | ❌ bound attribute |
| `<img alt="Logo" />` | ✅ |
| `<i18n-t>…</i18n-t>` (Vue) | ❌ translation component |
| `<p i18n>…</p>` (Angular) | ❌ marked for i18n |
| `<button translate>KEY</button>` (Angular) | ❌ translate directive |
| `<code>npm i</code>`, `<span>100%</span>` | ❌ technical / non-text |

## Usage

Composed automatically by the `localeguard` CLI based on the `framework` config
(`vue-i18n` scans `.vue`; `ngx-translate` scans `.html`). It can also be used
directly:

```ts
import { scanVueSfc, scanAngularTemplate } from "@localeguard/template-analyzer";

const issues = scanVueSfc(vueSource, "App.vue", ["i18n-t"]);
```

## License

[Apache-2.0](https://github.com/isamrish/localeguard/blob/main/LICENSE)
