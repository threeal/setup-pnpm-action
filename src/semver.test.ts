import { describe, expect, test } from "vitest";
import { createRangeMatcher, maxMatching, satisfies } from "./semver.js";

describe("createRangeMatcher", () => {
  test.each(["^11", ">= 10.0.0 <12", "10.0.0 - 11", "^10 || ^11"])(
    "creates a matcher for %j",
    (range) => {
      expect(createRangeMatcher(range)).toBeDefined();
    },
  );

  test.each([
    "",
    "latest",
    "^11.0.0-rc.0",
    "1.2.3.4",
    "^10 ||",
    "latest - 11.0.0",
    "10.0.0 - latest",
  ])("returns undefined for an unsupported range %j", (range) => {
    expect(createRangeMatcher(range)).toBeUndefined();
  });
});

describe("satisfies", () => {
  test.each([
    { version: "10.34.0", range: "10.34.0", expected: true },
    { version: "10.34.5", range: "^10.34.0", expected: true },
    { version: "10.35.0", range: "~10.34.0", expected: false },
    { version: "11.0.0", range: ">=10.0.0 <11.0.0", expected: false },
    { version: "10.34.5", range: ">10.34", expected: false },
    { version: "10.35.0", range: ">10.34", expected: true },
    { version: "0.0.0", range: ">*", expected: false },
    { version: "11.0.0-rc.0", range: ">=10.0.0", expected: false },
    { version: "11.0.0", range: "latest", expected: false },
  ])(
    "checks whether $version satisfies $range",
    ({ version, range, expected }) => {
      expect(satisfies(version, range)).toBe(expected);
    },
  );
});

describe("maxMatching", () => {
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

  /**
   * Finds the highest of the test versions that satisfies a version range.
   * @param range - The version range, which must be supported.
   * @returns The highest satisfying version, or `undefined` if none does.
   */
  function maxMatchingRange(range: string): string | undefined {
    const matcher = createRangeMatcher(range);
    if (matcher === undefined) throw new Error(`Invalid range: ${range}`);
    return maxMatching(versions, matcher);
  }

  test.each([
    { range: "10.34.0", expected: "10.34.0" },
    { range: "=10.34.0", expected: "10.34.0" },
    { range: "v10.34.0", expected: "10.34.0" },
    { range: "<10.34.0", expected: "10.33.0" },
    { range: "<=10.34.0", expected: "10.34.0" },
    { range: ">10.34.0", expected: "11.5.0" },
    { range: ">=10.34.0", expected: "11.5.0" },
    { range: "~10.34.0", expected: "10.34.5" },
    { range: "~>10.34.0", expected: "10.34.5" },
    { range: "^10.34.0", expected: "10.35.0" },
    { range: "^0.2.3", expected: "0.2.9" },
    { range: "^0.0.3", expected: "0.0.3" },
    { range: "10", expected: "10.35.0" },
    { range: "10.x", expected: "10.35.0" },
    { range: "10.34", expected: "10.34.5" },
    { range: "10.34.*", expected: "10.34.5" },
    { range: "*", expected: "11.5.0" },
    { range: "<11", expected: "10.35.0" },
    { range: "<=10.34", expected: "10.34.5" },
    { range: ">=10", expected: "11.5.0" },
    { range: "~10", expected: "10.35.0" },
    { range: "~10.34", expected: "10.34.5" },
    { range: "^10", expected: "10.35.0" },
    { range: "^0", expected: "0.3.0" },
    { range: "^0.2", expected: "0.2.9" },
    { range: "^0.0", expected: "0.0.4" },
    { range: ">=10.0.0 <11.0.0", expected: "10.35.0" },
    { range: " >=10.0.0   ~10.34.0 ", expected: "10.34.5" },
    { range: ">= 10.0.0 < 11.0.0", expected: "10.35.0" },
    { range: "10.0.0 - 10.34.0", expected: "10.34.0" },
    { range: "10.0.0 - 10.34", expected: "10.34.5" },
    { range: "10 - 10", expected: "10.35.0" },
    { range: "* - 10.33.0", expected: "10.33.0" },
    { range: "0.2.9 - *", expected: "11.5.0" },
    { range: "<0.1.0 || ~0.2.3", expected: "0.2.9" },
    { range: "^0.2.3 || ^10.33.0", expected: "10.35.0" },
  ])("resolves $range to $expected", ({ range, expected }) => {
    expect(maxMatchingRange(range)).toBe(expected);
  });

  test("never resolves to a prerelease", () => {
    expect(maxMatchingRange("<11.0.0 >10.35.0")).toBeUndefined();
  });

  test.each(["^12.0.0", "<*"])(
    "returns undefined when no version satisfies %j",
    (range) => {
      expect(maxMatchingRange(range)).toBeUndefined();
    },
  );
});
