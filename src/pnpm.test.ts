import { describe, expect, test } from "vitest";
import {
  findPnpmAsset,
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

describe("findPnpmAsset", { concurrent: true }, () => {
  const combinations = ["9.15.0", "10.34.0", "12.15.0"].flatMap((version) =>
    ["linux", "darwin", "win32"].flatMap((platform) =>
      ["x64", "arm64"].map((arch) => ({ version, platform, arch })),
    ),
  );

  test.each(combinations)(
    "finds the asset for $version/$platform/$arch",
    { timeout: 30000 },
    async ({ version, platform, arch }) => {
      const { url } = await findPnpmAsset(version, platform, arch);
      expect(url).toContain(`/v${version}/`);
    },
  );

  test("throws for an unsupported platform", async () => {
    await expect(findPnpmAsset("12.15.0", "freebsd", "x64")).rejects.toThrow(
      "Unsupported platform: freebsd",
    );
  });

  test("throws for an unsupported arch", async () => {
    await expect(findPnpmAsset("12.15.0", "linux", "ia32")).rejects.toThrow(
      "Unsupported arch: ia32",
    );
  });

  test(
    "throws for a build that isn't provided",
    { timeout: 30000 },
    async () => {
      await expect(findPnpmAsset("11.5.0", "darwin", "x64")).rejects.toThrow(
        "pnpm does not provide a build of version 11.5.0 for darwin/x64",
      );
    },
  );

  test("throws for a failed request", { timeout: 30000 }, async () => {
    // GitHub rejects the malformed `%` in the release URL with 400 Bad Request.
    await expect(findPnpmAsset("%", "linux", "x64")).rejects.toThrow(
      "Failed to find pnpm build at https://github.com/pnpm/pnpm/releases/download/v%/pnpm-linux-x64.tar.gz: Bad Request",
    );
  });
});
