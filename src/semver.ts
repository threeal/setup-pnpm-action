/**
 * A version as its major, minor, and patch numbers.
 */
type Version = [number, number, number];

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
 * Parses a version range into a check of whether a version satisfies it.
 *
 * A range is one or more space-separated comparators, all of which a version
 * must satisfy. Each comparator is a `<major>.<minor>.<patch>` version prefixed
 * by `<`, `<=`, `>`, `>=`, `=`, `~`, or `^`, where no prefix means `=`.
 * @param range - The version range, such as `^11.0.0` or `>=10.0.0 <12.0.0`.
 * @returns The check, or `undefined` if the range isn't supported.
 */
function parseRange(
  range: string,
): ((version: Version) => boolean) | undefined {
  const checks: ((version: Version) => boolean)[] = [];
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
        checks.push((version) => compare(version) < 0);
        break;

      case "<=":
        checks.push((version) => compare(version) <= 0);
        break;

      case ">":
        checks.push((version) => compare(version) > 0);
        break;

      case ">=":
        checks.push((version) => compare(version) >= 0);
        break;

      // Allows patch changes.
      case "~": {
        const upper: Version = [base[0], base[1] + 1, 0];
        checks.push(
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
        checks.push(
          (version) =>
            compare(version) >= 0 && compareVersions(version, upper) < 0,
        );
        break;
      }

      default:
        checks.push((version) => compare(version) === 0);
        break;
    }
  }
  return (version) => checks.every((check) => check(version));
}

/**
 * Finds the highest version that satisfies a version range.
 *
 * Throws an error if the range isn't supported. Versions not of the form
 * `<major>.<minor>.<patch>`, such as prereleases, never satisfy a range.
 * @param versions - The versions to search.
 * @param range - The version range, as described in {@link parseRange}.
 * @returns The highest satisfying version, or `undefined` if none does.
 */
export function maxSatisfying(
  versions: string[],
  range: string,
): string | undefined {
  const satisfies = parseRange(range);
  if (satisfies === undefined) {
    throw new Error(`Unsupported version range: ${range}`);
  }

  let max: { version: string; parsed: Version } | undefined;
  for (const version of versions) {
    const parsed = parseVersion(version);
    if (parsed === undefined || !satisfies(parsed)) continue;
    if (max === undefined || compareVersions(parsed, max.parsed) > 0) {
      max = { version, parsed };
    }
  }
  return max?.version;
}
