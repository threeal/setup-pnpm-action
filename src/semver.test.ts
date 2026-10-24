import { describe, expect, test } from "vitest";
import { isValidRange, maxSatisfying, satisfies } from "./semver.js";

describe("isValidRange", () => {
  test.each([
    { range: "^11", expected: true },
    { range: ">= 10.0.0 <12", expected: true },
    { range: "10.0.0 - 11", expected: true },
    { range: "^10 || ^11", expected: true },
    { range: "latest", expected: false },
    { range: "^11.0.0-rc.0", expected: false },
  ])("checks whether $range is valid", ({ range, expected }) => {
    expect(isValidRange(range)).toBe(expected);
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
    expect(maxSatisfying(versions, range)).toBe(expected);
  });

  test("never resolves to a prerelease", () => {
    expect(maxSatisfying(versions, "<11.0.0 >10.35.0")).toBeUndefined();
  });

  test.each(["^12.0.0", "<*"])(
    "returns undefined when no version satisfies %j",
    (range) => {
      expect(maxSatisfying(versions, range)).toBeUndefined();
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
  ])("throws for an unsupported range %j", (range) => {
    expect(() => maxSatisfying(versions, range)).toThrow(
      `Unsupported version range: ${range}`,
    );
  });
});
