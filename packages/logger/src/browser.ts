/**
 * Browser-Safe Logger
 *
 * Lightweight logger for client-side components that wraps console.*
 * with structured prefixes. No dependency on pino (which requires Node.js).
 *
 * Usage:
 *   import { createBrowserLogger } from '@fxyz/logger/browser';
 *   const logger = createBrowserLogger('business:page');
 *   logger.info('Page loaded', { userId: '123' });
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface BrowserLogger {
	debug: (...args: unknown[]) => void;
	info: (...args: unknown[]) => void;
	warn: (...args: unknown[]) => void;
	error: (...args: unknown[]) => void;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

function getMinLevel(): LogLevel {
	if (
		typeof process !== "undefined" &&
		process.env?.NODE_ENV === "production"
	) {
		return "info";
	}
	return "debug";
}

function shouldLog(level: LogLevel): boolean {
	const minLevel = getMinLevel();
	return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
}

export function createBrowserLogger(name: string): BrowserLogger {
	const prefix = `[${name}]`;

	return {
		debug: (...args: unknown[]) => {
			if (shouldLog("debug")) {
				console.debug(prefix, ...args);
			}
		},
		info: (...args: unknown[]) => {
			if (shouldLog("info")) {
				console.log(prefix, ...args);
			}
		},
		warn: (...args: unknown[]) => {
			if (shouldLog("warn")) {
				console.warn(prefix, ...args);
			}
		},
		error: (...args: unknown[]) => {
			if (shouldLog("error")) {
				console.error(prefix, ...args);
			}
		},
	};
}
