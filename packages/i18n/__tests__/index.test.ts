import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import { locales as clientLocales } from "../locales";

/**
 * index.ts imports "server-only" as a guard. Outside Next.js's
 * "react-server" module resolution condition, that package's default
 * export unconditionally throws ("This module cannot be imported from a
 * Client Component module"), so plain Node/Jest needs it stubbed out —
 * this is the standard pattern for testing Next.js server-only modules.
 *
 * `jest.doMock` (rather than the hoisted `jest.mock`) + a dynamic
 * `import()` guarantees the mock is registered before "../index" (and
 * transitively "server-only") is ever loaded, without depending on the
 * transform's mock-hoisting behavior.
 */
let getDictionary: typeof import("../index").getDictionary;
let locales: typeof import("../index").locales;

beforeAll(async () => {
	jest.doMock("server-only", () => ({}));
	({ getDictionary, locales } = await import("../index"));
});

describe("locales", () => {
	it("derives from languine.json (source + targets)", () => {
		expect(locales).toEqual(["en", "es"]);
	});

	it("exports the same list from the client-safe entry point", () => {
		expect(clientLocales).toEqual(locales);
	});
});

describe("getDictionary", () => {
	it("resolves the English dictionary", async () => {
		const dict = await getDictionary("en");
		expect(dict.hello).toBe("Hello");
		expect(dict.nav.home).toBe("Home");
	});

	it("resolves the Spanish dictionary", async () => {
		const dict = await getDictionary("es");
		expect(dict.hello).toBe("Hola");
		expect(dict.nav.home).toBe("Inicio");
	});

	it("normalizes region-tagged locales to their base language (es-MX -> es)", async () => {
		const dict = await getDictionary("es-MX");
		expect(dict.hello).toBe("Hola");
	});

	it("falls back to English for an unsupported locale", async () => {
		const dict = await getDictionary("fr");
		expect(dict.hello).toBe("Hello");
	});

	it("falls back to English for garbage input", async () => {
		const dict = await getDictionary("not-a-real-locale");
		expect(dict.hello).toBe("Hello");
	});
});
