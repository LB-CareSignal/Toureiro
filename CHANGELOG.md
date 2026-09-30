# Changelog

All notable changes to this project are documented in this file.

## 2.0.1 - 2026-09-30

- Bull queues now authenticate with `auth_pass` (previously ignored by ioredis), so job routes work against a password-protected Redis.
- Redis and queue errors no longer crash the host process. A wrong or missing password makes requests fail with a clear message instead of hanging.
- `password` is accepted as an alias for `auth_pass`.

## 2.0.0 - 2026-09-30

- Added server-enforced readonly mode via the `readonly` option, `--readonly` CLI flag, or `TOUREIRO_READONLY=true`. Remove, promote, and rerun requests are rejected with a 403 and the UI locks to Readonly.
- The package now exports the `toureiro()` function directly, so `require()` and ESM `import` both work.
- The `toureiro` CLI now runs on plain Node (it no longer requires `tsx`).
- Pinned `bull` to the 2.2.8 release of the LB-CareSignal fork.
- Pinned all dependencies to exact versions and resolved `npm audit` findings (`express` 4.22.3, `mocha` 12.0.2, transitive updates).
- Added server tests for promote, remove, read routes, readonly mode, and rerun with `removeOnComplete`.
- Modern React + TypeScript frontend with Ant Design UI components.
- Webpack-based frontend build pipeline.
- TypeScript test suite and targeted test execution support via npm run test -- --target=<name>.
- Type checking workflow for backend and frontend source.
- Migrated application source from legacy CommonJS JavaScript to TypeScript with import/export modules.
- Reworked backend routes and models to use native async/await patterns.
- Updated package set and project scripts.
- Improved local development flow for running, building, and testing.
- Removed legacy Gulp/Browserify build chain.
- Removed legacy JSX/LESS frontend source and deprecated helper patterns.
- Removed direct Bluebird usage in application and test source.
