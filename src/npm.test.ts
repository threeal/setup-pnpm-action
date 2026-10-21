import { describe, expect, test } from "vitest";
import { fetchNpmPackage, parseNpmPackage } from "./npm.js";

describe("parseNpmPackage", () => {
  test("returns the package metadata", () => {
    const data = {
      name: "@pnpm/exe",
      "dist-tags": { latest: "11.5.0" },
      versions: { "11.5.0": {} },
    };
    expect(parseNpmPackage(data)).toStrictEqual({
      "dist-tags": { latest: "11.5.0" },
      versions: { "11.5.0": {} },
    });
  });

  test("throws for invalid package metadata", () => {
    expect(() => parseNpmPackage({ "dist-tags": {} })).toThrow(
      "Invalid npm package metadata",
    );
  });
});

describe("fetchNpmPackage", { concurrent: true }, () => {
  test("returns the package metadata", async () => {
    const pkg = await fetchNpmPackage("@pnpm/exe");
    expect(pkg.versions).toHaveProperty(["10.34.0"]);
  });

  test("throws for a package that doesn't exist", async () => {
    await expect(fetchNpmPackage("@pnpm/exeee")).rejects.toThrow(
      "Failed to fetch @pnpm/exeee from npm registry: Not Found",
    );
  });
});
