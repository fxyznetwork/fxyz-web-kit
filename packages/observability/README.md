# @fxyz/observability

Server-side error and event capture for Next.js apps. A thin wrapper around
[`@logtail/next`](https://github.com/logtail/next) (BetterStack) that
**scrubs PII before anything leaves the process** and **NOOPs when no
source token is configured**, so importing it in dev/CI/preview never
throws.

## What it does

- `captureError(error, context)` / `captureMessage(message, level, context)` — capture to BetterStack, with PII-scrubbed payloads.
- `flushObservability()` — flush pending events.
- `onRequestError(...)` — Next.js 15+ instrumentation hook for unhandled route/RSC/server-action errors.
- Tags every event with `DEPLOYMENT_COMMIT_SHA` + `DEPLOYMENT_ID` + `HOSTNAME` so multi-host deployments can be sliced per-node in the BetterStack UI.

When the source token is absent, the **NOOP adapter** mirrors the live
adapter's surface — callers never branch on enabled/disabled. In dev, NOOP
still prints to stderr so errors aren't silently swallowed.

## Install

```sh
pnpm add @fxyz/observability
```

## Exports

| Import path | Provides |
|---|---|
| `@fxyz/observability` | `captureError`, `captureMessage`, `flushObservability`, `getObservability`, `onRequestError` |
| `@fxyz/observability/client` | Client-side capture surface |
| `@fxyz/observability/keys` | `isObservabilityEnabled`, source-token / ingest-URL resolution |
| `@fxyz/observability/instrumentation` | `register` + `onRequestError` for `instrumentation.ts` |
| `@fxyz/observability/next-config` | Next.js config helper |

Package exports point at TypeScript source directly (no prebuilt `dist`).
This matches how the package is consumed inside a Next.js app (Next
transpiles workspace TS packages itself); if you consume it from a
non-Next.js / non-bundled context, add your own build step (`tsup`,
`tsc`, etc.) or transpile-on-import (`tsx`, `ts-node`).

## Wiring

Re-export the instrumentation hooks from each consuming app's
`instrumentation.ts`:

```ts
export { register, onRequestError } from "@fxyz/observability/instrumentation";
```

## Environment

- `BETTER_STACK_SOURCE_TOKEN` (+ optional `BETTER_STACK_INGESTING_URL`) — canonical names.
- `BETTERSTACK_API_KEY` / `BETTERSTACK_URL` — legacy aliases, projected onto the canonical names at startup.
- `DEPLOYMENT_COMMIT_SHA` / `DEPLOYMENT_ID` — optional deployment tags attached to every event.
- Absent both source token and ingest URL → NOOP mode.

## PII scrubbing

`src/scrub.ts` deep-walks every payload, redacts sensitive keys (`email`,
`name`, `password`, `token`, `secret`, `apiKey`, `did`, …) and any value
matching an email or `did:method:id` pattern. Output preserves shape so
events stay grep-able. **Names, emails, and DIDs never reach telemetry.**

This scrubbing runs unconditionally — even in NOOP mode's stderr fallback
— so nothing needs to opt in to be protected.

## Dependencies

`@logtail/next`, `@t3-oss/env-nextjs`, `zod`. Peer: `next` (^16). Tests via Jest.

## License

Apache-2.0
