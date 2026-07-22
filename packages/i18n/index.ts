import "server-only";
import type en from "./dictionaries/en.json";
import { locales as _locales } from "./locales";

// Note: For client components, import locales directly from "@fxyz/i18n/locales"
// This re-export is server-only due to the "server-only" import guard above
export const locales = _locales;

export type Dictionary = typeof en;

const dictionaries: Record<string, () => Promise<Dictionary>> = {
	en: () => import("./dictionaries/en.json").then((mod) => mod.default),
	es: () => import("./dictionaries/es.json").then((mod) => mod.default),
};

export const getDictionary = async (locale: string): Promise<Dictionary> => {
	const normalizedLocale = locale.split("-")[0];

	if (!locales.includes(normalizedLocale as (typeof locales)[number])) {
		return dictionaries.en();
	}

	try {
		return await dictionaries[normalizedLocale]();
	} catch (_error) {
		return dictionaries.en();
	}
};
