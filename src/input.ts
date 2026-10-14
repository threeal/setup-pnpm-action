import { getInput } from "ghakit/io";
import { logError, logInfo } from "ghakit/log";
import { readFile } from "node:fs/promises";
import { arch, platform } from "node:os";
import { basename } from "node:path";

export type Platform = "linux" | "darwin" | "win32";

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

export function extractVersionFromPackageJson(packageJson: unknown): string {
  if (typeof packageJson !== "object" || packageJson === null) {
    throw new Error("package.json must be an object");
  }

  if ("devEngines" in packageJson) {
    if (
      typeof packageJson.devEngines !== "object" ||
      packageJson.devEngines === null
    ) {
      throw new Error("`devEngines` must be an object");
    }

    const devEngines = packageJson.devEngines;
    if ("packageManager" in devEngines) {
      if (
        typeof devEngines.packageManager !== "object" ||
        devEngines.packageManager === null
      ) {
        throw new Error("`devEngines.packageManager` must be an object");
      }

      const packageManager = devEngines.packageManager;

      if (!("name" in packageManager)) {
        throw new Error(
          "Missing `name` field in `devEngines.packageManager`",
        );
      }

      if (typeof packageManager.name !== "string") {
        throw new Error("`devEngines.packageManager.name` must be a string");
      }

      if (packageManager.name !== "pnpm") {
        throw new Error(
          `Unsupported package manager: ${packageManager.name}, expected pnpm`,
        );
      }

      if (!("version" in packageManager)) {
        throw new Error(
          "Missing `version` field in `devEngines.packageManager`",
        );
      }

      if (typeof packageManager.version !== "string") {
        throw new Error(
          "`devEngines.packageManager.version` must be a string",
        );
      }

      const match = /^(?:\^|~|>=|<=|>|<|=)?(\d+\.\d+\.\d+)(?:$|\+.*)$/.exec(
        packageManager.version,
      );
      if (!match) {
        throw new Error(
          `Invalid \`devEngines.packageManager.version\` value: ${packageManager.version}`,
        );
      }

      return match[1];
    }
  }

  if ("packageManager" in packageJson) {
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
      throw new Error(
        `Unsupported package manager: ${match[1]}, expected pnpm`,
      );
    }

    return match[2];
  }

  throw new Error(
    "Missing `devEngines.packageManager` and `packageManager` fields in package.json",
  );
}

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
