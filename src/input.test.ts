import { getInput } from "ghakit/io";
import { logError, logInfo } from "ghakit/log";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { arch, platform } from "node:os";
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
import {
  Arch,
  extractVersionFromPackageJson,
  getArch,
  getPlatform,
  getVersionInput,
  Platform,
} from "./input.js";

vi.mock(import("ghakit/io"));
vi.mock(import("ghakit/log"));
vi.mock(import("node:os"), async (importOriginal) => ({
  ...(await importOriginal()),
  arch: vi.fn(),
  platform: vi.fn(),
}));

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

describe("getPlatform", () => {
  const platforms: { val: Platform }[] = [
    { val: "linux" },
    { val: "darwin" },
    { val: "win32" },
  ];

  test.each(platforms)("returns $val", ({ val }) => {
    vi.mocked(platform).mockReturnValue(val);
    expect(getPlatform()).toBe(val);
  });

  test("throws for unsupported platform", () => {
    vi.mocked(platform).mockReturnValue("freebsd");
    expect(() => getPlatform()).toThrow("Unsupported platform: freebsd");
  });
});

describe("getArch", () => {
  const archs: { val: Arch }[] = [{ val: "x64" }, { val: "arm64" }];

  test.each(archs)("returns $arch", ({ val }) => {
    vi.mocked(arch).mockReturnValue(val);
    expect(getArch()).toBe(val);
  });

  test("throws for unsupported arch", () => {
    vi.mocked(arch).mockReturnValue("ia32");
    expect(() => getArch()).toThrow("Unsupported arch: ia32");
  });
});

describe("extractVersionFromPackageJson", () => {
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

  test("throws when both devEngines.packageManager and packageManager are missing", () => {
    expect(() => extractVersionFromPackageJson({})).toThrow(
      "Missing `devEngines.packageManager` and `packageManager` fields in package.json",
    );
  });

  test("prefers devEngines.packageManager over packageManager", () => {
    expect(
      extractVersionFromPackageJson({
        devEngines: { packageManager: { name: "pnpm", version: "11.5.0" } },
        packageManager: "pnpm@9.15.0",
      }),
    ).toBe("11.5.0");
  });

  const sources = [
    {
      name: "packageManager",
      build: (manager: unknown, version: unknown) => ({
        packageManager: `${String(manager)}@${String(version)}`,
      }),
      notAString: { packageManager: 123 },
      notAStringMessage: "`packageManager` must be a string",
      invalidFormat: { packageManager: "invalid" },
      invalidFormatMessage: "Invalid `packageManager` value: invalid",
    },
    {
      name: "devEngines.packageManager",
      build: (manager: unknown, version: unknown) => ({
        devEngines: { packageManager: { name: manager, version } },
      }),
      notAString: {
        devEngines: { packageManager: { name: "pnpm", version: 123 } },
      },
      notAStringMessage: "`devEngines.packageManager.version` must be a string",
      invalidFormat: {
        devEngines: { packageManager: { name: "pnpm", version: "invalid" } },
      },
      invalidFormatMessage:
        "Invalid `devEngines.packageManager.version` value: invalid",
    },
  ];

  describe.each(sources)("via $name", (source) => {
    test("returns the version", () => {
      expect(
        extractVersionFromPackageJson(source.build("pnpm", "11.5.0")),
      ).toBe("11.5.0");
    });

    test("returns the version when build metadata is present", () => {
      expect(
        extractVersionFromPackageJson(
          source.build("pnpm", "11.5.0+sha256.abc123"),
        ),
      ).toBe("11.5.0");
    });

    test("throws when the package manager is not pnpm", () => {
      expect(() =>
        extractVersionFromPackageJson(source.build("npm", "11.16.0")),
      ).toThrow("Unsupported package manager: npm, expected pnpm");
    });

    test("throws when the version is not a string", () => {
      expect(() => extractVersionFromPackageJson(source.notAString)).toThrow(
        source.notAStringMessage,
      );
    });

    test("throws when the version has an invalid format", () => {
      expect(() => extractVersionFromPackageJson(source.invalidFormat)).toThrow(
        source.invalidFormatMessage,
      );
    });
  });

  test("throws when devEngines is not an object", () => {
    expect(() =>
      extractVersionFromPackageJson({ devEngines: "not an object" }),
    ).toThrow("`devEngines` must be an object");
  });

  test("throws when devEngines.packageManager is not an object", () => {
    expect(() =>
      extractVersionFromPackageJson({
        devEngines: { packageManager: "not an object" },
      }),
    ).toThrow("`devEngines.packageManager` must be an object");
  });

  test("throws when devEngines.packageManager.name is missing", () => {
    expect(() =>
      extractVersionFromPackageJson({
        devEngines: { packageManager: { version: "11.5.0" } },
      }),
    ).toThrow("Missing `name` field in `devEngines.packageManager`");
  });

  test("throws when devEngines.packageManager.name is not a string", () => {
    expect(() =>
      extractVersionFromPackageJson({
        devEngines: { packageManager: { name: 123, version: "11.5.0" } },
      }),
    ).toThrow("`devEngines.packageManager.name` must be a string");
  });

  test("throws when devEngines.packageManager.version is missing", () => {
    expect(() =>
      extractVersionFromPackageJson({
        devEngines: { packageManager: { name: "pnpm" } },
      }),
    ).toThrow("Missing `version` field in `devEngines.packageManager`");
  });

  const rangeOperators = ["^", "~", "=", ">=", "<=", ">", "<"];

  test.each(rangeOperators)(
    "returns the version when devEngines.packageManager.version has a leading %s operator",
    (operator) => {
      expect(
        extractVersionFromPackageJson({
          devEngines: {
            packageManager: { name: "pnpm", version: `${operator}11.5.0` },
          },
        }),
      ).toBe("11.5.0");
    },
  );

  const rejectedRanges = [">=11.0.0 <12.0.0", "11.x", "*"];

  test.each(rejectedRanges)(
    "throws when devEngines.packageManager.version is the range %s",
    (version) => {
      expect(() =>
        extractVersionFromPackageJson({
          devEngines: { packageManager: { name: "pnpm", version } },
        }),
      ).toThrow(`Invalid \`devEngines.packageManager.version\` value: ${version}`);
    },
  );
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
