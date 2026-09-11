# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About This Repository

Downloads and sets up a standalone pnpm binary on all GitHub-hosted runner platforms (Linux x64/arm64, macOS x64/arm64, Windows x64/arm64). GitHub Action, TypeScript targeting Node 24, ESM.

## Rules that aren't obvious from the code

- Import paths must end in `.js`, even when importing `.ts` source files. `tsconfig.json` sets `moduleResolution: node16`, which requires this.
- `dist/main.js` (built by `tsup` from `src/main.ts`) must be committed — `action.yml` points to it directly as the runtime entry, and CI fails if building produces a diff.
- `lefthook run pre-commit` auto-fixes formatting/lint and rebuilds `dist/main.js`; `fail_on_changes` fails the run if any file changed. If that happens, re-stage the changed files and rerun.
- Vitest's 100% coverage threshold applies to the whole run, not per file. Running a single test file can fail coverage if it imports source another file is responsible for covering — use the full suite for an accurate result.
- `src/main.ts` is not covered by vitest by design — end-to-end verification is delegated to the CI `test` job matrix instead.
- `tsup` bundles everything at build time, so every package — including runtime dependencies — belongs in `devDependencies`; there's no `dependencies` field to keep in sync.
- Prettier auto-reorders imports (`prettier-plugin-organize-imports`) — reordering on format is expected, not a bug.

## Layout

- `src/main.ts` — entry point and action implementation; resolves/verifies the pnpm version, downloads the binary, adds it to `PATH`, and handles errors.
- `src/input.ts` — reads action inputs (`version`, `version-file`) and resolves them to a version string; exports `getPlatform()` and `getArch()`.
- `src/pnpm.ts` — pnpm-specific utilities: npm registry fetch, version resolution/verification, home path, and download URL construction.
- `src/install.ts` — archive extraction (`.tar.gz`, `.zip`) and setting executable permissions.
- `src/*.test.ts` — colocated with the source they test, except `main.ts` (see rules above).

## Config map

- Type checking — `tsconfig.json`
- Lint — `eslint.config.ts`
- Format — `.prettierrc.json`
- Bundler — `tsup.config.ts`
- Tests + coverage — `vitest.config.ts`
- Git hooks — `lefthook.yaml`
- CI — `.github/workflows/ci.yaml`
- Dependency updates — `.github/dependabot.yaml`
- Action inputs/outputs/branding — `action.yml`

## Commands

- `lefthook run pre-commit` — lint/format/build on staged files (`--all-files` to match CI)
- `pnpm vitest run` — full test suite with coverage
