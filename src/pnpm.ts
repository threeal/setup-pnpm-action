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

export function getPnpmBinaryName(platform: string): string {
  return platform === "win32" ? "pnpm.exe" : "pnpm";
}

export function getPnpmDownloadUrl({
  version,
  platform,
  arch,
}: {
  version: string;
  platform: string;
  arch: string;
}): string {
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
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  let archStr: string;
  switch (arch) {
    case "x64":
      archStr = "x64";
      break;
    case "arm64":
      archStr = "arm64";
      break;
    default:
      throw new Error(`Unsupported arch: ${arch}`);
  }

  const ext = platform === "win32" ? ".exe" : "";
  return `https://github.com/pnpm/pnpm/releases/download/v${version}/pnpm-${os}-${archStr}${ext}`;
}
