import pino from "pino";

// Determine environment
const isDev = process.env.NODE_ENV === "development";
const isTest = process.env.NODE_ENV === "test";
const logLevel = process.env.LOG_LEVEL || (isDev ? "debug" : "info");

// Create base logger configuration
const pinoConfig: pino.LoggerOptions = {
	level: isTest ? "silent" : logLevel,
	...(isDev && {
		transport: {
			target: "pino-pretty",
			options: {
				colorize: true,
				translateTime: "HH:MM:ss.l",
				ignore: "pid,hostname",
				singleLine: false,
			},
		},
	}),
	...(!isDev && {
		formatters: {
			level: (label: string) => {
				return { level: label };
			},
		},
	}),
};

// Create base logger
export const logger = pino(pinoConfig);

/**
 * Console-compatible logger interface.
 *
 * Wraps pino's child logger to accept console-style variadic arguments:
 *   logger.error("message:", error)   -- works like console.error
 *   logger.info("fetched", { count }) -- works like console.log
 *   logger.error(error, "message")    -- also works (pino-native style)
 */
export interface ConsoleCompatibleLogger {
	debug: (...args: unknown[]) => void;
	info: (...args: unknown[]) => void;
	warn: (...args: unknown[]) => void;
	error: (...args: unknown[]) => void;
	fatal: (...args: unknown[]) => void;
	child: (bindings: Record<string, unknown>) => ConsoleCompatibleLogger;
}

function wrapMethod(
	pinoLogger: pino.Logger,
	level: "debug" | "info" | "warn" | "error" | "fatal",
) {
	return (...args: unknown[]) => {
		if (args.length === 0) {
			pinoLogger[level]("");
			return;
		}

		// Single string argument - pass through
		if (args.length === 1 && typeof args[0] === "string") {
			pinoLogger[level](args[0]);
			return;
		}

		// Pino-native: first arg is Error or object, second is string
		if (args.length >= 1 && typeof args[0] === "object" && args[0] !== null) {
			if (args[0] instanceof Error) {
				pinoLogger[level](
					args[0],
					args.length > 1 ? String(args[1]) : args[0].message,
				);
				return;
			}
			if (typeof args[1] === "string") {
				pinoLogger[level](args[0] as Record<string, unknown>, args[1]);
				return;
			}
		}

		// Console-style: first arg is string, rest are data
		if (typeof args[0] === "string") {
			const message = args[0];
			const rest = args.slice(1);

			if (rest.length === 0) {
				pinoLogger[level](message);
			} else if (rest.length === 1 && rest[0] instanceof Error) {
				pinoLogger[level]({ err: rest[0] }, message);
			} else if (
				rest.length === 1 &&
				typeof rest[0] === "object" &&
				rest[0] !== null
			) {
				pinoLogger[level](rest[0] as Record<string, unknown>, message);
			} else {
				// Multiple args: join as message
				const fullMessage = args
					.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
					.join(" ");
				pinoLogger[level](fullMessage);
			}
			return;
		}

		// Fallback: stringify everything
		const message = args
			.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
			.join(" ");
		pinoLogger[level](message);
	};
}

function wrapPinoLogger(pinoLogger: pino.Logger): ConsoleCompatibleLogger {
	return {
		debug: wrapMethod(pinoLogger, "debug"),
		info: wrapMethod(pinoLogger, "info"),
		warn: wrapMethod(pinoLogger, "warn"),
		error: wrapMethod(pinoLogger, "error"),
		fatal: wrapMethod(pinoLogger, "fatal"),
		child: (bindings: Record<string, unknown>) =>
			wrapPinoLogger(pinoLogger.child(bindings)),
	};
}

// Create child logger with context
export function createLogger(context: string): ConsoleCompatibleLogger {
	return wrapPinoLogger(logger.child({ context }));
}

// Re-export types
export type { Logger } from "pino";

// Helper types for structured logging
export interface LogContext {
	[key: string]: unknown;
}

// Convenience methods compatible with console.log syntax
export const log = {
	debug: (...args: unknown[]) => {
		const message = args
			.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
			.join(" ");
		logger.debug(message);
	},
	info: (...args: unknown[]) => {
		const message = args
			.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
			.join(" ");
		logger.info(message);
	},
	warn: (...args: unknown[]) => {
		const message = args
			.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
			.join(" ");
		logger.warn(message);
	},
	error: (...args: unknown[]) => {
		const message = args
			.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
			.join(" ");
		logger.error(message);
	},
	fatal: (...args: unknown[]) => {
		const message = args
			.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
			.join(" ");
		logger.fatal(message);
	},
};

// Default export
export default logger;
