/**
 * A version as its major, minor, and patch numbers.
 */
type Version = [number, number, number];

/**
 * A check of whether a version satisfies part of a version range.
 */
type Check = (version: Version) => boolean;

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
 * A version that may be partial, as its numbers with the missing ones as
 * zeros, and how many of them are given.
 */
interface PartialVersion {
  base: Version;
  count: number;
}

/**
 * Parses a version that may be partial, such as `1.2.3`, `1.2`, `1.x`, or `*`.
 *
 * Any number after an `x`, `X`, or `*` wildcard is ignored, as npm does.
 * @param version - The version to parse, optionally prefixed by `v`.
 * @returns The parsed version, or `undefined` if it isn't of that form.
 */
function parsePartialVersion(version: string): PartialVersion | undefined {
  if (!/^v?(?:\d+|[xX*])(?:\.(?:\d+|[xX*])){0,2}$/.test(version)) {
    return undefined;
  }

  const base: Version = [0, 0, 0];
  let count = 0;
  for (const part of version.replace(/^v/, "").split(".")) {
    if (!/^\d+$/.test(part)) break;
    base[count] = Number(part);
    count++;
  }
  return { base, count };
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
 * Raises one number of a version, resetting the numbers after it to zero.
 * @param version - The version to raise.
 * @param index - The index of the number to raise.
 * @returns The raised version.
 */
function bumpVersion(version: Version, index: number): Version {
  switch (index) {
    case 0:
      return [version[0] + 1, 0, 0];

    case 1:
      return [version[0], version[1] + 1, 0];

    default:
      return [version[0], version[1], version[2] + 1];
  }
}

/**
 * Creates a check of whether a version is at least a lower bound.
 * @param lower - The lower bound, inclusive.
 * @returns The check.
 */
function atLeast(lower: Version): Check {
  return (version) => compareVersions(version, lower) >= 0;
}

/**
 * Creates a check of whether a version is below an upper bound.
 * @param upper - The upper bound, exclusive.
 * @returns The check.
 */
function below(upper: Version): Check {
  return (version) => compareVersions(version, upper) < 0;
}

/**
 * Parses a comparator into the checks a version must all pass to satisfy it.
 *
 * A comparator is a version, which may be partial, prefixed by `<`, `<=`, `>`,
 * `>=`, `=`, `~`, `~>`, or `^`, where no prefix means `=`. A partial version
 * stands for every version starting with the numbers it gives.
 * @param comparator - The comparator, such as `^11`, `>=10.0.0`, or `11.x`.
 * @returns The checks, or `undefined` if the comparator isn't supported.
 */
function parseComparator(comparator: string): Check[] | undefined {
  const operator = /^(?:<=?|>=?|~>?|\^|=)/.exec(comparator)?.[0] ?? "";
  const partial = parsePartialVersion(comparator.slice(operator.length));
  if (partial === undefined) return undefined;

  const { base, count } = partial;
  // A wildcard allows any version, unless it's an exclusive bound.
  if (count === 0) {
    return operator === "<" || operator === ">" ? [() => false] : [];
  }

  // The lowest version above every version starting with the given numbers.
  const next = bumpVersion(base, count - 1);
  switch (operator) {
    case "<":
      return [below(base)];

    case "<=":
      return [below(next)];

    case ">":
      return [atLeast(next)];

    case ">=":
      return [atLeast(base)];

    // Allows patch changes, or minor changes if only the major is given.
    case "~":
    case "~>":
      return [atLeast(base), below(bumpVersion(base, count === 1 ? 0 : 1))];

    // Allows changes that don't modify the leftmost non-zero number given.
    case "^": {
      const index = base.slice(0, count).findIndex((number) => number > 0);
      return [
        atLeast(base),
        below(bumpVersion(base, index < 0 ? count - 1 : index)),
      ];
    }

    default:
      return [atLeast(base), below(next)];
  }
}

/**
 * Parses a set of comparators into the checks a version must all pass to
 * satisfy it.
 *
 * A set is either one or more space-separated comparators, as described in
 * {@link parseComparator}, or a hyphen range of two versions, which may be
 * partial, such as `10.0.0 - 11`.
 * @param set - The set of comparators.
 * @returns The checks, or `undefined` if the set isn't supported.
 */
function parseComparatorSet(set: string): Check[] | undefined {
  // Joins operators separated from their versions by whitespace.
  const trimmed = set.trim().replace(/([<>]=?|~>?|\^|=)\s+/g, "$1");
  if (trimmed === "") return undefined;

  const hyphen = /^(\S+)\s+-\s+(\S+)$/.exec(trimmed);
  if (hyphen !== null) {
    const lower = parsePartialVersion(hyphen[1]);
    const upper = parsePartialVersion(hyphen[2]);
    if (lower === undefined || upper === undefined) return undefined;

    const checks: Check[] = [];
    if (lower.count > 0) checks.push(atLeast(lower.base));
    if (upper.count > 0) {
      checks.push(below(bumpVersion(upper.base, upper.count - 1)));
    }
    return checks;
  }

  const checks: Check[] = [];
  for (const comparator of trimmed.split(/\s+/)) {
    const comparatorChecks = parseComparator(comparator);
    if (comparatorChecks === undefined) return undefined;
    checks.push(...comparatorChecks);
  }
  return checks;
}

/**
 * Parses a version range into a check of whether a version satisfies it.
 *
 * A range follows npm's syntax: one or more sets of comparators joined by
 * `||`, as described in {@link parseComparatorSet}, where a version must
 * satisfy any one of the sets. Ranges involving prerelease versions aren't
 * supported.
 * @param range - The version range, such as `^11`, `>=10.0.0 <12.0.0`, or
 * `^10 || ^11`.
 * @returns The check, or `undefined` if the range isn't supported.
 */
function parseRange(range: string): Check | undefined {
  const sets: Check[][] = [];
  for (const set of range.split("||")) {
    const checks = parseComparatorSet(set);
    if (checks === undefined) return undefined;
    sets.push(checks);
  }
  return (version) =>
    sets.some((checks) => checks.every((check) => check(version)));
}

/**
 * Checks whether a version range is supported.
 * @param range - The version range, as described in {@link parseRange}.
 * @returns Whether the range is supported.
 */
export function isValidRange(range: string): boolean {
  return parseRange(range) !== undefined;
}

/**
 * Checks whether a version satisfies a version range.
 *
 * A version not of the form `<major>.<minor>.<patch>`, such as a prerelease,
 * never satisfies a range, and an unsupported range is never satisfied.
 * @param version - The version to check.
 * @param range - The version range, as described in {@link parseRange}.
 * @returns Whether the version satisfies the range.
 */
export function satisfies(version: string, range: string): boolean {
  const parsed = parseVersion(version);
  const check = parseRange(range);
  if (parsed === undefined || check === undefined) return false;
  return check(parsed);
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
