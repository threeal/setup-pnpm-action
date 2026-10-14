import { getInput } from "ghakit/io";
import { logError, logInfo } from "ghakit/log";
import { readFile } from "node:fs/promises";
import { arch, platform } from "node:os";
import { basename } from "node:path";

export type Platform = "linux" | "darwin" | "win32";

/**
 * Gets the platform of the current runner.
 *
 * Throws an error if the platform isn't one pnpm provides a build for.
 * @returns The runner's platform, as named by Node.js.
 */
export function getPlatform(): Platform {
  const val = platform();
  switch (val) {
    case "linux":
    case "darwin":
    case "win32":
      return val;
    default:
      throw new Error(`Unsupported platform: ${val}`);
  }
}

export type Arch = "x64" | "arm64";

/**
 * Gets the CPU architecture of the current runner.
 *
 * Throws an error if the architecture isn't one pnpm provides a build for.
 * @returns The runner's architecture, as named by Node.js.
 */
export function getArch(): Arch {
  const val = arch();
  switch (val) {
    case "x64":
    case "arm64":
      return val;
    default:
      throw new Error(`Unsupported arch: ${val}`);
  }
}

/**
 * Extracts the pnpm version from the `packageManager` field of a package.json.
 *
 * The field must have the form `pnpm@<major>.<minor>.<patch>`, optionally
 * followed by a `+` and a hash. Any other package manager, version format, or a
 * missing field throws an error.
 * @param packageJson - The parsed contents of a package.json file.
 * @returns The exact pnpm version, without the hash.
 */
export function extractVersionFromPackageJson(packageJson: unknown): string {
  if (typeof packageJson !== "object" || packageJson === null) {
    throw new Error("package.json must be an object");
  }

  if (!("packageManager" in packageJson)) {
    throw new Error("Missing `packageManager` field in package.json");
  }

  if (typeof packageJson.packageManager !== "string") {
    throw new Error("`packageManager` must be a string");
  }

  const match = /^([^@]+)@(\d+\.\d+\.\d+)(?:$|\+.*)$/.exec(
    packageJson.packageManager,
  );
  if (match?.length !== 3) {
    throw new Error(
      `Invalid \`packageManager\` value: ${packageJson.packageManager}`,
    );
  }

  if (match[1] !== "pnpm") {
    throw new Error(`Unsupported package manager: ${match[1]}, expected pnpm`);
  }

  return match[2];
}

/**
 * Gets the pnpm version to install from the action inputs.
 *
 * Uses the `version` input if set, otherwise the version read from the
 * `version-file` input, and throws an error if both are set. If neither is set,
 * falls back to the `packageManager` field of the package.json in the current
 * directory, and then to `latest` if that file is missing or has no valid
 * version.
 * @returns Either an exact version or a dist-tag such as `latest`.
 */
export async function getVersionInput(): Promise<string> {
  const version = getInput("version").trim();
  const versionFile = getInput("version-file").trim();

  if (version !== "") {
    if (versionFile !== "") {
      throw new Error(
        "Cannot specify both `version` and `version-file` inputs",
      );
    }
    return version;
  }

  if (versionFile !== "") {
    const versionFileName = basename(versionFile);
    if (versionFileName === "package.json") {
      logInfo("Read version from package.json");
      const content = await readFile(versionFile, "utf-8");
      return extractVersionFromPackageJson(JSON.parse(content));
    } else {
      throw new Error(`Unsupported version file: ${versionFileName}`);
    }
  }

  try {
    const content = await readFile("package.json", "utf-8");
    logInfo("No version specified, read version from package.json");
    try {
      return extractVersionFromPackageJson(JSON.parse(content));
    } catch (err) {
      logError(err);
      logInfo("Failed to read version from package.json, use latest");
      return "latest";
    }
  } catch {
    logInfo("No version specified, use latest");
    return "latest";
  }
}
