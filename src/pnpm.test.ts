import { describe, expect, test } from "vitest";
import {
  getPnpmBinaryName,
  getPnpmDownloadUrl,
  resolvePnpmVersion,
  resolvePnpmVersionFromResponse,
} from "./pnpm.js";

describe("resolvePnpmVersionFromResponse", { concurrent: true }, () => {
  const createRes = (data: unknown) =>
    new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });

  test("throws on HTTP error", async () => {
    const res = new Response(null, {
      status: 500,
      statusText: "Internal Server Error",
    });
    await expect(
      resolvePnpmVersionFromResponse("10.34.0", res),
    ).rejects.toThrow(
      "Failed to fetch version registry: Internal Server Error",
    );
  });

  test("resolves a pnpm tag", async () => {
    const res = createRes({ "dist-tags": { latest: "11.5.0" } });
    const version = await resolvePnpmVersionFromResponse("latest", res);
    expect(version).toBe("11.5.0");
  });

  test("resolves a pnpm version", async () => {
    const res = createRes({ versions: { "10.34.0": {} } });
    const version = await resolvePnpmVersionFromResponse("10.34.0", res);
    expect(version).toBe("10.34.0");
  });

  test("throws when response body is not an object", async () => {
    const res = createRes("10.34.0");
    await expect(
      resolvePnpmVersionFromResponse("10.34.0", res),
    ).rejects.toThrow("Unknown version: 10.34.0");
  });

  test("throws when response has no version fields", async () => {
    const res = createRes({});
    await expect(
      resolvePnpmVersionFromResponse("10.34.0", res),
    ).rejects.toThrow("Unknown version: 10.34.0");
  });

  test("throws when version is not in registry", async () => {
    const res = createRes({ versions: { "11.5.0": {} } });
    await expect(
      resolvePnpmVersionFromResponse("10.34.0", res),
    ).rejects.toThrow("Unknown version: 10.34.0");
  });
});

describe("resolvePnpmVersion", { concurrent: true }, () => {
  test("resolves a pnpm tag", async () => {
    const version = await resolvePnpmVersion("latest");
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("resolves a pnpm version", async () => {
    const version = await resolvePnpmVersion("10.34.0");
    expect(version).toBe("10.34.0");
  });
});

describe("getPnpmBinaryName", () => {
  test("returns pnpm for non-Windows platforms", () => {
    expect(getPnpmBinaryName("linux")).toBe("pnpm");
    expect(getPnpmBinaryName("darwin")).toBe("pnpm");
  });

  test("returns pnpm.exe for Windows", () => {
    expect(getPnpmBinaryName("win32")).toBe("pnpm.exe");
  });
});

describe("getPnpmDownloadUrl", { concurrent: true }, () => {
  const version = "10.34.0";

  const combinations = [
    { platform: "linux", arch: "x64" },
    { platform: "linux", arch: "arm64" },
    { platform: "darwin", arch: "x64" },
    { platform: "darwin", arch: "arm64" },
    { platform: "win32", arch: "x64" },
    { platform: "win32", arch: "arm64" },
  ] as const;

  test("returns unique URLs for each combination", () => {
    const urls = combinations.map(({ platform, arch }) =>
      getPnpmDownloadUrl({ version, platform, arch }),
    );
    expect(new Set(urls).size).toBe(combinations.length);
  });

  test.each(combinations)(
    "returns accessible URL for $platform/$arch",
    { timeout: 30000 },
    async ({ platform, arch }) => {
      const url = getPnpmDownloadUrl({ version, platform, arch });
      const res = await fetch(url, { method: "HEAD" });
      expect(res.ok).toBe(true);
    },
  );

  test("throws when platform is unsupported", () => {
    expect(() =>
      getPnpmDownloadUrl({ version, platform: "freebsd", arch: "x64" }),
    ).toThrow("Unsupported platform: freebsd");
  });

  test("throws when arch is unsupported", () => {
    expect(() =>
      getPnpmDownloadUrl({ version, platform: "linux", arch: "ia32" }),
    ).toThrow("Unsupported arch: ia32");
  });
});
