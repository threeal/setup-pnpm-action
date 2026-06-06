import { getInput } from "ghakit/io";
import { logError, logInfo } from "ghakit/log";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { chdir } from "node:process";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { extractVersionFromPackageJson, getVersionInput } from "./input.js";

vi.mock(import("ghakit/io"));
vi.mock(import("ghakit/log"));

beforeEach(() => vi.clearAllMocks());

const tmpDir = resolve(
  import.meta.dirname,
  `.${basename(import.meta.filename)}.tmp`,
);

beforeAll(async () => {
  await rm(tmpDir, { force: true, recursive: true });
  await mkdir(tmpDir, { recursive: true });
  chdir(tmpDir);
});

afterAll(() => rm(tmpDir, { force: true, recursive: true }));

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

  test("throws when not an object", () => {
    expect(() => extractVersionFromPackageJson("not an object")).toThrow(
      "package.json must be an object",
    );
  });

  test("throws when null", () => {
    expect(() => extractVersionFromPackageJson(null)).toThrow(
      "package.json must be an object",
    );
  });

  test("throws when packageManager is missing", () => {
    expect(() => extractVersionFromPackageJson({})).toThrow(
      "Missing `packageManager` field in package.json",
    );
  });

  test("throws when packageManager is not a string", () => {
    expect(() =>
      extractVersionFromPackageJson({ packageManager: 123 }),
    ).toThrow("`packageManager` must be a string");
  });

  test("throws when packageManager has an invalid format", () => {
    expect(() =>
      extractVersionFromPackageJson({ packageManager: "invalid" }),
    ).toThrow("Invalid `packageManager` value: invalid");
  });

  test("throws when the package manager is not pnpm", () => {
    expect(() =>
      extractVersionFromPackageJson({ packageManager: "npm@11.16.0" }),
    ).toThrow("Unsupported package manager: npm, expected pnpm");
  });
});

describe("getVersionInput", () => {
  beforeEach(() => rm("package.json", { force: true }));

  test("returns latest when no inputs are set", async () => {
    vi.mocked(getInput).mockReturnValue("");

    await expect(getVersionInput()).resolves.toBe("latest");
    expect(vi.mocked(logInfo).mock.calls).toStrictEqual([
      ["No version specified, use latest"],
    ]);
  });

  test("reads version from package.json when no inputs are set", async () => {
    await writeFile(
      "package.json",
      JSON.stringify({ packageManager: "pnpm@11.5.0" }),
    );
    vi.mocked(getInput).mockReturnValue("");

    await expect(getVersionInput()).resolves.toBe("11.5.0");
    expect(vi.mocked(logInfo).mock.calls).toStrictEqual([
      ["No version specified, read version from package.json"],
    ]);
  });

  test("returns latest when package.json is invalid and no inputs are set", async () => {
    await writeFile("package.json", "{}");
    vi.mocked(getInput).mockReturnValue("");

    await expect(getVersionInput()).resolves.toBe("latest");
    expect(vi.mocked(logInfo).mock.calls).toStrictEqual([
      ["No version specified, read version from package.json"],
      ["Failed to read version from package.json, use latest"],
    ]);
    expect(logError).toHaveBeenCalledOnce();
  });

  test("returns the version input", async () => {
    vi.mocked(getInput).mockImplementation((name) =>
      name === "version" ? "11.5.0" : "",
    );

    await expect(getVersionInput()).resolves.toBe("11.5.0");
    expect(vi.mocked(logInfo).mock.calls).toStrictEqual([]);
  });

  test("reads version from package.json", async () => {
    await mkdir("package", { recursive: true });
    const packageJsonPath = join("package", "package.json");
    await writeFile(
      packageJsonPath,
      JSON.stringify({ packageManager: "pnpm@11.5.0" }),
    );
    vi.mocked(getInput).mockImplementation((name) =>
      name === "version-file" ? packageJsonPath : "",
    );

    await expect(getVersionInput()).resolves.toBe("11.5.0");
    expect(vi.mocked(logInfo).mock.calls).toStrictEqual([
      ["Read version from package.json"],
    ]);
  });

  test("throws when both version and version-file are set", async () => {
    vi.mocked(getInput).mockImplementation((name) => {
      switch (name) {
        case "version":
          return "11.5.0";
        case "version-file":
          return "package.json";
      }
      return "";
    });

    await expect(getVersionInput()).rejects.toThrow(
      "Cannot specify both `version` and `version-file` inputs",
    );
  });

  test("throws for unsupported version file", async () => {
    vi.mocked(getInput).mockImplementation((name) =>
      name === "version-file" ? ".npmrc" : "",
    );

    await expect(getVersionInput()).rejects.toThrow(
      "Unsupported version file: .npmrc",
    );
  });
});
