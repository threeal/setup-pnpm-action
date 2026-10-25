/**
 * A version as its major, minor, and patch numbers.
 */
type Version = [number, number, number];

/**
 * A function that tells whether a version matches a version range.
 */
export type Matcher = (version: Version) => boolean;

/**
 * Parses a version of the form `<major>.<minor>.<patch>`.
 * @param version - The version to parse.
 * @returns The parsed version, or `undefined` if it isn't of that form, such
 * as a prerelease.
 */
function parseVersion(version: string): Version | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (match === null) return undefined;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Compares two versions.
 * @param a - The first version.
 * @param b - The second version.
 * @returns A negative number if `a` is lower than `b`, a positive number if
 * it's higher, or zero if they're equal.
 */
function compareVersions(a: Version, b: Version): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/**
 * Creates a matcher of the versions that satisfy a version range.
 *
 * A range is one or more space-separated comparators, all of which a version
 * must satisfy. Each comparator is a `<major>.<minor>.<patch>` version prefixed
 * by `<`, `<=`, `>`, `>=`, `=`, `~`, or `^`, where no prefix means `=`.
 * @param range - The version range, such as `^11.0.0` or `>=10.0.0 <12.0.0`.
 * @returns The matcher, or `undefined` if the range isn't supported.
 */
export function createRangeMatcher(range: string): Matcher | undefined {
  const matchers: Matcher[] = [];
  for (const comparator of range.trim().split(/\s+/)) {
    const match = /^([<>]=?|[=~^])?(\d+)\.(\d+)\.(\d+)$/.exec(comparator);
    if (match === null) return undefined;

    const base: Version = [
      Number(match[2]),
      Number(match[3]),
      Number(match[4]),
    ];
    const compare = (version: Version) => compareVersions(version, base);
    switch (match[1]) {
      case "<":
        matchers.push((version) => compare(version) < 0);
        break;

      case "<=":
        matchers.push((version) => compare(version) <= 0);
        break;

      case ">":
        matchers.push((version) => compare(version) > 0);
        break;

      case ">=":
        matchers.push((version) => compare(version) >= 0);
        break;

      // Allows patch changes.
      case "~": {
        const upper: Version = [base[0], base[1] + 1, 0];
        matchers.push(
          (version) =>
            compare(version) >= 0 && compareVersions(version, upper) < 0,
        );
        break;
      }

      // Allows changes that don't modify the leftmost non-zero number.
      case "^": {
        const upper: Version =
          base[0] > 0
            ? [base[0] + 1, 0, 0]
            : base[1] > 0
              ? [0, base[1] + 1, 0]
              : [0, 0, base[2] + 1];
        matchers.push(
          (version) =>
            compare(version) >= 0 && compareVersions(version, upper) < 0,
        );
        break;
      }

      default:
        matchers.push((version) => compare(version) === 0);
        break;
    }
  }
  return (version) => matchers.every((matcher) => matcher(version));
}

/**
 * Checks whether a version satisfies a version range.
 *
 * A version not of the form `<major>.<minor>.<patch>`, such as a prerelease,
 * never satisfies a range, and an unsupported range is never satisfied.
 * @param version - The version to check.
 * @param range - The version range, as described in
 * {@link createRangeMatcher}.
 * @returns Whether the version satisfies the range.
 */
export function satisfies(version: string, range: string): boolean {
  const parsed = parseVersion(version);
  const matcher = createRangeMatcher(range);
  if (parsed === undefined || matcher === undefined) return false;
  return matcher(parsed);
}

/**
 * Finds the highest version that a matcher matches.
 *
 * Versions not of the form `<major>.<minor>.<patch>`, such as prereleases,
 * never match.
 * @param versions - The versions to search.
 * @param matcher - The matcher, such as one from {@link createRangeMatcher}.
 * @returns The highest matching version, or `undefined` if none matches.
 */
export function maxMatching(
  versions: string[],
  matcher: Matcher,
): string | undefined {
  let max: { version: string; parsed: Version } | undefined;
  for (const version of versions) {
    const parsed = parseVersion(version);
    if (parsed === undefined || !matcher(parsed)) continue;
    if (max === undefined || compareVersions(parsed, max.parsed) > 0) {
      max = { version, parsed };
    }
  }
  return max?.version;
}
