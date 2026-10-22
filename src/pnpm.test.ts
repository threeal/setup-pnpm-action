import { describe, expect, test } from "vitest";
import {
  getPnpmAsset,
  resolvePnpmRange,
  resolvePnpmTag,
  verifyPnpmVersion,
} from "./pnpm.js";

const pkg = {
  "dist-tags": { latest: "11.5.0" },
  versions: { "10.34.0": {}, "11.5.0": {} },
};

describe("verifyPnpmVersion", () => {
  test("accepts a published version", () => {
    expect(() => {
      verifyPnpmVersion("10.34.0", pkg);
    }).not.toThrow();
  });

  test("throws for an unknown version", () => {
    expect(() => {
      verifyPnpmVersion("0.0.0", pkg);
    }).toThrow("Unknown pnpm version: 0.0.0");
  });
});

describe("resolvePnpmTag", () => {
  test("resolves a tag", () => {
    expect(resolvePnpmTag("latest", pkg)).toBe("11.5.0");
  });

  test("throws for an unknown tag", () => {
    expect(() => resolvePnpmTag("unknown", pkg)).toThrow(
      "Unknown pnpm tag: unknown",
    );
  });
});

describe("resolvePnpmRange", () => {
  test("resolves a range", () => {
    expect(resolvePnpmRange("^10.0.0", pkg)).toBe("10.34.0");
  });

  test("throws for a range no version satisfies", () => {
    expect(() => resolvePnpmRange("^12.0.0", pkg)).toThrow(
      "No pnpm version satisfies range: ^12.0.0",
    );
  });
});

describe("getPnpmAsset", { concurrent: true }, () => {
  const combinations = ["9.15.0", "10.34.0", "11.5.0"]
    .flatMap((version) =>
      ["linux", "darwin", "win32"].flatMap((platform) =>
        ["x64", "arm64"].map((arch) => ({ version, platform, arch })),
      ),
    )
    .filter(
      ({ version, platform, arch }) =>
        version !== "11.5.0" || platform !== "darwin" || arch !== "x64",
    );

  test.each(combinations)(
    "returns a downloadable asset for $version/$platform/$arch",
    { timeout: 30000 },
    async ({ version, platform, arch }) => {
      const { url } = getPnpmAsset(version, platform, arch);
      const res = await fetch(url, { method: "HEAD" });
      expect(res.ok).toBe(true);
    },
  );

  test("throws for an unsupported platform", () => {
    expect(() => getPnpmAsset("11.5.0", "freebsd", "x64")).toThrow(
      "Unsupported platform: freebsd",
    );
  });

  test("throws for an unsupported arch", () => {
    expect(() => getPnpmAsset("11.5.0", "linux", "ia32")).toThrow(
      "Unsupported arch: ia32",
    );
  });

  test("throws for x64 macOS on version 11 and above", () => {
    expect(() => getPnpmAsset("11.5.0", "darwin", "x64")).toThrow(
      "pnpm does not provide x64 macOS binaries for version 11 and above",
    );
  });
});
