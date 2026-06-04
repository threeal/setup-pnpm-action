# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
pnpm vitest run           # run all tests (Vitest)
pnpm vitest run <file>    # run a single test file
pnpm tsc                  # type check
pnpm eslint .             # lint
pnpm prettier --check .   # check formatting
pnpm prettier --write .   # fix formatting
pnpm rollup -c            # build — outputs dist/main.js
```

Pre-commit hooks are managed by [Lefthook](https://lefthook.dev/). Hooks automatically run formatting, linting, type checking, and building before each commit.

## Architecture

This is a JavaScript GitHub Action that downloads and sets up a standalone pnpm binary on all GitHub-hosted runner platforms (Linux x64/arm64, macOS x64/arm64, Windows x64/arm64).

The entry point is `dist/main.js`, produced by Rollup bundling `src/main.ts`. The `dist/` folder must be committed — CI verifies there is no git diff after building.

Source files in `src/`:

- `main.ts` — action entry point; calls `setupPnpmAction()` from `action.ts` and handles top-level errors by logging and setting `process.exitCode = 1`.
- `action.ts` — `setupPnpmAction()` orchestrates the full setup: resolves the pnpm version, creates the pnpm home directory under `getRunnerToolCache()/pnpm/<version>/` (via `ghakit/vars`), downloads the binary via `exec("curl", ...)` from `ghakit/exec`, chmods it to `755`, and sets `PNPM_HOME` / adds it to `PATH`.
- `pnpm.ts` — `resolvePnpmVersionFromResponse(version, res)` (extracts the resolved version from an NPM registry HTTP response, throws on unknown version or HTTP error), `resolvePnpmVersion(version)` (fetches the `@pnpm/exe` NPM registry entry and delegates to `resolvePnpmVersionFromResponse`), `getPnpmBinaryName(platform)` (returns `"pnpm.exe"` on Windows, `"pnpm"` otherwise), `getPnpmDownloadUrl({version, platform, arch})` (builds the GitHub release download URL, throws on unsupported platform or arch).

Tests use Vitest and must maintain 100% coverage (enforced in `vitest.config.ts`). Test files are co-located with sources (`*.test.ts`). Most external dependencies (`ghakit`, `fs`, network) are mocked via `vi.mock()`. Note that `fetchPnpmVersionsRegistry()` makes a real network call in tests.
