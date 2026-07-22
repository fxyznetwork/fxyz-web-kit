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

```sh
pnpm add @fxyz/logger @fxyz/observability @fxyz/i18n @fxyz/seo
```

Or install only what you need. See each package's own `README.md` for
usage.

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
