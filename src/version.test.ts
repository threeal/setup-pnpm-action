import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { extractVersionFromPackageJson, readVersionFile } from "./version.js";

describe("extractVersionFromPackageJson", () => {
  test("throws for an invalid package.json", () => {
    expect(() => extractVersionFromPackageJson(null)).toThrow(
      "Invalid package.json",
    );
  });

  describe("from `devEngines`", () => {
    test("returns the version", () => {
      expect(
        extractVersionFromPackageJson({
          devEngines: { packageManager: { name: "pnpm", version: "11.5.0" } },
        }),
      ).toEqual({ key: "devEngines.packageManager", version: "11.5.0" });
    });

    test("returns the version when build metadata is present", () => {
      expect(
        extractVersionFromPackageJson({
          devEngines: {
            packageManager: { name: "pnpm", version: "11.5.0+sha256.abc123" },
          },
        }),
      ).toEqual({ key: "devEngines.packageManager", version: "11.5.0" });
    });

    test("returns the version range", () => {
      expect(
        extractVersionFromPackageJson({
          devEngines: {
            packageManager: { name: "pnpm", version: ">=10.0.0 <12.0.0" },
          },
        }),
      ).toEqual({
        key: "devEngines.packageManager",
        version: ">=10.0.0 <12.0.0",
      });
    });

    test("returns a partial version as a version range", () => {
      expect(
        extractVersionFromPackageJson({
          devEngines: { packageManager: { name: "pnpm", version: "11.x" } },
        }),
      ).toEqual({ key: "devEngines.packageManager", version: "11.x" });
    });

    test("returns no version without a version", () => {
      expect(
        extractVersionFromPackageJson({
          devEngines: { packageManager: { name: "pnpm" } },
        }),
      ).toEqual({ key: "devEngines.packageManager" });
    });

    test("throws for a `devEngines` value that isn't an object", () => {
      expect(() =>
        extractVersionFromPackageJson({ devEngines: "pnpm" }),
      ).toThrow("Invalid `devEngines` type: string");
    });

    test("throws for a package manager that isn't an object", () => {
      expect(() =>
        extractVersionFromPackageJson({
          devEngines: { packageManager: "pnpm" },
        }),
      ).toThrow("Invalid `devEngines.packageManager` type: string");
    });

    test("throws for a package manager array", () => {
      expect(() =>
        extractVersionFromPackageJson({
          devEngines: {
            packageManager: [{ name: "pnpm", version: "11.5.0" }],
          },
        }),
      ).toThrow("Unsupported `devEngines.packageManager` array");
    });

    test("throws for a package manager name that isn't a string", () => {
      expect(() =>
        extractVersionFromPackageJson({
          devEngines: { packageManager: { name: 123 } },
        }),
      ).toThrow("Invalid `devEngines.packageManager.name` type: number");
    });

    test("throws for a package manager other than pnpm", () => {
      expect(() =>
        extractVersionFromPackageJson({
          devEngines: { packageManager: { name: "npm", version: "11.16.0" } },
        }),
      ).toThrow("Unsupported package manager: npm, expected pnpm");
    });

    test("throws for a version that isn't a string", () => {
      expect(() =>
        extractVersionFromPackageJson({
          devEngines: { packageManager: { name: "pnpm", version: 11 } },
        }),
      ).toThrow("Invalid `devEngines.packageManager.version` type: number");
    });

    test("throws for a malformed version", () => {
      expect(() =>
        extractVersionFromPackageJson({
          devEngines: { packageManager: { name: "pnpm", version: "latest" } },
        }),
      ).toThrow("Invalid `devEngines.packageManager.version` value: latest");
    });
  });

  describe("from `packageManager`", () => {
    test("returns the version", () => {
      expect(
        extractVersionFromPackageJson({ packageManager: "pnpm@11.5.0" }),
      ).toEqual({ key: "packageManager", version: "11.5.0" });
    });

    test("returns the version when build metadata is present", () => {
      expect(
        extractVersionFromPackageJson({
          packageManager: "pnpm@11.5.0+sha256.abc123",
        }),
      ).toEqual({ key: "packageManager", version: "11.5.0" });
    });

    test("throws for a `packageManager` value that isn't a string", () => {
      expect(() =>
        extractVersionFromPackageJson({ packageManager: 123 }),
      ).toThrow("Invalid `packageManager` type: number");
    });

    test("throws for a malformed `packageManager` value", () => {
      expect(() =>
        extractVersionFromPackageJson({ packageManager: "wololo" }),
      ).toThrow("Invalid `packageManager` value: wololo");
    });

    test("throws for a package manager other than pnpm", () => {
      expect(() =>
        extractVersionFromPackageJson({ packageManager: "npm@11.16.0" }),
      ).toThrow("Unsupported package manager: npm, expected pnpm");
    });
  });

  test("prefers `devEngines` over `packageManager`", () => {
    expect(
      extractVersionFromPackageJson({
        devEngines: { packageManager: { name: "pnpm", version: "11.5.0" } },
        packageManager: "pnpm@10.34.0",
      }),
    ).toEqual({ key: "devEngines.packageManager", version: "11.5.0" });
  });

  test("falls back to `packageManager` when `devEngines` has no package manager", () => {
    expect(
      extractVersionFromPackageJson({
        devEngines: {},
        packageManager: "pnpm@10.34.0",
      }),
    ).toEqual({ key: "packageManager", version: "10.34.0" });
  });

  test("falls back to `packageManager` when the `devEngines` package manager has no name", () => {
    expect(
      extractVersionFromPackageJson({
        devEngines: { packageManager: { version: "11.5.0" } },
        packageManager: "pnpm@10.34.0",
      }),
    ).toEqual({ key: "packageManager", version: "10.34.0" });
  });

  test("returns undefined without a `devEngines` or `packageManager` field", () => {
    expect(extractVersionFromPackageJson({})).toBeUndefined();
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
    await expect(readVersionFile(file)).resolves.toEqual({
      key: "packageManager",
      version: "11.5.0",
    });
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
