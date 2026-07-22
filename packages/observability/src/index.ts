/**
 * @fxyz/observability — server-side
 *
 * Thin wrapper around @logtail/next that:
 *   - NOOPs when BETTER_STACK_SOURCE_TOKEN / BETTERSTACK_API_KEY is missing
 *     (dev, preview, CI), so importing this module never throws.
 *   - Scrubs PII before any event leaves the process (see ./scrub).
 *   - Tags every event with DEPLOYMENT_COMMIT_SHA + DEPLOYMENT_ID so
 *     multi-host deployments can be sliced per-host in the telemetry UI.
 *   - Exposes `captureError`, `captureMessage`, `flush`, and an
 *     `onRequestError` Next.js instrumentation hook.
 */
import { Logger, LogLevel } from "@logtail/next";
import {
	isObservabilityEnabled,
	resolveIngestUrl,
	resolveSourceToken,
} from "./keys";
import { scrubPayload } from "./scrub";

export type ObservabilityContext = Record<string, unknown>;

interface ObservabilityAdapter {
	readonly enabled: boolean;
	captureError(error: unknown, context?: ObservabilityContext): Promise<void>;
	captureMessage(
		message: string,
		level?: "debug" | "info" | "warn" | "error",
		context?: ObservabilityContext,
	): Promise<void>;
	flush(): Promise<void>;
}

const sourceTagFromEnv = (): Record<string, string | undefined> => ({
	deploymentCommit: process.env.DEPLOYMENT_COMMIT_SHA,
	deploymentId: process.env.DEPLOYMENT_ID,
	hostname: process.env.HOSTNAME,
	nodeEnv: process.env.NODE_ENV,
});

/**
 * NOOP adapter used when env vars are missing. Mirrors the live adapter's
 * surface so callers never have to branch on enabled/disabled. Errors
 * still surface to stderr so dev workflows are not silently swallowed.
 */
const noopAdapter: ObservabilityAdapter = {
	enabled: false,
	async captureError(error, context) {
		if (process.env.NODE_ENV !== "production") {
			// Dev mode: print to stderr so the dev still sees the error.
			console.error("[observability:noop]", error, context ?? "");
		}
	},
	async captureMessage(message, level = "info", context) {
		if (process.env.NODE_ENV !== "production") {
			const fn =
				level === "error"
					? console.error
					: level === "warn"
						? console.warn
						: console.log;
			fn(`[observability:noop:${level}]`, message, context ?? "");
		}
	},
	async flush() {
		/* noop */
	},
};

const buildLiveAdapter = (): ObservabilityAdapter => {
	// Project token + URL are read by @logtail/next from process.env. We
	// already validated their presence in `isObservabilityEnabled`. The
	// SDK reads `BETTER_STACK_SOURCE_TOKEN` and `BETTER_STACK_INGESTING_URL`
	// directly.
	//
	// We project the source token / URL from the legacy env names into the
	// SDK's canonical names BEFORE we instantiate the logger, so callers
	// migrating from the legacy names don't have to change anything else.
	if (
		!process.env.BETTER_STACK_SOURCE_TOKEN &&
		process.env.BETTERSTACK_API_KEY
	) {
		process.env.BETTER_STACK_SOURCE_TOKEN = process.env.BETTERSTACK_API_KEY;
	}
	if (!process.env.BETTER_STACK_INGESTING_URL && process.env.BETTERSTACK_URL) {
		process.env.BETTER_STACK_INGESTING_URL = process.env.BETTERSTACK_URL;
	}

	const baseLogger = new Logger({
		source: "app-server",
		args: scrubPayload(sourceTagFromEnv()),
	});

	return {
		enabled: true,
		async captureError(error, context) {
			const scrubbedContext = context ? scrubPayload(context) : undefined;
			const err = error instanceof Error ? error : new Error(String(error));
			const scrubbedMessage =
				scrubPayload({ message: err.message }).message ?? "Unknown error";
			baseLogger.error(scrubbedMessage, {
				...(scrubbedContext ?? {}),
				errorName: err.name,
				stack: err.stack ? scrubPayload(err.stack) : undefined,
			});
			await baseLogger.flush();
		},
		async captureMessage(message, level = "info", context) {
			const scrubbedContext = context ? scrubPayload(context) : undefined;
			const scrubbedMessage =
				scrubPayload({ message }).message ?? "Unknown message";
			const args = scrubbedContext ?? {};
			switch (level) {
				case "error":
					baseLogger.error(scrubbedMessage, args);
					break;
				case "warn":
					baseLogger.warn(scrubbedMessage, args);
					break;
				case "debug":
					baseLogger.debug(scrubbedMessage, args);
					break;
				default:
					baseLogger.info(scrubbedMessage, args);
			}
			await baseLogger.flush();
		},
		async flush() {
			await baseLogger.flush();
		},
	};
};

let cachedAdapter: ObservabilityAdapter | undefined;

/**
 * Return the active adapter. Lazily constructed so that NOOP imports in
 * tests / dev do not touch the SDK.
 */
export const getObservability = (): ObservabilityAdapter => {
	if (cachedAdapter) return cachedAdapter;
	cachedAdapter = isObservabilityEnabled() ? buildLiveAdapter() : noopAdapter;
	return cachedAdapter;
};

/**
 * Resettable for tests. Production code should never call this.
 */
export const __resetObservabilityForTests = (): void => {
	cachedAdapter = undefined;
};

export const captureError = (
	error: unknown,
	context?: ObservabilityContext,
): Promise<void> => getObservability().captureError(error, context);

export const captureMessage = (
	message: string,
	level?: "debug" | "info" | "warn" | "error",
	context?: ObservabilityContext,
): Promise<void> => getObservability().captureMessage(message, level, context);

export const flushObservability = (): Promise<void> =>
	getObservability().flush();

/**
 * Next.js instrumentation hook. Wire this from each app's
 * `instrumentation.ts` like so:
 *
 *   export { register, onRequestError } from "@fxyz/observability/instrumentation";
 *
 * `onRequestError` is the Next.js 15+ hook fired for unhandled errors
 * in routes / RSC / server actions.
 */
export const onRequestError = async (
	error: unknown,
	request: {
		path?: string;
		method?: string;
		headers?: Record<string, string | string[] | undefined>;
	},
	context: {
		routerKind: "Pages Router" | "App Router";
		routePath?: string;
		routeType?: "render" | "route" | "action" | "middleware";
	},
): Promise<void> => {
	await captureError(error, {
		path: request.path,
		method: request.method,
		routerKind: context.routerKind,
		routePath: context.routePath,
		routeType: context.routeType,
	});
};

export {
	isObservabilityEnabled,
	LogLevel,
	resolveIngestUrl,
	resolveSourceToken,
};
