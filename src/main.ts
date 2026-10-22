import { exec } from "ghakit/exec";
import { addPath, getInput, setEnv, setOutput } from "ghakit/io";
import { logCommand, logError, logInfo } from "ghakit/log";
import { getRunnerToolCache } from "ghakit/vars";
import { existsSync } from "node:fs";
import { access, chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fetchNpmPackage } from "./npm.js";
import {
  getPnpmAsset,
  resolvePnpmRange,
  resolvePnpmTag,
  verifyPnpmVersion,
} from "./pnpm.js";
import { readVersionFile } from "./version.js";

/**
 * Logs a command and then runs it.
 * @param command - The command to run.
 * @param args - The arguments of the command.
 */
async function run(command: string, args: string[]): Promise<void> {
  logCommand(command, ...args);
  await exec(command, args);
}

try {
  const versionInput = getInput("version").trim();
  const versionFile = getInput("version-file").trim();
  if (versionInput !== "" && versionFile !== "") {
    throw new Error("Cannot specify both `version` and `version-file` inputs");
  }

  let version: string | undefined;
  if (versionInput !== "") {
    version = versionInput;
  } else if (versionFile !== "") {
    logInfo(`Read pnpm version from ${versionFile}`);
    version = await readVersionFile(versionFile);
    if (version === undefined) {
      throw new Error(
        `Missing \`devEngines.packageManager\` or \`packageManager\` field in ${versionFile}`,
      );
    }
  } else if (existsSync("package.json")) {
    logInfo("No version specified, read pnpm version from package.json");
    try {
      version = await readVersionFile("package.json");
      if (version === undefined) {
        logInfo(
          "No `devEngines.packageManager` or `packageManager` field in package.json, use latest",
        );
      }
    } catch (err) {
      logError(err);
      logInfo("Failed to read pnpm version from package.json, use latest");
    }
  } else {
    logInfo("No version specified, use latest");
  }
  version ??= "latest";

  let isVersionVerified = false;
  if (!/^\d+\.\d+\.\d+/.test(version)) {
    // npm rejects tags that are valid version ranges, so a version starting
    // with a range operator is never a tag.
    if (/^[<>=~^]/.test(version)) {
      logInfo(`Resolve pnpm version range ${version} from npm registry`);
      const pkg = await fetchNpmPackage("@pnpm/exe");
      version = resolvePnpmRange(version, pkg);
    } else {
      logInfo(`Resolve pnpm tag ${version} from npm registry`);
      const pkg = await fetchNpmPackage("@pnpm/exe");
      version = resolvePnpmTag(version, pkg);
    }
    isVersionVerified = true;
    logInfo(`Use pnpm version ${version}`);
  }

  const { platform, arch } = process;
  const pnpmHome = join(
    getRunnerToolCache(),
    "pnpm",
    `${version}-${platform}-${arch}`,
  );

  const completeMarker = join(pnpmHome, ".complete");
  try {
    await access(completeMarker);
    logInfo(`Use cached pnpm from ${pnpmHome}`);
  } catch {
    // Verifies here rather than up front, since a cached version was already
    // verified when it was installed.
    if (!isVersionVerified) {
      logInfo(`Verify pnpm version ${version} from npm registry`);
      const pkg = await fetchNpmPackage("@pnpm/exe");
      verifyPnpmVersion(version, pkg);
    }

    const asset = getPnpmAsset(version, platform, arch);
    logInfo(`Install pnpm to ${pnpmHome}`);
    // Clears anything left by a previous install that didn't complete.
    await rm(pnpmHome, { recursive: true, force: true });
    await mkdir(pnpmHome, { recursive: true });

    const file = join(pnpmHome, asset.fileName);
    await run("curl", ["-fsSL", "--output", file, asset.url]);

    switch (asset.type) {
      case "binary":
        await chmod(file, 0o755);
        break;

      case "exe":
        break;

      case "tar.gz":
        await run("tar", ["-xzf", file, "-C", pnpmHome]);
        await rm(file);
        break;

      case "zip":
        await run("unzip", ["-q", file, "-d", pnpmHome]);
        await rm(file);
        break;
    }

    await writeFile(completeMarker, "");
  }

  logInfo("Add pnpm to PATH");
  await setEnv("PNPM_HOME", pnpmHome);
  await addPath(pnpmHome);
  await setOutput("version", version);
} catch (err: unknown) {
  logError(err);
  process.exitCode = 1;
}
