/**
 * Client-safe locales export
 * This file can be imported from both client and server components.
 * For server-only utilities like getDictionary, use the main index.ts
 */
import languine from "./languine.json";

export const locales = [
	languine.locale.source,
	...languine.locale.targets,
] as const;

export type Locale = (typeof locales)[number];
