import merge from "lodash.merge";
import type { Metadata } from "next";

type MetadataGenerator = Omit<Metadata, "description" | "title"> & {
	title: string;
	description: string;
	image?: string;
	locale?: string;
};

export interface SeoConfig {
	/** Site/application name, appended to page titles and used as OG siteName. */
	applicationName: string;
	/** Default author, used for `authors` + `creator` metadata. */
	author: { name: string; url: string };
	/** Publisher name. */
	publisher: string;
	/** Twitter/X handle, e.g. "@example", used as the twitter:creator value. */
	twitterHandle: string;
	/**
	 * Default OG image path, resolved by Next.js file conventions (e.g. a
	 * root `opengraph-image.tsx`). Defaults to "/opengraph-image".
	 */
	defaultOgImagePath?: string;
	/**
	 * Locale codes this site supports (used for hreflang generation and
	 * locale-prefixed canonical-path parsing). Defaults to `["en"]`.
	 */
	supportedLocales?: readonly string[];
	/** The locale served without a path prefix. Defaults to `"en"`. */
	defaultLocale?: string;
	/**
	 * Maps a short locale code to its full OpenGraph locale (e.g.
	 * `{ en: "en_US" }`). Locales without an explicit entry fall back to
	 * `${locale}_${locale.toUpperCase()}`.
	 */
	openGraphLocaleMap?: Record<string, string>;
}

/**
 * Build a `createMetadata` helper bound to your site's brand config.
 *
 * ```ts
 * // lib/seo.ts
 * export const { createMetadata } = createMetadataBuilder({
 *   applicationName: "Example Site",
 *   author: { name: "Example Site", url: "https://example.com/" },
 *   publisher: "Example Site",
 *   twitterHandle: "@example",
 *   supportedLocales: ["en", "es"],
 * });
 * ```
 */
export const createMetadataBuilder = (config: SeoConfig) => {
	const {
		applicationName,
		author,
		publisher,
		twitterHandle,
		defaultOgImagePath = "/opengraph-image",
		supportedLocales = ["en"] as const,
		defaultLocale = "en",
		openGraphLocaleMap = {},
	} = config;

	const knownLocales = new Set<string>(supportedLocales);

	// Map locale code to OpenGraph locale format (e.g. "en" -> "en_US").
	const getOpenGraphLocale = (locale?: string): string => {
		const loc = locale || defaultLocale;
		return openGraphLocaleMap[loc] ?? `${loc}_${loc.toUpperCase()}`;
	};

	/**
	 * Match a canonical path of the form "/{locale}" or "/{locale}/{rest}".
	 * Returns the locale + the remainder (with leading slash, or empty for locale-root).
	 */
	const matchLocaleCanonical = (
		canonical: string,
	): { locale: string; rest: string } | null => {
		const match = canonical.match(/^\/([a-z]{2})(\/.*)?$/);
		if (!match) return null;
		const locale = match[1];
		if (!knownLocales.has(locale)) return null;
		return { locale, rest: match[2] ?? "" };
	};

	/**
	 * Infer locale from the canonical alternate path (e.g. "/en/about" -> "en").
	 * Falls back to undefined if no locale segment is found.
	 */
	const inferLocaleFromAlternates = (
		alternates?: MetadataGenerator["alternates"],
	): string | undefined => {
		if (!alternates) return undefined;
		const canonical = alternates.canonical;
		if (typeof canonical === "string") {
			return matchLocaleCanonical(canonical)?.locale;
		}
		return undefined;
	};

	/**
	 * Build hreflang `languages` map for a canonical of the form "/{locale}/{rest}".
	 * Produces an entry for each supported locale + an `x-default` pointing at the
	 * default-locale variant. Returns undefined if the canonical does not match the
	 * expected locale-prefixed pattern.
	 */
	const buildHreflangLanguages = (
		alternates?: MetadataGenerator["alternates"],
	): Record<string, string> | undefined => {
		if (!alternates) return undefined;
		const canonical = alternates.canonical;
		if (typeof canonical !== "string") return undefined;
		const matched = matchLocaleCanonical(canonical);
		if (!matched) return undefined;

		const languages: Record<string, string> = {};
		for (const loc of supportedLocales) {
			if (loc === defaultLocale) {
				languages[loc] = matched.rest === "" ? "/" : matched.rest;
			} else {
				languages[loc] = `/${loc}${matched.rest}`;
			}
		}
		languages["x-default"] = matched.rest === "" ? "/" : matched.rest;
		return languages;
	};

	const createMetadata = ({
		title,
		description,
		image,
		locale,
		...properties
	}: MetadataGenerator): Metadata => {
		// Auto-detect locale from canonical path when not explicitly provided
		const resolvedLocale =
			locale || inferLocaleFromAlternates(properties.alternates);

		// Auto-construct hreflang `languages` from the canonical path so every page
		// rendered through this helper emits `<link rel="alternate" hreflang="...">`
		// in the HTML head. Explicit caller-provided `languages` win (we do NOT
		// clobber). See packages/seo/__tests__/metadata.test.ts "hreflang languages".
		const callerLanguages = properties.alternates?.languages;
		const autoLanguages = callerLanguages
			? undefined
			: buildHreflangLanguages(properties.alternates);
		if (autoLanguages && properties.alternates) {
			properties = {
				...properties,
				alternates: {
					...properties.alternates,
					languages: autoLanguages,
				},
			};
		}

		// Normalize canonical link for the default locale to omit its path prefix
		if (
			properties.alternates &&
			typeof properties.alternates.canonical === "string"
		) {
			const matched = matchLocaleCanonical(properties.alternates.canonical);
			if (matched && matched.locale === defaultLocale) {
				properties.alternates.canonical =
					matched.rest === "" ? "/" : matched.rest;
			}
		}

		const parsedTitle = title.includes(applicationName)
			? title
			: `${title} | ${applicationName}`;
		const defaultMetadata: Metadata = {
			title: parsedTitle,
			description,
			applicationName,
			authors: [author],
			creator: author.name,
			formatDetection: {
				telephone: false,
			},
			appleWebApp: {
				capable: true,
				statusBarStyle: "default",
				title: parsedTitle,
			},
			openGraph: {
				title: parsedTitle,
				description,
				type: "website",
				siteName: applicationName,
				locale: getOpenGraphLocale(resolvedLocale),
			},
			publisher,
			twitter: {
				card: "summary_large_image",
				creator: twitterHandle,
				title: parsedTitle,
				description,
			},
		};

		const metadata: Metadata = merge(defaultMetadata, properties);

		const resolvedImage = image ?? defaultOgImagePath;
		if (metadata.openGraph && !metadata.openGraph.images) {
			metadata.openGraph.images = [
				{
					url: resolvedImage,
					width: 1200,
					height: 630,
					alt: title,
				},
			];
		}
		if (metadata.twitter && !("images" in metadata.twitter)) {
			(metadata.twitter as { images?: string[] }).images = [resolvedImage];
		}

		return metadata;
	};

	return { createMetadata, getOpenGraphLocale, matchLocaleCanonical };
};
