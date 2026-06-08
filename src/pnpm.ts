import { Arch, Platform } from "./input.js";

export async function resolvePnpmVersionFromResponse(
  version: string,
  res: Response,
): Promise<string> {
  if (!res.ok) {
    throw new Error(`Failed to fetch version registry: ${res.statusText}`);
  }

  const data = await res.json();
  if (typeof data === "object" && data !== null) {
    if (
      "dist-tags" in data &&
      typeof data["dist-tags"] === "object" &&
      data["dist-tags"] !== null
    ) {
      const distTags = data["dist-tags"] as Record<string, unknown>;
      if (version in distTags && typeof distTags[version] === "string") {
        return distTags[version];
      }
    }

    if (
      "versions" in data &&
      typeof data.versions === "object" &&
      data.versions !== null
    ) {
      if (version in data.versions) return version;
    }
  }

  throw new Error(`Unknown version: ${version}`);
}

export async function resolvePnpmVersion(version: string): Promise<string> {
  const res = await fetch("https://registry.npmjs.org/@pnpm/exe");
  return resolvePnpmVersionFromResponse(version, res);
}

export function getPnpmMajorVersion(version: string): number {
  const match = /^(\d+)/.exec(version);
  if (!match) throw new Error(`Invalid version: ${version}`);
  return parseInt(match[1], 10);
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
    ext: platform == "win32" ? ".zip" : ".tar.gz",
  };
}
