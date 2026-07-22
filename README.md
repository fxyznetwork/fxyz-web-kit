# fxyz-web-kit

[![CI](https://github.com/fxyznetwork/fxyz-web-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/fxyznetwork/fxyz-web-kit/actions/workflows/ci.yml)

A small kit of standalone Next.js utilities: structured logging,
telemetry with built-in PII guardrails, locale-routing middleware, and
SEO metadata helpers.

Each package is independent — install only the ones you need.

## Packages

| Package | What it is |
|---|---|
| [`@fxyz/logger`](./packages/logger) | Structured logging for Node.js (Pino-based) plus a dependency-free browser-safe logger. |
| [`@fxyz/observability`](./packages/observability) | Error/event capture for Next.js wrapping `@logtail/next`, with PII scrubbing on every payload and a NOOP fallback when no telemetry token is configured. |
| [`@fxyz/i18n`](./packages/i18n) | Next.js App Router locale middleware, plus dictionary sync/validate/coverage scripts for JSON-based translations. |
| [`@fxyz/seo`](./packages/seo) | `createMetadata` helper for the Next.js Metadata API (title/OpenGraph/Twitter/hreflang defaults, configurable — no brand values baked in) and a JSON-LD `<script>` component. |

## Status

Pre-1.0. Public API surfaces may change between minor versions until 1.0.
Package exports for `@fxyz/observability`, `@fxyz/i18n`, and `@fxyz/seo`
point at TypeScript source directly (no prebuilt `dist`); see each
package's README for what that means for non-bundled consumers.
`@fxyz/logger` builds to `dist` via `tsup`.

## Getting started

Note: 3 of the 4 packages ship TypeScript source (not a compiled dist).
Next.js transpiles workspace/`node_modules` packages automatically;
consumers on other bundlers or plain Node need their own transpile/build
step.

```sh
pnpm add @fxyz/logger @fxyz/observability @fxyz/i18n @fxyz/seo
```

Or install only what you need. See each package's own `README.md` for
usage.

## PII scrubbing (observability)

`@fxyz/observability` deep-walks every payload passed to its live
(BetterStack-enabled) adapter and redacts it before anything leaves the
process — there is no flag to turn this off. Two passes run over each
payload (see [`packages/observability/src/scrub.ts`](./packages/observability/src/scrub.ts)):

1. **By key name** — fields named (case-insensitively) `email`, `name`,
   `password`, `token`, `secret`, `apiKey`, `privateKey`, `authorization`,
   `cookie`, `did`, and their common variants are replaced outright,
   regardless of value.
2. **By value shape** — every remaining string is scanned for
   `did:method:id`-shaped and email-shaped substrings and those substrings
   are redacted, even inside free-form text like error messages and stack
   traces.

The walk is recursive (objects, arrays, `Error` instances) and cycle-safe.
Redacted values become the literal string `"[REDACTED]"`; shape is
preserved so events stay grep-able in your telemetry UI. Example:

```ts
// input
{ user: "did:example:abc123", email: "a@b.com" }

// what reaches BetterStack
{ user: "[REDACTED]", email: "[REDACTED]" }
```

This scrubbing is unconditional in `scrubPayload` itself — it has no
environment or config switch, so it runs the same way regardless of
`NODE_ENV`. It applies to payloads sent through the *live* adapter (an
observability token configured). When no token is configured, the
package runs in NOOP mode instead: nothing is sent over the network in
either case, but in development the NOOP path prints the **raw,
unscrubbed** error to the local console for debugging — so treat local
console output as untrusted for PII the same way you would any other
local debug log.

## Development

```sh
pnpm install
pnpm typecheck   # tsc --noEmit across all packages
pnpm test        # run package test suites
```

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md)
and [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md). For security reports, see
[SECURITY.md](./SECURITY.md).

## License

[Apache License 2.0](./LICENSE) — see also [NOTICE](./NOTICE).
