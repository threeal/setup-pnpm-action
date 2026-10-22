import { describe, expect, test } from "vitest";
import { maxSatisfying, satisfies } from "./semver.js";

describe("satisfies", () => {
  test.each([
    { version: "10.34.0", range: "10.34.0", expected: true },
    { version: "10.34.5", range: "^10.34.0", expected: true },
    { version: "10.35.0", range: "~10.34.0", expected: false },
    { version: "11.0.0", range: ">=10.0.0 <11.0.0", expected: false },
    { version: "11.0.0-rc.0", range: ">=10.0.0", expected: false },
    { version: "11.0.0", range: "latest", expected: false },
  ])(
    "checks whether $version satisfies $range",
    ({ version, range, expected }) => {
      expect(satisfies(version, range)).toBe(expected);
    },
  );
});

describe("maxSatisfying", () => {
  const versions = [
    "11.5.0",
    "0.0.3",
    "0.0.4",
    "0.2.3",
    "0.2.9",
    "0.3.0",
    "10.33.0",
    "10.34.0",
    "10.34.5",
    "10.35.0",
    "11.0.0-rc.0",
    "11.0.0",
  ];

  test.each([
    { range: "10.34.0", expected: "10.34.0" },
    { range: "=10.34.0", expected: "10.34.0" },
    { range: "<10.34.0", expected: "10.33.0" },
    { range: "<=10.34.0", expected: "10.34.0" },
    { range: ">10.34.0", expected: "11.5.0" },
    { range: ">=10.34.0", expected: "11.5.0" },
    { range: "~10.34.0", expected: "10.34.5" },
    { range: "^10.34.0", expected: "10.35.0" },
    { range: "^0.2.3", expected: "0.2.9" },
    { range: "^0.0.3", expected: "0.0.3" },
    { range: ">=10.0.0 <11.0.0", expected: "10.35.0" },
    { range: " >=10.0.0   ~10.34.0 ", expected: "10.34.5" },
  ])("resolves $range to $expected", ({ range, expected }) => {
    expect(maxSatisfying(versions, range)).toBe(expected);
  });

  test("never resolves to a prerelease", () => {
    expect(maxSatisfying(versions, "<11.0.0 >10.35.0")).toBeUndefined();
  });

  test("returns undefined when no version satisfies the range", () => {
    expect(maxSatisfying(versions, "^12.0.0")).toBeUndefined();
  });

  test.each(["", "latest", "^11", "11.x", "^11.0.0-rc.0", "10.0.0 - 11.0.0"])(
    "throws for an unsupported range %j",
    (range) => {
      expect(() => maxSatisfying(versions, range)).toThrow(
        `Unsupported version range: ${range}`,
      );
    },
  );
});
