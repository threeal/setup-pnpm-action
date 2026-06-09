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
