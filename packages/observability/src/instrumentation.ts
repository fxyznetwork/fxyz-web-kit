/**
 * Next.js 15+ instrumentation entry point.
 *
 * Each app's `instrumentation.ts` should re-export `register` +
 * `onRequestError` from this module:
 *
 *   // app/instrumentation.ts
 *   export { register, onRequestError } from "@fxyz/observability/instrumentation";
 *
 * `register` runs ONCE per server process at boot, for both the
 * `nodejs` and `edge` runtimes. We use it to set up sane defaults
 * (commit-sha tag, source name) and to print a single-line readiness
 * log so prod boot is easy to verify in your log aggregator.
 *
 * `onRequestError` is fired by Next.js for unhandled errors in
 * pages / RSC / route handlers / server actions.
 */
import {
	captureError,
	captureMessage,
	flushObservability,
	isObservabilityEnabled,
} from "./index";

export const register = async (): Promise<void> => {
	const enabled = isObservabilityEnabled();
	const commit = process.env.DEPLOYMENT_COMMIT_SHA ?? "unknown";
	const deploymentId = process.env.DEPLOYMENT_ID ?? "unknown";

	// Single, grep-able boot line. Ops can confirm wiring via
	// `docker logs <container> | grep observability`.
	console.log(
		`[observability] register · enabled=${enabled} · commit=${commit} · deployment=${deploymentId}`,
	);

	if (enabled) {
		await captureMessage("server boot", "info", {
			event: "server.boot",
			commit,
			deploymentId,
		});
	}
};

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
	try {
		await captureError(error, {
			path: request.path,
			method: request.method,
			routerKind: context.routerKind,
			routePath: context.routePath,
			routeType: context.routeType,
		});
	} catch (capErr) {
		// Last-ditch: print to stderr so the underlying error is never silently lost.
		console.error("[observability] capture failed", capErr);
		console.error("[observability] original error", error);
	}
};

export { flushObservability };
