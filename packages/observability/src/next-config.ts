/**
 * Optional Next.js config wrapper. Apps that opt into the BetterStack
 * client-side proxy can call this from their `next.config`:
 *
 *   import { withObservability } from "@fxyz/observability/next-config";
 *   export default withObservability(nextConfig);
 *
 * It adds two rewrites under `/_betterstack/*` so client-side web-vitals
 * + log POSTs proxy through the same origin (avoiding cross-origin
 * cookies + bot-fight rules). NOOP when env vars are missing.
 */
import type { NextConfig } from "next";
import { resolveIngestUrl, resolveSourceToken } from "./keys";

export const withObservability = (config: NextConfig): NextConfig => {
	const token = resolveSourceToken();
	const ingest = resolveIngestUrl();
	if (!token || !ingest) return config;

	// Mirror what @logtail/next's `withBetterStackNextConfig` does, but
	// using OUR env-resolution shim so apps need not duplicate the legacy
	// fallback logic.
	const existingRewrites = config.rewrites;
	return {
		...config,
		async rewrites() {
			const base = (await existingRewrites?.()) ?? [];
			const proxyRewrites = [
				{
					source: "/_betterstack/web-vitals",
					destination: `${ingest}/`,
					basePath: false as const,
				},
				{
					source: "/_betterstack/logs",
					destination: `${ingest}/`,
					basePath: false as const,
				},
			];
			if (Array.isArray(base)) return [...base, ...proxyRewrites];
			return {
				...base,
				afterFiles: [...(base.afterFiles ?? []), ...proxyRewrites],
			};
		},
	};
};
