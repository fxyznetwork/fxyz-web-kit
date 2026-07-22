/**
 * Shared Jest + SWC config for all fxyz-web-kit packages.
 *
 * Packages ship raw TypeScript (no ts-jest, no babel config in this repo),
 * so tests are transformed with @swc/jest. We force `module.type:
 * "commonjs"` regardless of a package's own package.json `"type"` field so
 * Jest's default CommonJS test runtime can load the transformed output
 * without needing `--experimental-vm-modules`.
 *
 * Each package's own jest.config.cjs re-exports this file:
 *
 *   module.exports = require("../../jest.preset.cjs");
 */

/** @type {import('jest').Config} */
module.exports = {
	testEnvironment: "node",
	transform: {
		"^.+\\.(t|j)sx?$": [
			"@swc/jest",
			{
				jsc: {
					parser: { syntax: "typescript", tsx: true },
					target: "es2022",
					transform: { react: { runtime: "automatic" } },
				},
				module: { type: "commonjs" },
				sourceMaps: "inline",
			},
		],
	},
	moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
	testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
	clearMocks: true,
};
