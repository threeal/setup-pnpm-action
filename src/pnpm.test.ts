import { describe, expect, test } from "vitest";
import { Arch, Platform } from "./input.js";
import {
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

describe("getPnpmDownloadUrl", { concurrent: true }, () => {
  const combinations = ["10.34.0", "11.5.0"]
    .flatMap((version) =>
      (["linux", "darwin", "win32"] satisfies Platform[]).flatMap((platform) =>
        (["x64", "arm64"] satisfies Arch[]).map((arch) => ({
          version,
          platform,
          arch,
        })),
      ),
    )
    .filter(
      ({ version, platform, arch }) =>
        version !== "11.5.0" || platform !== "darwin" || arch !== "x64",
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

  test("throws when version is invalid", () => {
    expect(() =>
      getPnpmDownloadUrl({ version: "latest", platform: "linux", arch: "x64" }),
    ).toThrow("Invalid version: latest");
  });

  test("throws for x64 macOS on version 11 and above", () => {
    expect(() =>
      getPnpmDownloadUrl({
        version: "11.5.0",
        platform: "darwin",
        arch: "x64",
      }),
    ).toThrow(
      "pnpm does not provide x64 macOS binaries for version 11 and above",
    );
  });
});
