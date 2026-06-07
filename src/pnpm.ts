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
  ext: "" | ".exe" | ".tar.gz" | ".zip";
} {
  const match = /^(\d+)/.exec(version);
  if (!match) throw new Error(`Invalid version: ${version}`);
  const major = parseInt(match[1], 10);

  const baseUrl = `https://github.com/pnpm/pnpm/releases/download/v${version}`;
  if (major < 11) {
    let os: string;
    switch (platform) {
      case "linux":
        os = "linux";
        break;
      case "darwin":
        os = "macos";
        break;
      case "win32":
        os = "win";
        break;
    }
    return {
      baseUrl,
      filename: `pnpm-${os}-${arch}`,
      ext: platform === "win32" ? ".exe" : "",
    };
  } else {
    if (platform === "darwin" && arch === "x64") {
      throw new Error(
        "pnpm does not provide x64 macOS binaries for version 11 and above",
      );
    }
    return {
      baseUrl,
      filename: `pnpm-${platform}-${arch}`,
      ext: platform == "win32" ? ".zip" : ".tar.gz",
    };
  }
}
