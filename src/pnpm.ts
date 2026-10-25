import type { NpmPackage } from "./npm.js";

/**
 * Verifies that an exact pnpm version is published.
 * @param version - The exact version.
 * @param pkg - The `pnpm` metadata from the npm registry.
 */
export function verifyPnpmVersion(version: string, pkg: NpmPackage): void {
  if (!Object.hasOwn(pkg.versions, version)) {
    throw new Error(`Unknown pnpm version: ${version}`);
  }
}

/**
 * A pnpm release asset, and how to install it once downloaded.
 *
 * A `binary` or `exe` is the pnpm executable itself, where only a `binary` needs
 * to be made executable, while a `tar.gz` or `zip` is an archive to extract.
 * The `fileName` is what the download is saved as.
 */
export interface PnpmAsset {
  type: "binary" | "exe" | "tar.gz" | "zip";
  url: string;
  fileName: string;
}

const OS_NAMES = { linux: "linux", darwin: "macos", win32: "win" } as const;

/**
 * Finds the release asset of a pnpm version for a platform and architecture.
 *
 * pnpm 10 and below are released as standalone executables named with their
 * own OS names, while pnpm 11 and above are released as archives named with
 * the platform names from Node.js. Not every release has a build for every
 * platform and architecture, such as x64 macOS in later pnpm 11 releases, so
 * this checks that the release provides the asset without downloading it.
 *
 * Throws an error if the platform or architecture isn't supported, if the
 * release doesn't provide the asset, or if it can't be checked.
 * @param version - The exact pnpm version.
 * @param platform - The runner's platform, as named by Node.js.
 * @param arch - The runner's architecture, as named by Node.js.
 * @returns The asset to download.
 */
export async function findPnpmAsset(
  version: string,
  platform: string,
  arch: string,
): Promise<PnpmAsset> {
  if (platform !== "linux" && platform !== "darwin" && platform !== "win32") {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  if (arch !== "x64" && arch !== "arm64") {
    throw new Error(`Unsupported arch: ${arch}`);
  }

  const baseUrl = `https://github.com/pnpm/pnpm/releases/download/v${version}`;

  let asset: PnpmAsset;
  if (parseInt(version, 10) < 11) {
    const name = `pnpm-${OS_NAMES[platform]}-${arch}`;
    asset =
      platform === "win32"
        ? { type: "exe", url: `${baseUrl}/${name}.exe`, fileName: "pnpm.exe" }
        : { type: "binary", url: `${baseUrl}/${name}`, fileName: "pnpm" };
  } else {
    const type = platform === "win32" ? "zip" : "tar.gz";
    const fileName = `pnpm-${platform}-${arch}.${type}`;
    asset = { type, url: `${baseUrl}/${fileName}`, fileName };
  }

  const res = await fetch(asset.url, { method: "HEAD" });
  if (res.status === 404) {
    throw new Error(
      `pnpm does not provide a build of version ${version} for ${platform}/${arch}`,
    );
  }
  if (!res.ok) {
    throw new Error(
      `Failed to find pnpm build at ${asset.url}: ${res.statusText}`,
    );
  }
  return asset;
}
