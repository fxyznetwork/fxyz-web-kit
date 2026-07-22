/**
 * @fxyz/observability/client — browser-safe
 *
 * Client-side error capture for Next.js apps. Browser builds should not
 * directly hold a BetterStack source token unless you deliberately opt in
 * (it would be exposed in the client bundle).
 *
 * Strategy: client errors are POSTed to a server route on the same app,
 * which then uses @fxyz/observability (server-side) to forward to
 * BetterStack with full PII scrubbing.
 *
 * When NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN is set, we ALSO use the
 * @logtail/next browser logger directly — this is opt-in for apps that
 * want client-side telemetry without a server round-trip. Default is
 * "post to /api/_observability/client".
 */
import { Logger } from "@logtail/next";

const REDACTED = "[REDACTED]";
const DID_RE = /did:[a-z0-9]+:[a-zA-Z0-9._-]+/g;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const scrubMessage = (s: string): string =>
	s.replace(DID_RE, REDACTED).replace(EMAIL_RE, REDACTED);

const scrubArgs = (
	args: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined => {
	if (!args) return undefined;
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(args)) {
		if (/email|name|password|token|secret|did|cookie|authorization/i.test(k)) {
			out[k] = REDACTED;
			continue;
		}
		if (typeof v === "string") {
			out[k] = scrubMessage(v);
		} else if (v instanceof Error) {
			out[k] = {
				name: v.name,
				message: scrubMessage(v.message),
				stack: v.stack ? scrubMessage(v.stack) : undefined,
			};
		} else {
			out[k] = v;
		}
	}
	return out;
};

const hasPublicToken = (): boolean =>
	typeof process !== "undefined" &&
	!!process.env.NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN &&
	!!process.env.NEXT_PUBLIC_BETTER_STACK_INGESTING_URL;

let cachedLogger: Logger | undefined;

const getLogger = (): Logger | undefined => {
	if (!hasPublicToken()) return undefined;
	if (cachedLogger) return cachedLogger;
	cachedLogger = new Logger({ source: "app-client" });
	return cachedLogger;
};

const postToServer = async (
	level: "info" | "warn" | "error",
	message: string,
	args?: Record<string, unknown>,
): Promise<void> => {
	if (typeof window === "undefined") return;
	try {
		await fetch("/api/_observability/client", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				level,
				message,
				args,
				url: window.location.pathname,
				userAgent: navigator.userAgent,
				timestamp: new Date().toISOString(),
			}),
			keepalive: true,
		});
	} catch {
		// Swallow — failing to log should never break the UI.
	}
};

export const captureClientError = async (
	error: unknown,
	context?: Record<string, unknown>,
): Promise<void> => {
	const err = error instanceof Error ? error : new Error(String(error));
	const scrubbedMessage = scrubMessage(err.message);
	const scrubbedContext = scrubArgs(context);
	const args = {
		...(scrubbedContext ?? {}),
		errorName: err.name,
		stack: err.stack ? scrubMessage(err.stack) : undefined,
	};

	const logger = getLogger();
	if (logger) {
		logger.error(scrubbedMessage, args);
		await logger.flush();
		return;
	}
	await postToServer("error", scrubbedMessage, args);
};

export const captureClientMessage = async (
	message: string,
	level: "info" | "warn" | "error" = "info",
	context?: Record<string, unknown>,
): Promise<void> => {
	const scrubbedMessage = scrubMessage(message);
	const scrubbedContext = scrubArgs(context);

	const logger = getLogger();
	if (logger) {
		switch (level) {
			case "error":
				logger.error(scrubbedMessage, scrubbedContext);
				break;
			case "warn":
				logger.warn(scrubbedMessage, scrubbedContext);
				break;
			default:
				logger.info(scrubbedMessage, scrubbedContext);
		}
		await logger.flush();
		return;
	}
	await postToServer(level, scrubbedMessage, scrubbedContext);
};

/**
 * Install a global `window.onerror` + `window.onunhandledrejection`
 * handler. Call once at app bootstrap (e.g. in a top-level layout).
 *
 * Returns a teardown function for tests.
 */
export const installClientErrorHandlers = (): (() => void) => {
	if (typeof window === "undefined") return () => {};

	const onError = (event: ErrorEvent): void => {
		void captureClientError(event.error ?? event.message, {
			filename: event.filename,
			line: event.lineno,
			column: event.colno,
		});
	};

	const onRejection = (event: PromiseRejectionEvent): void => {
		void captureClientError(event.reason, { kind: "unhandledrejection" });
	};

	window.addEventListener("error", onError);
	window.addEventListener("unhandledrejection", onRejection);

	return () => {
		window.removeEventListener("error", onError);
		window.removeEventListener("unhandledrejection", onRejection);
	};
};
