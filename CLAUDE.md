# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About This Repository

This is a JavaScript GitHub Action that downloads and sets up a standalone pnpm binary on all GitHub-hosted runner platforms (Linux x64/arm64, macOS x64/arm64, Windows x64/arm64).

## Architecture

### Source Files

- **`src/main.ts`** — Entry point; calls the action and handles errors.
- **`src/action.ts`** — Action implementation; resolves/verifies the pnpm version, downloads the binary, and adds it to `PATH`.
- **`src/input.ts`** — Reads action inputs (`version`, `version-file`) and resolves them to a version string; exports `getPlatform()` and `getArch()`.
- **`src/pnpm.ts`** — pnpm-specific utilities: npm registry fetch, version resolution/verification, home path, and download URL construction.
- **`src/install.ts`** — Archive extraction (`.tar.gz`, `.zip`) and setting executable permissions.
- **`src/action.test.ts`** — Integration tests with a mocked GitHub Actions environment and real binary download.
- **`src/input.test.ts`** — Tests for `input.ts`.
- **`src/pnpm.test.ts`** — Tests for `pnpm.ts`, including live network calls.
- **`src/install.test.ts`** — Tests for `install.ts`.

### TypeScript Configuration

- **`tsconfig.json`** — Type-check only config (noEmit); requires `.js` extensions on imports even for `.ts` source files.

### Build Configuration

- **`tsup.config.ts`** — Bundles `src/main.ts` as a single ESM file with tree-shaking.

### Build Output

- **`dist/main.js`** — Single bundled ESM file; must be committed (CI checks for no diff after build).

### Action Definition

- **`action.yml`** — Declares inputs (`version`, `version-file`), output (`version`), and the Node.js runtime pointing to `dist/main.js`.

## Tooling

- **pnpm** — Package manager; version pinned via `packageManager` in `package.json`; requires Node >=24.
- **tsup** — Bundler; all deps (including runtime ones) go in `devDependencies` — no runtime `dependencies` needed.
- **ghakit** — GitHub Actions toolkit for inputs, outputs, logging, and spawning processes.
- **ESLint** — Linter with flat config (`eslint.config.ts`); uses `typescript-eslint` strict + stylistic rules.
- **Prettier** — Formatter; `prettier-plugin-organize-imports` manages import order automatically.
- **Lefthook** — Git hook manager via `lefthook.yaml`; a standalone binary, not a pnpm package.
- **Vitest** — Test runner; coverage always enabled at 100% thresholds across all metrics.
- **Dependabot** — Keeps GitHub Actions and npm dependencies up to date via `.github/dependabot.yaml`.

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

- **Check** — runs `lefthook run pre-commit --all-files`, then `pnpm vitest run`.
- **Test** — runs the action end-to-end on `ubuntu-24.04`, `ubuntu-24.04-arm`, `windows-2025`, `windows-11-arm`, `macos-15`, and `macos-15-intel`.

See `.github/workflows/ci.yaml` for full details.
