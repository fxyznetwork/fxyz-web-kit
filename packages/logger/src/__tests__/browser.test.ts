import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	jest,
} from "@jest/globals";
import { createBrowserLogger } from "../browser";

// NODE_ENV is typed readonly (via Next.js's global ProcessEnv
// augmentation, pulled in transitively through this package's
// devDependencies). Object.assign bypasses the readonly-property
// assignment check while still mutating the real process.env.
const setNodeEnv = (value: string | undefined): void => {
	Object.assign(process.env, { NODE_ENV: value });
};

describe("createBrowserLogger", () => {
	const originalNodeEnv = process.env.NODE_ENV;

	afterEach(() => {
		setNodeEnv(originalNodeEnv);
		jest.restoreAllMocks();
	});

	it("prefixes every log line with [name]", () => {
		const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
		const logger = createBrowserLogger("business:page");

		logger.info("Page loaded", { userId: "123" });

		expect(logSpy).toHaveBeenCalledWith(
			"[business:page]",
			"Page loaded",
			{ userId: "123" },
		);
	});

	it("routes each level to its matching console method", () => {
		const debugSpy = jest.spyOn(console, "debug").mockImplementation(() => {});
		const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
		const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
		const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
		setNodeEnv("development");
		const logger = createBrowserLogger("levels");

		logger.debug("d");
		logger.info("i");
		logger.warn("w");
		logger.error("e");

		expect(debugSpy).toHaveBeenCalledWith("[levels]", "d");
		expect(logSpy).toHaveBeenCalledWith("[levels]", "i");
		expect(warnSpy).toHaveBeenCalledWith("[levels]", "w");
		expect(errorSpy).toHaveBeenCalledWith("[levels]", "e");
	});

	it("suppresses debug-level logs when NODE_ENV=production", () => {
		setNodeEnv("production");
		const debugSpy = jest.spyOn(console, "debug").mockImplementation(() => {});
		const logger = createBrowserLogger("prod");

		logger.debug("should not print");

		expect(debugSpy).not.toHaveBeenCalled();
	});

	it("still prints info/warn/error when NODE_ENV=production", () => {
		setNodeEnv("production");
		const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
		const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
		const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
		const logger = createBrowserLogger("prod");

		logger.info("i");
		logger.warn("w");
		logger.error("e");

		expect(logSpy).toHaveBeenCalled();
		expect(warnSpy).toHaveBeenCalled();
		expect(errorSpy).toHaveBeenCalled();
	});

	it("prints debug-level logs when NODE_ENV is not production", () => {
		setNodeEnv("test");
		const debugSpy = jest.spyOn(console, "debug").mockImplementation(() => {});
		const logger = createBrowserLogger("dev");

		logger.debug("visible in dev/test");

		expect(debugSpy).toHaveBeenCalledWith("[dev]", "visible in dev/test");
	});
});
