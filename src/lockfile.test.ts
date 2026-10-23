import { describe, expect, test } from "vitest";
import { extractVersionFromPnpmLock } from "./lockfile.js";

const LOCKFILE = [
  "---",
  "lockfileVersion: '9.0'",
  "",
  "importers:",
  "",
  "  .:",
  "    configDependencies:",
  "      '@pnpm/plugin-example':",
  "        specifier: 1.0.0",
  "        version: 1.0.0",
  "    packageManagerDependencies:",
  "      '@pnpm/exe':",
  "        specifier: ^11.0.0",
  "        version: 11.25.0",
  "      pnpm:",
  "        specifier: ^11.0.0",
  "        version: 11.25.0",
  "",
  "packages:",
  "",
  "  '@pnpm/exe@11.25.0':",
  "    hasBin: true",
  "",
  "---",
  "lockfileVersion: '9.0'",
  "",
].join("\n");

describe("extractVersionFromPnpmLock", () => {
  test("returns the locked version", () => {
    expect(extractVersionFromPnpmLock(LOCKFILE)).toBe("11.25.0");
  });

  test("returns the locked version with CRLF line endings", () => {
    expect(extractVersionFromPnpmLock(LOCKFILE.replaceAll("\n", "\r\n"))).toBe(
      "11.25.0",
    );
  });

  test("returns undefined without a package manager document", () => {
    expect(
      extractVersionFromPnpmLock("lockfileVersion: '9.0'\n\nimporters:\n"),
    ).toBeUndefined();
  });

  test("returns undefined when the document ends before the version", () => {
    expect(
      extractVersionFromPnpmLock(
        "---\nlockfileVersion: '9.0'\n---\nimporters:\n  .:\n",
      ),
    ).toBeUndefined();
  });

  test("returns undefined without an `@pnpm/exe` entry", () => {
    expect(
      extractVersionFromPnpmLock(LOCKFILE.replace("'@pnpm/exe':", "other:")),
    ).toBeUndefined();
  });

  test("returns undefined for a version that isn't exact", () => {
    expect(
      extractVersionFromPnpmLock(
        LOCKFILE.replace("version: 11.25.0", "version: 11.25.0-rc.0"),
      ),
    ).toBeUndefined();
  });
});
