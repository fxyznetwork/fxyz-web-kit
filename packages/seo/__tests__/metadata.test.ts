import { describe, expect, it } from "@jest/globals";
import { createMetadataBuilder } from "../metadata";

const baseConfig = {
	applicationName: "Example Site",
	author: { name: "Example Site", url: "https://example.com/" },
	publisher: "Example Site",
	twitterHandle: "@example",
	supportedLocales: ["en", "es"],
	defaultLocale: "en",
	openGraphLocaleMap: { en: "en_US", es: "es_ES" },
};

describe("createMetadataBuilder", () => {
	describe("title + core fields", () => {
		it("appends applicationName to the title when not already present", () => {
			const { createMetadata } = createMetadataBuilder(baseConfig);
			const metadata = createMetadata({
				title: "Home",
				description: "Example site homepage.",
			});
			expect(metadata.title).toBe("Home | Example Site");
		});

		it("does not double-append applicationName when already present", () => {
			const { createMetadata } = createMetadataBuilder(baseConfig);
			const metadata = createMetadata({
				title: "Example Site",
				description: "Example site homepage.",
			});
			expect(metadata.title).toBe("Example Site");
		});

		it("falls back to defaultOgImagePath when no image is given", () => {
			const { createMetadata } = createMetadataBuilder(baseConfig);
			const metadata = createMetadata({
				title: "Home",
				description: "desc",
			});
			expect(metadata.openGraph?.images).toEqual([
				{
					url: "/opengraph-image",
					width: 1200,
					height: 630,
					alt: "Home",
				},
			]);
		});
	});

	describe("getOpenGraphLocale", () => {
		it("maps a locale using the explicit openGraphLocaleMap", () => {
			const { getOpenGraphLocale } = createMetadataBuilder(baseConfig);
			expect(getOpenGraphLocale("en")).toBe("en_US");
			expect(getOpenGraphLocale("es")).toBe("es_ES");
		});

		it("derives ${locale}_${LOCALE} for locales missing from the map", () => {
			const { getOpenGraphLocale } = createMetadataBuilder({
				...baseConfig,
				openGraphLocaleMap: {},
			});
			expect(getOpenGraphLocale("fr")).toBe("fr_FR");
		});

		it("uses defaultLocale when no locale is passed", () => {
			const { getOpenGraphLocale } = createMetadataBuilder(baseConfig);
			expect(getOpenGraphLocale()).toBe("en_US");
		});
	});

	describe("matchLocaleCanonical", () => {
		it("matches a bare locale-root canonical", () => {
			const { matchLocaleCanonical } = createMetadataBuilder(baseConfig);
			expect(matchLocaleCanonical("/en")).toEqual({ locale: "en", rest: "" });
		});

		it("matches a locale-prefixed canonical with a path", () => {
			const { matchLocaleCanonical } = createMetadataBuilder(baseConfig);
			expect(matchLocaleCanonical("/es/about")).toEqual({
				locale: "es",
				rest: "/about",
			});
		});

		it("returns null for a canonical with no locale prefix", () => {
			const { matchLocaleCanonical } = createMetadataBuilder(baseConfig);
			expect(matchLocaleCanonical("/about")).toBeNull();
		});

		it("returns null for a locale segment that isn't a supported locale", () => {
			const { matchLocaleCanonical } = createMetadataBuilder(baseConfig);
			expect(matchLocaleCanonical("/xx/about")).toBeNull();
		});
	});

	describe("hreflang languages", () => {
		it("auto-builds hreflang languages for a locale-prefixed canonical", () => {
			const { createMetadata } = createMetadataBuilder(baseConfig);
			const metadata = createMetadata({
				title: "About",
				description: "desc",
				alternates: { canonical: "/es/about" },
			});
			expect(metadata.alternates?.languages).toEqual({
				en: "/about",
				es: "/es/about",
				"x-default": "/about",
			});
		});

		it("points x-default and the default locale at the locale-root path", () => {
			const { createMetadata } = createMetadataBuilder(baseConfig);
			const metadata = createMetadata({
				title: "Home",
				description: "desc",
				alternates: { canonical: "/es" },
			});
			expect(metadata.alternates?.languages).toEqual({
				en: "/",
				es: "/es",
				"x-default": "/",
			});
		});

		it("does not clobber caller-provided alternates.languages", () => {
			const { createMetadata } = createMetadataBuilder(baseConfig);
			const explicitLanguages = { en: "/custom-en", es: "/custom-es" };
			const metadata = createMetadata({
				title: "About",
				description: "desc",
				alternates: {
					canonical: "/es/about",
					languages: explicitLanguages,
				},
			});
			expect(metadata.alternates?.languages).toEqual(explicitLanguages);
		});

		it("skips hreflang generation for a non-locale-prefixed canonical", () => {
			const { createMetadata } = createMetadataBuilder(baseConfig);
			const metadata = createMetadata({
				title: "About",
				description: "desc",
				alternates: { canonical: "/about" },
			});
			expect(metadata.alternates?.languages).toBeUndefined();
			expect(metadata.alternates?.canonical).toBe("/about");
		});

		it("normalizes the default-locale canonical to omit its path prefix", () => {
			const { createMetadata } = createMetadataBuilder(baseConfig);
			const metadata = createMetadata({
				title: "About",
				description: "desc",
				alternates: { canonical: "/en/about" },
			});
			expect(metadata.alternates?.canonical).toBe("/about");
		});

		it("leaves a non-default-locale canonical path untouched", () => {
			const { createMetadata } = createMetadataBuilder(baseConfig);
			const metadata = createMetadata({
				title: "About",
				description: "desc",
				alternates: { canonical: "/es/about" },
			});
			expect(metadata.alternates?.canonical).toBe("/es/about");
		});

		it("auto-detects the OpenGraph locale from the canonical path", () => {
			const { createMetadata } = createMetadataBuilder(baseConfig);
			const metadata = createMetadata({
				title: "About",
				description: "desc",
				alternates: { canonical: "/es/about" },
			});
			expect(metadata.openGraph?.locale).toBe("es_ES");
		});
	});
});
