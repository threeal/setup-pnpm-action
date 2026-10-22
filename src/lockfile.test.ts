import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { extractVersionFromPnpmLock, readLockedVersion } from "./lockfile.js";

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

describe("readLockedVersion", { concurrent: true }, () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "setup-pnpm-action-"));
    await writeFile(join(tmpDir, "pnpm-lock.yaml"), LOCKFILE);
  });

  afterAll(() => rm(tmpDir, { force: true, recursive: true }));

  test.each(["11.25.0", "^11.0.0", ">=11.0.0 <11.26.0"])(
    "returns the locked version satisfying %j",
    async (version) => {
      await expect(
        readLockedVersion(join(tmpDir, "pnpm-lock.yaml"), version),
      ).resolves.toBe("11.25.0");
    },
  );

  test.each(["11.28.7", "^12.0.0", "latest"])(
    "returns undefined for a locked version not satisfying %j",
    async (version) => {
      await expect(
        readLockedVersion(join(tmpDir, "pnpm-lock.yaml"), version),
      ).resolves.toBeUndefined();
    },
  );

  test("returns undefined when the lockfile doesn't lock a version", async () => {
    const file = join(tmpDir, "empty-lock.yaml");
    await writeFile(file, "lockfileVersion: '9.0'\n");
    await expect(readLockedVersion(file, "^11.0.0")).resolves.toBeUndefined();
  });

  test("throws for a missing lockfile", async () => {
    await expect(
      readLockedVersion(join(tmpDir, "missing-lock.yaml"), "^11.0.0"),
    ).rejects.toThrow();
  });
});
