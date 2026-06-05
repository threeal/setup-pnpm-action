import { getInput } from "ghakit/io";
import { logInfo } from "ghakit/log";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

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

  logInfo("No version specified, use latest");
  return "latest";
}
