import { getRunnerToolCache } from "ghakit/vars";
import { join } from "node:path";
import { Arch, Platform } from "./input.js";

/**
 * Fetches a package's metadata from the npm registry.
 * @param pkg - The name of the package to fetch.
 * @returns The package's metadata as parsed JSON, not yet validated.
 */
export async function fetchNpmPackageRegistry(pkg: string): Promise<unknown> {
  const res = await fetch(`https://registry.npmjs.org/${pkg}`);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch ${pkg} from npm registry: ${res.statusText}`,
    );
  }
  return res.json();
}

/**
 * Resolves a dist-tag to the exact pnpm version it points to.
 *
 * Throws an error if the registry metadata has no such dist-tag.
 * @param tag - The dist-tag to resolve, such as `latest`.
 * @param registry - The package metadata returned by `fetchNpmPackageRegistry`.
 * @returns The exact version the dist-tag points to.
 */
export function resolvePnpmVersion(tag: string, registry: unknown): string {
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

  const entry = Object.entries(distTags).find((entry) => entry[0] === tag);
  if (!entry) {
    throw new Error(`Unknown tag: ${tag}`);
  }

  if (typeof entry[1] !== "string") {
    throw new Error(`Tag ${tag} did not resolve to a string`);
  }

  return entry[1];
}

/**
 * Verifies that an exact pnpm version exists in the registry.
 *
 * Throws an error if the registry metadata doesn't list the version. Unlike
 * `resolvePnpmVersion`, this doesn't accept a dist-tag.
 * @param tag - The exact version to verify.
 * @param registry - The package metadata returned by `fetchNpmPackageRegistry`.
 */
export function verifyPnpmVersion(tag: string, registry: unknown): void {
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

  const entry = Object.entries(versions).find((entry) => entry[0] === tag);
  if (!entry) {
    throw new Error(`Unknown version: ${tag}`);
  }
}

/**
 * Gets the major part of a pnpm version.
 * @param version - The exact version.
 * @returns The major version number.
 */
export function getPnpmMajorVersion(version: string): number {
  const match = /^(\d+)/.exec(version);
  if (!match) throw new Error(`Invalid version: ${version}`);
  return parseInt(match[1], 10);
}

/**
 * Gets the directory a pnpm build is installed into.
 *
 * The directory sits in the runner's tool cache and is unique to each version,
 * platform, and architecture, so an existing one means that build is cached.
 * @param options - The build to get the directory for.
 * @param options.version - The exact pnpm version.
 * @param options.platform - The runner's platform.
 * @param options.arch - The runner's architecture.
 * @returns The path of the directory.
 */
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

/**
 * Gets the OS name used in the file names of pnpm 10 and below releases.
 * @param platform - The runner's platform, as named by Node.js.
 * @returns The OS name, such as `macos` for `darwin`.
 */
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

/**
 * Gets the download URL parts of a pnpm 10 and below release.
 *
 * These releases are standalone executables, named with the OS names from
 * `getOsFromPlatform`. For pnpm 11 and above, use `getPnpm11DownloadUrl`.
 * @param options - The build to download.
 * @param options.version - The exact pnpm version.
 * @param options.platform - The runner's platform.
 * @param options.arch - The runner's architecture.
 * @returns The release's base URL, the executable's file name without its
 * extension, and the extension, which is `.exe` on Windows and empty elsewhere.
 */
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

/**
 * Gets the download URL parts of a pnpm 11 and above release.
 *
 * These releases are archives, named with the platform names from Node.js.
 * Throws an error on x64 macOS, which these releases have no build for. For
 * pnpm 10 and below, use `getPnpmDownloadUrl`.
 * @param options - The build to download.
 * @param options.version - The exact pnpm version.
 * @param options.platform - The runner's platform.
 * @param options.arch - The runner's architecture.
 * @returns The release's base URL, the archive's file name without its
 * extension, and the extension, which is `.zip` on Windows and `.tar.gz`
 * elsewhere.
 */
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
