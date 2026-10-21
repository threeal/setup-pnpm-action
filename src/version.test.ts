import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { extractVersionFromPackageJson, readVersionFile } from "./version.js";

describe("extractVersionFromPackageJson", () => {
  test("returns the version", () => {
    expect(
      extractVersionFromPackageJson({ packageManager: "pnpm@11.5.0" }),
    ).toBe("11.5.0");
  });

  test("returns the version when build metadata is present", () => {
    expect(
      extractVersionFromPackageJson({
        packageManager: "pnpm@11.5.0+sha256.abc123",
      }),
    ).toBe("11.5.0");
  });

  test("returns undefined without a `packageManager` field", () => {
    expect(extractVersionFromPackageJson({})).toBeUndefined();
  });

  test("throws for an invalid package.json", () => {
    expect(() => extractVersionFromPackageJson(null)).toThrow(
      "Invalid package.json",
    );
  });

  test("throws for a malformed `packageManager` value", () => {
    expect(() =>
      extractVersionFromPackageJson({ packageManager: "wololo" }),
    ).toThrow("Invalid `packageManager` value: wololo");
  });

  test("throws for a `packageManager` value that isn't a string", () => {
    expect(() =>
      extractVersionFromPackageJson({ packageManager: 123 }),
    ).toThrow("Invalid `packageManager` type: number");
  });

  test("throws for a package manager other than pnpm", () => {
    expect(() =>
      extractVersionFromPackageJson({ packageManager: "npm@11.16.0" }),
    ).toThrow("Unsupported package manager: npm, expected pnpm");
  });
});

describe("readVersionFile", { concurrent: true }, () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "setup-pnpm-action-"));
  });

  afterAll(() => rm(tmpDir, { force: true, recursive: true }));

  test("reads the version from package.json", async () => {
    const file = join(tmpDir, "package.json");
    await writeFile(file, JSON.stringify({ packageManager: "pnpm@11.5.0" }));
    await expect(readVersionFile(file)).resolves.toBe("11.5.0");
  });

  test("returns undefined when package.json sets no version", async () => {
    const file = join(tmpDir, "empty", "package.json");
    await mkdir(dirname(file));
    await writeFile(file, "{}");
    await expect(readVersionFile(file)).resolves.toBeUndefined();
  });

  test("throws for an unsupported version file", async () => {
    await expect(readVersionFile(join(tmpDir, ".npmrc"))).rejects.toThrow(
      "Unsupported version file: .npmrc",
    );
  });
});
