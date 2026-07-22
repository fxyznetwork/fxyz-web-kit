# @fxyz/i18n

Locale-routing middleware and JSON-dictionary tooling for the Next.js App
Router, built on [`next-international`](https://github.com/QuiiBz/next-international)
and [Languine](https://languine.ai/) for translation orchestration.

## Install

```sh
pnpm add @fxyz/i18n
```

## Surface

| Path | Purpose |
|---|---|
| `middleware.ts` | `internationalizationMiddleware(request)` — Next.js middleware that negotiates + rewrites locale-prefixed routes |
| `locales.ts` | Client-safe `locales` array + `Locale` type, derived from `languine.json` |
| `index.ts` | Server-only `getDictionary(locale)` + dictionary types |
| `languine.json` | Active-locale config (source + target locales) |
| `dictionaries/` | JSON dictionaries — one file per locale. Ships with a **synthetic demo dictionary only** (`en.json`, `es.json`) — replace with your own content |
| `scripts/sync-dictionaries.mjs` | Copies missing keys from the source dictionary into target-locale dictionaries |
| `scripts/validate-dictionaries.mjs` | Fails CI if a target locale is missing keys present in the source |
| `scripts/validate-coverage.mjs` | Flags target-locale strings that are still byte-identical to the English source (i.e., not actually translated), with an allowlist for intentional exceptions |

## Usage

### Middleware

```ts
// middleware.ts (app root)
export { internationalizationMiddleware as middleware, config } from "@fxyz/i18n/middleware";
```

### Dictionaries

```ts
// app/[locale]/layout.tsx
import { getDictionary } from "@fxyz/i18n";

export default async function Layout({ params }: { params: { locale: string } }) {
	const dict = await getDictionary(params.locale);
	return <p>{dict.hello}</p>;
}
```

```ts
// client component
import { locales, type Locale } from "@fxyz/i18n/locales";
```

## Workflow

1. Add new keys to `dictionaries/en.json` (the source locale) first.
2. Run `pnpm sync` to copy the new keys into every target-locale dictionary as placeholders.
3. Translate the placeholders in each target dictionary.
4. Run `pnpm validate` (key parity) and `pnpm validate:coverage` (catches un-translated placeholders) before shipping.

`validate:coverage` treats certain values as intentionally identical across
locales (URLs, emails, ticker-style symbols, percentages, durations, and any
value in `KNOWN_PROPER_VALUES` in `scripts/validate-coverage.mjs`) — extend
that list for your own brand names and protocol codes. Anything else that's
still English in a target dictionary must be translated or explicitly added
to `untranslated-allowlist.json`.

## Configuration

`languine.json` holds the active locale set:

```json
{
	"projectId": "your-languine-project-id",
	"locale": { "source": "en", "targets": ["es"] },
	"files": { "json": { "include": ["dictionaries/[locale].json"] } }
}
```

Add target locales here, then run `pnpm sync` to scaffold the new dictionary
file. `locales.ts` and `middleware.ts` both derive their locale list from
this file, so there is a single source of truth.

## A note on the build

Package exports point at TypeScript source directly (no prebuilt `dist`),
matching how it's consumed inside a Next.js app (Next transpiles workspace
packages itself). If you consume this package from a non-Next.js /
non-bundled context, add your own build step or transpile-on-import.

## What this package does NOT do

- It does not fetch/host translations — Languine (or your own translation
  workflow) is a separate concern; this package only orchestrates the local
  JSON files.
- It does not ship real product copy — the bundled dictionaries are a
  minimal demo (`hello`, `nav.home`, `nav.about`, `footer.copyright`).

## License

Apache-2.0
