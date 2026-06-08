# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About This Repository

This is a JavaScript GitHub Action that downloads and sets up a standalone pnpm binary on all GitHub-hosted runner platforms (Linux x64/arm64, macOS x64/arm64, Windows x64/arm64).

## Architecture

### Source Files

- **`src/main.ts`** — Entry point that calls the action function and handles error logging and exit codes.
- **`src/action.ts`** — The action implementation; resolves the pnpm version, sets `PNPM_HOME` to `getRunnerToolCache()/pnpm/<version>/`, downloads the binary into the runner tool cache if not already cached (branching on major version: pnpm <11 downloads an executable directly; pnpm >=11 downloads and extracts an archive), adds it to `PATH`, and sets the `version` output.
- **`src/input.ts`** — Reads the `version` and `version-file` action inputs and resolves them to a version string; parses `package.json` to extract the version from the `packageManager` field when `version-file` is used or when neither input is set and a `package.json` exists in the current directory. Also exports `getPlatform()` and `getArch()`, which validate and return the current `Platform` (`linux | darwin | win32`) and `Arch` (`x64 | arm64`) from `node:os`, throwing on unsupported values.
- **`src/pnpm.ts`** — pnpm-specific utilities: resolves the pnpm version from the NPM registry; `getPnpmMajorVersion(version)` extracts the major version number; `getPnpmDownloadUrl` builds the download URL for pnpm <11 (returns an executable — `""` or `".exe"` extension); `getPnpm11DownloadUrl` builds the download URL for pnpm >=11 (returns an archive — `".tar.gz"` or `".zip"` extension; throws for x64 macOS).
- **`src/install.ts`** — `extractArchive(archiveFile, outputDir)` extracts `.tar.gz` archives via `tar` and `.zip` archives via `unzip`; `makeExecutable(file)` sets executable permissions on the file, or skips if the file has a `.exe` extension.
- **`src/action.test.ts`** — Integration tests for the action with a mocked GitHub Actions environment and a real binary download.
- **`src/input.test.ts`** — Tests for `getPlatform`, `getArch`, `extractVersionFromPackageJson`, and `getVersionInput` in `input.ts`.
- **`src/pnpm.test.ts`** — Tests for the pure functions in `pnpm.ts`: `getPnpmMajorVersion`, `getPnpmDownloadUrl` (pnpm <11), and `getPnpm11DownloadUrl` (pnpm >=11), including live network calls to verify URL accessibility.
- **`src/install.test.ts`** — Tests for `extractArchive` and `makeExecutable` in `install.ts`.

### TypeScript Configuration

- **`tsconfig.json`** — Type-check config with `noEmit: true`; used by `pnpm tsc`. Extends `@tsconfig/node24`, which sets `module: nodenext` and `moduleResolution: node16`. This requires import paths to use `.js` extensions even when importing `.ts` source files.

### Build Configuration

- **`tsup.config.ts`** — Configures tsup to bundle `src/main.ts` as ESM with tree-shaking enabled.

### Build Output

- **`dist/main.js`** — Single bundled ESM file. Must be committed — CI verifies there is no git diff after building.

### Action Definition

- **`action.yml`** — Declares two optional inputs (`version` and `version-file`), one output (`version` — the installed version), branding, and the Node.js runtime pointing to `dist/main.js`.

## Tooling

- **pnpm** is the package manager. `packageManager` in `package.json` pins the pnpm version; `devEngines.runtime` selects the Node.js version; `engines.node` asserts Node >=24.
- **tsup** is the bundler. All packages — including runtime dependencies like `ghakit` — belong in `devDependencies`; tsup bundles everything so there are no runtime `dependencies` needed.
- **ghakit** handles all GitHub Actions-specific concerns: reading inputs, writing outputs, logging, and spawning processes.
- **ESLint** uses flat config (`eslint.config.ts`) with `@eslint/js` recommended rules and `typescript-eslint` strict + stylistic type-checked rules.
- **Prettier** uses `prettier-plugin-organize-imports` — import order is auto-managed.
- **Lefthook** manages Git hooks via `lefthook.yaml`. It is a standalone binary, not a pnpm package.
- **Vitest** uses `vitest.config.ts` with coverage always enabled, text reporter, and 100% thresholds across all metrics.
- **Dependabot** keeps GitHub Actions and npm dependencies up to date automatically via `.github/dependabot.yaml`.

## Testing

```sh
pnpm vitest run             # Run all tests
pnpm vitest run <file>      # Run a single test file
```

Coverage is always enabled and computed for all files imported during the test run. Running a single test file may fail the 100% threshold if it imports a source file that another test is responsible for fully covering — use the full suite for accurate results.

## Checking and Fixing

Use Lefthook to run the same steps as the pre-commit hook:

```sh
lefthook run pre-commit              # staged files only (default)
lefthook run pre-commit --all-files  # all files — matches what CI runs
```

This installs dependencies, fixes formatting, fixes lint, type-checks, and builds the action — in that order, stopping on the first failure. If any file changes during the run, it also fails and shows a diff of what changed — re-stage the changed files and retry.

Individual commands (manual fallback if needed): `pnpm prettier --write .`, `pnpm eslint --fix`, `pnpm tsc`, `pnpm tsup`.

## CI

CI has two jobs:

- **Check** — runs `lefthook run pre-commit --all-files` (install, format, lint, type-check, build), then runs the full test suite with `pnpm vitest run`.
- **Test** — checks out the action itself and runs it on `ubuntu-24.04`, `ubuntu-24.04-arm`, `windows-2025`, `windows-11-arm`, `macos-15`, and `macos-15-intel` to verify the actual action behavior end-to-end across all supported OS and architecture combinations.

See `.github/workflows/ci.yaml` for full details.
