import { getRunnerToolCache } from "ghakit/vars";
import { join } from "node:path";
import { Arch, Platform } from "./input.js";

export async function fetchNpmPackageRegistry(pkg: string): Promise<unknown> {
  const res = await fetch(`https://registry.npmjs.org/${pkg}`);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch ${pkg} from npm registry: ${res.statusText}`,
    );
  }
  return res.json();
}

interface Version {
  major: number;
  minor: number;
  patch: number;
}

function compareVersions(a: Version, b: Version): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

const VERSION_RANGE_PATTERN = /^(\^|~|>=|<=|>|<|=)?(\d+)\.(\d+)\.(\d+)$/;

function parseVersionRange(
  range: string,
): ((version: Version) => boolean) | null {
  const match = VERSION_RANGE_PATTERN.exec(range);
  if (!match) return null;

  const [, operator, major, minor, patch] = match;
  const base: Version = {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
  };

  switch (operator) {
    case ">=":
      return (version) => compareVersions(version, base) >= 0;
    case "<=":
      return (version) => compareVersions(version, base) <= 0;
    case ">":
      return (version) => compareVersions(version, base) > 0;
    case "<":
      return (version) => compareVersions(version, base) < 0;
    case "^": {
      const upper: Version =
        base.major > 0
          ? { major: base.major + 1, minor: 0, patch: 0 }
          : base.minor > 0
            ? { major: 0, minor: base.minor + 1, patch: 0 }
            : { major: 0, minor: 0, patch: base.patch + 1 };
      return (version) =>
        compareVersions(version, base) >= 0 &&
        compareVersions(version, upper) < 0;
    }
    case "~": {
      const upper: Version = {
        major: base.major,
        minor: base.minor + 1,
        patch: 0,
      };
      return (version) =>
        compareVersions(version, base) >= 0 &&
        compareVersions(version, upper) < 0;
    }
    default:
      return (version) => compareVersions(version, base) === 0;
  }
}

function parseVersion(version: string): Version | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function getRegistryVersions(registry: unknown): string[] {
  if (typeof registry !== "object" || registry === null) {
    throw new Error("Registry must be an object");
  }

  if (!("versions" in registry)) {
    throw new Error("Missing `versions` field in registry");
  }

  const versions = registry.versions;
  if (typeof versions !== "object" || versions === null) {
    throw new Error("`versions` must be an object");
  }

  return Object.keys(versions);
}

function getRegistryDistTags(registry: unknown): Record<string, unknown> {
  if (typeof registry !== "object" || registry === null) {
    throw new Error("Registry must be an object");
  }

  if (!("dist-tags" in registry)) {
    throw new Error("Missing `dist-tags` field in registry");
  }

  const distTags = registry["dist-tags"];
  if (typeof distTags !== "object" || distTags === null) {
    throw new Error("`dist-tags` must be an object");
  }

  return distTags as Record<string, unknown>;
}

export function resolvePnpmVersion(input: string, registry: unknown): string {
  const matchesRange = parseVersionRange(input);
  if (matchesRange) {
    let best: { raw: string; parsed: Version } | null = null;
    for (const raw of getRegistryVersions(registry)) {
      const parsed = parseVersion(raw);
      if (!parsed || !matchesRange(parsed)) continue;
      if (!best || compareVersions(parsed, best.parsed) > 0) {
        best = { raw, parsed };
      }
    }
    if (!best) {
      throw new Error(`No pnpm version matching: ${input}`);
    }
    return best.raw;
  }

  const distTags = getRegistryDistTags(registry);
  const entry = Object.entries(distTags).find((entry) => entry[0] === input);
  if (!entry) {
    throw new Error(`Unknown tag: ${input}`);
  }

  if (typeof entry[1] !== "string") {
    throw new Error(`Tag ${input} did not resolve to a string`);
  }

  return entry[1];
}

export function getPnpmMajorVersion(version: string): number {
  const match = /^(\d+)/.exec(version);
  if (!match) throw new Error(`Invalid version: ${version}`);
  return parseInt(match[1], 10);
}

export function getPnpmHome({
  version,
  platform,
  arch,
}: {
  version: string;
  platform: Platform;
  arch: Arch;
}): string {
  return join(getRunnerToolCache(), "pnpm", `${version}-${platform}-${arch}`);
}

function getOsFromPlatform(platform: Platform): string {
  switch (platform) {
    case "linux":
      return "linux";
    case "darwin":
      return "macos";
    case "win32":
      return "win";
  }
}

export function getPnpmDownloadUrl({
  version,
  platform,
  arch,
}: {
  version: string;
  platform: Platform;
  arch: Arch;
}): {
  baseUrl: string;
  filename: string;
  ext: "" | ".exe";
} {
  return {
    baseUrl: `https://github.com/pnpm/pnpm/releases/download/v${version}`,
    filename: `pnpm-${getOsFromPlatform(platform)}-${arch}`,
    ext: platform === "win32" ? ".exe" : "",
  };
}

export function getPnpm11DownloadUrl({
  version,
  platform,
  arch,
}: {
  version: string;
  platform: Platform;
  arch: Arch;
}): {
  baseUrl: string;
  filename: string;
  ext: ".tar.gz" | ".zip";
} {
  if (platform === "darwin" && arch === "x64") {
    throw new Error(
      "pnpm does not provide x64 macOS binaries for version 11 and above",
    );
  }
  return {
    baseUrl: `https://github.com/pnpm/pnpm/releases/download/v${version}`,
    filename: `pnpm-${platform}-${arch}`,
    ext: platform === "win32" ? ".zip" : ".tar.gz",
  };
}
