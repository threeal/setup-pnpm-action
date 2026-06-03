# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
pnpm test                 # run all tests (Vitest)
pnpm test <file>          # run a single test file
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

- `main.ts` — action entry point; reads the `version` input via `getInput("version")`, resolves it via `resolvePnpmVersion()`, detects platform and architecture, creates the pnpm home directory via `createPnpmHome()`, downloads the binary via `downloadPnpm()`, then sets up the environment via `setupPnpm()`. Handles top-level errors by logging and setting `process.exitCode = 1`.
- `pnpm.ts` — `createPnpmHome(version)` (creates `$RUNNER_TOOL_CACHE/pnpm/<version>/` and returns the path), `parsePnpmVersionsRegistry(data)` (extracts a `Record<string, string>` of tag/version aliases from raw NPM registry JSON), `fetchPnpmVersionsRegistry(url)` (fetches the `@pnpm/exe` NPM registry entry and parses it), `resolvePnpmVersion(version)` (looks up the version string in the registry, throws on unknown), `downloadPnpm(pnpmHome, version, platform, architecture)` (builds the GitHub release URL, downloads via `downloadFile()`, and chmods the binary to `755`), `setupPnpm(pnpmHome)` (sets `PNPM_HOME` env var and adds `pnpmHome` to `PATH`).
- `platform.ts` — `getPlatform()` (maps `os.platform()` → `"linux" | "macos" | "win"`), `getArchitecture()` (maps `os.arch()` → `"x64" | "arm64"`); both throw on unrecognised values.
- `download.ts` — `downloadFile(url, dest)` (spawns `curl -fLSs --output <dest> <url>`, collects stderr, rejects with the stderr message on non-zero exit).

Tests use Vitest and must maintain 100% coverage (enforced in `vitest.config.ts`). Test files are co-located with sources (`*.test.ts`). Most external dependencies (`gha-utils`, `fs`, network) are mocked via `vi.mock()`. Note that `fetchPnpmVersionsRegistry()` makes a real network call in tests.
