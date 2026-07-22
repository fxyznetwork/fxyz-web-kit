# @fxyz/logger

Structured logging package for Node.js and the browser, built on [Pino](https://github.com/pinojs/pino).

## Features

- **Fast**: built on Pino, one of the fastest Node.js loggers
- **Structured**: JSON-formatted logs for production
- **Pretty**: human-readable logs for development (via `pino-pretty`)
- **Type-safe**: full TypeScript support
- **Contextual**: create child loggers with context
- **Environment-aware**: automatically adjusts output based on `NODE_ENV`
- **Browser-safe variant**: a separate `./browser` entrypoint with no Node.js dependency, for client components

## Install

```sh
pnpm add @fxyz/logger
```

## Usage

### Basic logging

```typescript
import { log } from '@fxyz/logger';

log.info('User logged in');
log.error('Failed to process request', error);
log.debug('Processing request', { userId: '123' });
```

### Contextual logger

```typescript
import { createLogger } from '@fxyz/logger';

const logger = createLogger('AuthService');

logger.info('User authenticated');
logger.error({ userId: '123' }, 'Authentication failed');
```

### Direct logger

```typescript
import logger from '@fxyz/logger';

logger.info('Application started');
logger.child({ service: 'API' }).info('Listening on port 3000');
```

### Browser-safe logger

For client components, where a Node.js logger like Pino isn't appropriate:

```typescript
import { createBrowserLogger } from '@fxyz/logger/browser';

const logger = createBrowserLogger('checkout:page');
logger.info('Page loaded', { itemCount: 3 });
```

The browser logger wraps `console.*` with a `[name]` prefix and filters by
level (`debug` in development, `info` and above in production). It has no
dependency on Pino.

## Environment variables

- `NODE_ENV`: `"development"` for pretty-printed output, anything else for JSON
- `LOG_LEVEL`: minimum log level (`debug`, `info`, `warn`, `error`, `fatal`)

## Log levels

- **debug**: detailed debugging information
- **info**: general informational messages
- **warn**: warning messages for potential issues
- **error**: error messages for failures
- **fatal**: critical errors that require immediate attention

## Best practices

1. Use structured logging — pass context as objects, not string concatenation
2. Use appropriate levels — debug < info < warn < error < fatal
3. Create contextual loggers via `createLogger` for services/modules
4. Pass `Error` objects to get full stack traces
5. Never log secrets, passwords, tokens, or other sensitive values

## License

Apache-2.0
