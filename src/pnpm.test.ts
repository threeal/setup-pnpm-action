import { getRunnerToolCache } from "ghakit/vars";
import { join } from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Arch, Platform } from "./input.js";
import {
  fecthNpmPackageRegistry,
  getPnpm11DownloadUrl,
  getPnpmDownloadUrl,
  getPnpmHome,
  getPnpmMajorVersion,
  resolvePnpmVersion,
  verifyPnpmVersion,
} from "./pnpm.js";

vi.mock(import("ghakit/vars"));

describe("fecthNpmPackageRegistry", { concurrent: true }, () => {
  test("returns package registry", async () => {
    const registry = await fecthNpmPackageRegistry("@pnpm/exe");
    expect(registry).not.toBeUndefined();
  });

  test("throws for not found package", async () => {
    await expect(fecthNpmPackageRegistry("@pnpm/exeee")).rejects.toThrow(
      "Failed to fetch @pnpm/exeee from npm registry: Not Found",
    );
  });
});

describe("resolvePnpmVersion", { concurrent: true }, () => {
  test("resolves a pnpm tag", () => {
    const registry = { "dist-tags": { latest: "11.5.0" } };
    const version = resolvePnpmVersion("latest", registry);
    expect(version).toBe("11.5.0");
  });

  test("throws when registry is not an object", () => {
    expect(() => resolvePnpmVersion("latest", "")).toThrow(
      "Registry must be an object",
    );
  });

  test("throws when `dist-tags` field is missing", () => {
    expect(() => resolvePnpmVersion("latest", {})).toThrow(
      "Missing `dist-tags` field in registry",
    );
  });

  test("throws when `dist-tags` field is not an object", () => {
    expect(() => resolvePnpmVersion("latest", { "dist-tags": "" })).toThrow(
      "`dist-tags` must be an object",
    );
  });

  test("throws when tag not found", () => {
    expect(() =>
      resolvePnpmVersion("latest", { "dist-tags": { current: "10.34.0" } }),
    ).toThrow("Unknown tag: latest");
  });

  test("throws when resolved tag does not contain a string", () => {
    expect(() =>
      resolvePnpmVersion("latest", { "dist-tags": { latest: {} } }),
    ).toThrow("Tag latest did not resolve to a string");
  });
});

describe("verifyPnpmVersion", { concurrent: true }, () => {
  test("verify a pnpm verion", () => {
    const registry = { versions: { "10.34.0": {} } };
    expect(() => {
      verifyPnpmVersion("10.34.0", registry);
    }).not.toThrow();
  });

  test("throws when registry is not an object", () => {
    expect(() => {
      verifyPnpmVersion("10.34.0", "");
    }).toThrow("Registry must be an object");
  });

  test("throws when `versions` field is missing", () => {
    expect(() => {
      verifyPnpmVersion("10.34.0", {});
    }).toThrow("Missing `versions` field in registry");
  });

  test("throws when versions field is not an object", () => {
    expect(() => {
      verifyPnpmVersion("10.34.0", { versions: "" });
    }).toThrow("`versions` must be an object");
  });

  test("throws when version not found", () => {
    expect(() => {
      verifyPnpmVersion("10.34.0", { versions: { "11.5.0": {} } });
    }).toThrow("Unknown version: 10.34.0");
  });
});

describe("getPnpmHome", () => {
  beforeEach(() => vi.clearAllMocks());

  test("returns pnpm home", () => {
    vi.mocked(getRunnerToolCache).mockReturnValue("/cache");
    const pnpmHome = getPnpmHome({
      version: "10.34.0",
      platform: "linux",
      arch: "x64",
    });
    expect(pnpmHome).toBe(join("/cache", "pnpm", "10.34.0-linux-x64"));
  });
});

describe("getPnpmMajorVersion", () => {
  test("returns major version", () => {
    expect(getPnpmMajorVersion("10.34.0")).toBe(10);
  });

  test("throws when version is invalid", () => {
    expect(() => getPnpmMajorVersion("latest")).toThrow(
      "Invalid version: latest",
    );
  });
});

describe("getPnpmDownloadUrl", { concurrent: true }, () => {
  const combinations = ["9.15.0", "10.34.0"].flatMap((version) =>
    (["linux", "darwin", "win32"] satisfies Platform[]).flatMap((platform) =>
      (["x64", "arm64"] satisfies Arch[]).map((arch) => ({
        version,
        platform,
        arch,
      })),
    ),
  );

  test("returns unique URLs for each combination", () => {
    const urls = combinations.map(({ version, platform, arch }) => {
      const { baseUrl, filename, ext } = getPnpmDownloadUrl({
        version,
        platform,
        arch,
      });
      return `${baseUrl}/${filename}${ext}`;
    });
    expect(new Set(urls).size).toBe(combinations.length);
  });

  test.each(combinations)(
    "returns accessible URL for $version/$platform/$arch",
    { timeout: 30000 },
    async ({ version, platform, arch }) => {
      const { baseUrl, filename, ext } = getPnpmDownloadUrl({
        version,
        platform,
        arch,
      });
      const url = `${baseUrl}/${filename}${ext}`;
      const res = await fetch(url, { method: "HEAD" });
      expect(res.ok).toBe(true);
    },
  );
});

describe("getPnpm11DownloadUrl", { concurrent: true }, () => {
  const combinations = ["11.4.0", "11.5.0"]
    .flatMap((version) =>
      (["linux", "darwin", "win32"] satisfies Platform[]).flatMap((platform) =>
        (["x64", "arm64"] satisfies Arch[]).map((arch) => ({
          version,
          platform,
          arch,
        })),
      ),
    )
    .filter(({ platform, arch }) => platform !== "darwin" || arch !== "x64");

  test("returns unique URLs for each combination", () => {
    const urls = combinations.map(({ version, platform, arch }) => {
      const { baseUrl, filename, ext } = getPnpm11DownloadUrl({
        version,
        platform,
        arch,
      });
      return `${baseUrl}/${filename}${ext}`;
    });
    expect(new Set(urls).size).toBe(combinations.length);
  });

  test.each(combinations)(
    "returns accessible URL for $version/$platform/$arch",
    { timeout: 30000 },
    async ({ version, platform, arch }) => {
      const { baseUrl, filename, ext } = getPnpm11DownloadUrl({
        version,
        platform,
        arch,
      });
      const url = `${baseUrl}/${filename}${ext}`;
      const res = await fetch(url, { method: "HEAD" });
      expect(res.ok).toBe(true);
    },
  );

  test("throws for x64 macOS on version 11 and above", () => {
    expect(() =>
      getPnpm11DownloadUrl({
        version: "11.5.0",
        platform: "darwin",
        arch: "x64",
      }),
    ).toThrow(
      "pnpm does not provide x64 macOS binaries for version 11 and above",
    );
  });
});
