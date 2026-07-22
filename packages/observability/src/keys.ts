import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Observability env keys.
 *
 * Canonical names match the @logtail/next SDK (BetterStack's official
 * Next.js client). Legacy `BETTERSTACK_*` names are accepted as fallbacks
 * for projects migrating from an older env naming scheme.
 *
 * Leave these empty in dev / preview / CI and the observability adapter
 * falls back to NOOP mode.
 */
export const keys = () =>
	createEnv({
		server: {
			BETTER_STACK_SOURCE_TOKEN: z.string().min(1).optional(),
			BETTER_STACK_INGESTING_URL: z.url().optional(),
			// Legacy aliases — kept for backward compatibility.
			BETTERSTACK_API_KEY: z.string().min(1).optional(),
			BETTERSTACK_URL: z.url().optional(),
			// Deployment tags — propagated to every event for slice/dice.
			DEPLOYMENT_COMMIT_SHA: z.string().optional(),
			DEPLOYMENT_ID: z.string().optional(),
		},
		client: {
			NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN: z.string().min(1).optional(),
			NEXT_PUBLIC_BETTER_STACK_INGESTING_URL: z.url().optional(),
		},
		runtimeEnv: {
			BETTER_STACK_SOURCE_TOKEN:
				process.env.BETTER_STACK_SOURCE_TOKEN ??
				process.env.BETTERSTACK_API_KEY,
			BETTER_STACK_INGESTING_URL:
				process.env.BETTER_STACK_INGESTING_URL ?? process.env.BETTERSTACK_URL,
			BETTERSTACK_API_KEY: process.env.BETTERSTACK_API_KEY,
			BETTERSTACK_URL: process.env.BETTERSTACK_URL,
			DEPLOYMENT_COMMIT_SHA: process.env.DEPLOYMENT_COMMIT_SHA,
			DEPLOYMENT_ID: process.env.DEPLOYMENT_ID,
			NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN:
				process.env.NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN,
			NEXT_PUBLIC_BETTER_STACK_INGESTING_URL:
				process.env.NEXT_PUBLIC_BETTER_STACK_INGESTING_URL,
		},
		skipValidation:
			process.env.NODE_ENV === "development" ||
			process.env.SKIP_ENV_VALIDATION === "1" ||
			process.env.CI === "true" ||
			process.env.NODE_ENV === "test",
	});

/**
 * Resolve the active source token, preferring the canonical name and
 * falling back to the legacy `BETTERSTACK_API_KEY`. Returns undefined
 * when neither is set — callers must treat absence as NOOP mode.
 */
export const resolveSourceToken = (): string | undefined =>
	process.env.BETTER_STACK_SOURCE_TOKEN ??
	process.env.BETTERSTACK_API_KEY ??
	undefined;

/**
 * Resolve the active ingest URL the same way.
 */
export const resolveIngestUrl = (): string | undefined =>
	process.env.BETTER_STACK_INGESTING_URL ??
	process.env.BETTERSTACK_URL ??
	undefined;

/**
 * True when an explicit source token AND ingest URL are present. The SDK
 * requires both to send events.
 */
export const isObservabilityEnabled = (): boolean =>
	!!resolveSourceToken() && !!resolveIngestUrl();
