import { exec } from "ghakit/exec";
import { addPath, getInput, setEnv, setOutput } from "ghakit/io";
import { logCommand, logError, logInfo } from "ghakit/log";
import { getRunnerToolCache } from "ghakit/vars";
import {
  access,
  chmod,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { isNotFoundError } from "./fs.js";
import { extractVersionFromPnpmLock } from "./lockfile.js";
import { fetchNpmPackage } from "./npm.js";
import { findPnpmAsset, verifyPnpmVersion } from "./pnpm.js";
import { createRangeMatcher, maxMatching, satisfies } from "./semver.js";
import { readVersionFile, type VersionField } from "./version.js";

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
  let version = getInput("version").trim();
  let versionFile = getInput("version-file").trim();
  if (version !== "" && versionFile !== "") {
    throw new Error("Cannot specify both `version` and `version-file` inputs");
  }

  let isVersionVerified = false;
  if (version === "") {
    let versionField: VersionField | undefined;
    if (versionFile !== "") {
      logInfo(`Read pnpm version from ${versionFile}`);
      versionField = await readVersionFile(versionFile);
      if (versionField === undefined) {
        throw new Error(
          `Missing \`devEngines.packageManager\` or \`packageManager\` field in ${versionFile}`,
        );
      }
    } else {
      versionFile = "package.json";
      logInfo(`No version specified, read pnpm version from ${versionFile}`);
      try {
        versionField = await readVersionFile(versionFile);
        if (versionField === undefined) {
          logInfo(
            `No \`devEngines.packageManager\` or \`packageManager\` field in ${versionFile}, use latest`,
          );
          version = "latest";
        }
      } catch (err) {
        if (isNotFoundError(err)) {
          logInfo(`No ${versionFile} found, use latest`);
          version = "latest";
        } else {
          logError(err);
          logInfo(
            `Failed to read pnpm version from ${versionFile}, use latest`,
          );
          version = "latest";
        }
      }
    }

    if (versionField !== undefined) {
      if (versionField.version === undefined) {
        logInfo(
          `No version in the \`${versionField.key}\` field of ${versionFile}, use latest`,
        );
        version = "latest";
      } else {
        logInfo(
          `Found pnpm version ${versionField.version} in the \`${versionField.key}\` field of ${versionFile}`,
        );
        version = versionField.version;

        const lockfile = join(dirname(versionFile), "pnpm-lock.yaml");
        logInfo(`Read pnpm version from ${lockfile}`);
        try {
          const content = await readFile(lockfile, "utf-8");
          const lockedVersion = extractVersionFromPnpmLock(content);
          if (lockedVersion === undefined) {
            logInfo(`No pnpm version in ${lockfile}, ignore it`);
          } else if (!satisfies(lockedVersion, version)) {
            logInfo(
              `Found pnpm version ${lockedVersion} in ${lockfile}, which doesn't satisfy ${version}, ignore it`,
            );
          } else {
            logInfo(`Found pnpm version ${lockedVersion} in ${lockfile}`);
            version = lockedVersion;
            // Trusts the lockfile, since pnpm resolved the version it locks
            // from the npm registry.
            isVersionVerified = true;
          }
        } catch (err) {
          if (isNotFoundError(err)) {
            logInfo(`No ${lockfile} found, ignore it`);
          } else {
            logError(err);
            logInfo(`Failed to read pnpm version from ${lockfile}, ignore it`);
          }
        }
      }
    }
  }

  if (!/^\d+\.\d+\.\d+/.test(version)) {
    logInfo(`Resolve pnpm ${version} from npm registry`);
    const pkg = await fetchNpmPackage("@pnpm/exe");
    const taggedVersion = pkg["dist-tags"][version];
    if (typeof taggedVersion === "string") {
      logInfo(`Found pnpm version ${taggedVersion} tagged ${version}`);
      version = taggedVersion;
    } else {
      const matcher = createRangeMatcher(version);
      if (matcher === undefined) {
        throw new Error(`Unknown pnpm version range or tag: ${version}`);
      }
      const matchingVersion = maxMatching(Object.keys(pkg.versions), matcher);
      if (matchingVersion === undefined) {
        throw new Error(`No pnpm version satisfies ${version}`);
      }
      logInfo(`Found pnpm version ${matchingVersion} satisfying ${version}`);
      version = matchingVersion;
    }
    isVersionVerified = true;
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
    if (!isVersionVerified) {
      logInfo(`Verify pnpm version ${version} from npm registry`);
      const pkg = await fetchNpmPackage("@pnpm/exe");
      verifyPnpmVersion(version, pkg);
    }

    logInfo(`Find pnpm build for ${platform}/${arch} in GitHub releases`);
    const asset = await findPnpmAsset(version, platform, arch);

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
