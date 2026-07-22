import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	jest,
} from "@jest/globals";

/**
 * These tests exercise the console-compatible argument-shape dispatch in
 * `wrapMethod` (packages/logger/src/index.ts) — the "core formatting"
 * logic that lets callers use either console-style
 * (`logger.error("msg:", err)`) or pino-native
 * (`logger.error(err, "msg")`) call shapes.
 *
 * `wrapMethod`/`wrapPinoLogger` are not exported, so we drive them through
 * the public `createLogger` API and assert on calls made to a mocked
 * `pino` logger — this avoids depending on pino's real stdout transport
 * (which the module silences via `level: "silent"` under NODE_ENV=test
 * anyway) while still asserting the exact shape each call produces.
 */

type MockPinoLogger = {
	debug: jest.Mock;
	info: jest.Mock;
	warn: jest.Mock;
	error: jest.Mock;
	fatal: jest.Mock;
	child: jest.Mock;
};

const makeMockPinoLogger = (): MockPinoLogger => {
	const mockLogger = {
		debug: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		fatal: jest.fn(),
		child: jest.fn(),
	} as MockPinoLogger;
	mockLogger.child.mockImplementation(() => makeMockPinoLogger());
	return mockLogger;
};

describe("createLogger (console-compatible pino wrapper)", () => {
	let mockRootLogger: MockPinoLogger;
	let mockChildLogger: MockPinoLogger;
	let createLogger: typeof import("../index").createLogger;

	beforeEach(async () => {
		jest.resetModules();
		mockChildLogger = makeMockPinoLogger();
		mockRootLogger = makeMockPinoLogger();
		mockRootLogger.child.mockReturnValue(mockChildLogger);

		jest.doMock("pino", () => ({
			__esModule: true,
			default: jest.fn(() => mockRootLogger),
		}));

		({ createLogger } = await import("../index"));
	});

	afterEach(() => {
		jest.dontMock("pino");
	});

	it("binds a child logger with the given context", () => {
		createLogger("business:page");
		expect(mockRootLogger.child).toHaveBeenCalledWith({
			context: "business:page",
		});
	});

	it("passes no args through as an empty message", () => {
		const log = createLogger("ctx");
		log.info();
		expect(mockChildLogger.info).toHaveBeenCalledWith("");
	});

	it("passes a single string straight through", () => {
		const log = createLogger("ctx");
		log.info("hello");
		expect(mockChildLogger.info).toHaveBeenCalledWith("hello");
	});

	it("pino-native style: Error then message string", () => {
		const log = createLogger("ctx");
		const err = new Error("boom");
		log.error(err, "context msg");
		expect(mockChildLogger.error).toHaveBeenCalledWith(err, "context msg");
	});

	it("pino-native style: Error alone falls back to err.message", () => {
		const log = createLogger("ctx");
		const err = new Error("boom");
		log.error(err);
		expect(mockChildLogger.error).toHaveBeenCalledWith(err, "boom");
	});

	it("pino-native style: object then message string", () => {
		const log = createLogger("ctx");
		log.info({ foo: 1 }, "bar");
		expect(mockChildLogger.info).toHaveBeenCalledWith({ foo: 1 }, "bar");
	});

	it("console-style: message string then Error wraps it as { err }", () => {
		const log = createLogger("ctx");
		const err = new Error("failed");
		log.error("failed:", err);
		expect(mockChildLogger.error).toHaveBeenCalledWith({ err }, "failed:");
	});

	it("console-style: message string then a single data object", () => {
		const log = createLogger("ctx");
		log.info("fetched", { count: 3 });
		expect(mockChildLogger.info).toHaveBeenCalledWith({ count: 3 }, "fetched");
	});

	it("console-style: multiple trailing args are joined into the message", () => {
		const log = createLogger("ctx");
		log.info("a", "b", "c");
		expect(mockChildLogger.info).toHaveBeenCalledWith("a b c");
	});

	it("fallback: a lone non-string, non-object arg is stringified", () => {
		const log = createLogger("ctx");
		log.info(42);
		expect(mockChildLogger.info).toHaveBeenCalledWith("42");
	});

	it("child() re-binds with merged bindings and stays console-compatible", () => {
		const log = createLogger("ctx");
		const nested = log.child({ requestId: "abc" });

		expect(mockChildLogger.child).toHaveBeenCalledWith({ requestId: "abc" });

		nested.warn("nested warning");
		const grandchild = mockChildLogger.child.mock.results[0]
			?.value as MockPinoLogger;
		expect(grandchild.warn).toHaveBeenCalledWith("nested warning");
	});
});
