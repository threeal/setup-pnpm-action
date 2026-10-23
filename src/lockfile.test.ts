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
  "      pnpm:",
  "        specifier: ^12.0.0",
  "        version: 12.15.0",
  "",
  "packages:",
  "",
  "  pnpm@12.15.0:",
  "    hasBin: true",
  "",
  "---",
  "lockfileVersion: '9.0'",
  "",
].join("\n");

describe("extractVersionFromPnpmLock", () => {
  test("returns the locked version", () => {
    expect(extractVersionFromPnpmLock(LOCKFILE)).toBe("12.15.0");
  });

  test("returns the locked version with CRLF line endings", () => {
    expect(extractVersionFromPnpmLock(LOCKFILE.replaceAll("\n", "\r\n"))).toBe(
      "12.15.0",
    );
  });

  test("returns the locked version alongside an `@pnpm/exe` entry", () => {
    expect(
      extractVersionFromPnpmLock(
        LOCKFILE.replace(
          "      pnpm:",
          [
            "      '@pnpm/exe':",
            "        specifier: ^12.0.0",
            "        version: 12.14.0",
            "      pnpm:",
          ].join("\n"),
        ),
      ),
    ).toBe("12.15.0");
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

  test("returns undefined with only an `@pnpm/exe` entry", () => {
    expect(
      extractVersionFromPnpmLock(
        LOCKFILE.replace("      pnpm:", "      '@pnpm/exe':"),
      ),
    ).toBeUndefined();
  });

  test("returns undefined for a version that isn't exact", () => {
    expect(
      extractVersionFromPnpmLock(
        LOCKFILE.replace("version: 12.15.0", "version: 12.15.0-rc.0"),
      ),
    ).toBeUndefined();
  });
});
