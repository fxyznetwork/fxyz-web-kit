# @fxyz/seo

SEO metadata helpers + JSON-LD generators for the Next.js App Router
Metadata API. Ships with no brand values baked in — you configure your own
site name, author, and locales once, then reuse the returned `createMetadata`
helper everywhere.

## Install

```sh
pnpm add @fxyz/seo
```

## Setup

```ts
// lib/seo.ts
import { createMetadataBuilder } from "@fxyz/seo";

export const { createMetadata } = createMetadataBuilder({
	applicationName: "Example Site",
	author: { name: "Example Site", url: "https://example.com/" },
	publisher: "Example Site",
	twitterHandle: "@example",
	supportedLocales: ["en", "es"],
	defaultLocale: "en",
	openGraphLocaleMap: { en: "en_US", es: "es_ES" },
});
```

## Usage

```ts
// app/[locale]/page.tsx
import { createMetadata } from "@/lib/seo";

export const generateMetadata = () =>
	createMetadata({
		title: "Home",
		description: "Example site homepage.",
		alternates: { canonical: "/en" },
	});
```

`createMetadata({ title, description, image?, locale?, ...rest })` returns a
Next.js `Metadata` object for `generateMetadata()`. It:

- Appends your `applicationName` to the title unless already present
- Fills in OpenGraph + Twitter card defaults, merged with any `rest` overrides via `lodash.merge`
- Auto-detects locale from a `/{locale}/...` canonical path and maps it to a full OpenGraph locale (e.g. `es` → `es_ES`)
- Auto-builds `hreflang` `alternates.languages` for every configured locale (skipped if you pass your own `languages`)
- Normalizes the canonical link for the default locale to omit its path prefix
- Falls back to `defaultOgImagePath` (default `/opengraph-image`) when no `image` is given

### JSON-LD

```tsx
import { JsonLd } from "@fxyz/seo/json-ld";
import type { Organization, WithContext } from "@fxyz/seo/json-ld";

const orgSchema: WithContext<Organization> = {
	"@context": "https://schema.org",
	"@type": "Organization",
	name: "Example Site",
	url: "https://example.com",
};

export default function Layout() {
	return <JsonLd code={orgSchema} />;
}
```

`JsonLd` renders a plain server-rendered `<script type="application/ld+json">`
(not `next/script`) so crawlers that don't execute JavaScript still see it.
HTML-significant characters (`<`, `>`, `&`, U+2028, U+2029) are escaped
before the JSON is embedded, so dynamic field values can't break out of the
`<script>` tag. Give each block an explicit `id` (or rely on the `@type`-derived
default) when rendering more than one JSON-LD block per page.

## A note on the build

Package exports point at TypeScript source directly (no prebuilt `dist`),
matching how it's consumed inside a Next.js app (Next transpiles workspace
packages itself). If you consume this package from a non-Next.js /
non-bundled context, add your own build step (`tsup`, `tsc`, etc.) or
transpile-on-import (`tsx`, `ts-node`).

## Config reference (`SeoConfig`)

| Field | Required | Default | Purpose |
|---|---|---|---|
| `applicationName` | yes | — | Site name; appended to titles, used as OG `siteName` |
| `author` | yes | — | `{ name, url }` for `authors` + `creator` |
| `publisher` | yes | — | `publisher` metadata field |
| `twitterHandle` | yes | — | Twitter/X `@handle` for `twitter.creator` |
| `defaultOgImagePath` | no | `/opengraph-image` | Fallback OG/Twitter image path |
| `supportedLocales` | no | `["en"]` | Locales for hreflang generation |
| `defaultLocale` | no | `"en"` | Locale served without a path prefix |
| `openGraphLocaleMap` | no | `{}` | Short locale → full OG locale (e.g. `en` → `en_US`); unmapped locales fall back to `${locale}_${locale.toUpperCase()}` |

## License

Apache-2.0
