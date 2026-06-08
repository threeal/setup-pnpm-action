import { exec } from "ghakit/exec";
import { addPath, setEnv, setOutput } from "ghakit/io";
import { beginLogGroup, endLogGroup, logCommand, logInfo } from "ghakit/log";
import { access, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { getArch, getPlatform, getVersionInput } from "./input.js";
import { extractArchive, makeExecutable } from "./install.js";
import {
  fecthNpmPackageRegistry,
  getPnpm11DownloadUrl,
  getPnpmDownloadUrl,
  getPnpmHome,
  getPnpmMajorVersion,
  resolvePnpmVersion,
  verifyPnpmVersion,
} from "./pnpm.js";

export async function setupPnpmAction() {
  const platform = getPlatform();
  const arch = getArch();

  let version = await getVersionInput();
  if (/^\d+\.\d+\.\d+/.test(version)) {
    logInfo(`Verify pnpm version ${version}`);
    const registry = await fecthNpmPackageRegistry("@pnpm/exe");
    verifyPnpmVersion(version, registry);
  } else {
    logInfo(`Resolve pnpm version from ${version}`);
    const registry = await fecthNpmPackageRegistry("@pnpm/exe");
    version = resolvePnpmVersion(version, registry);
    logInfo(`Use pnpm version ${version}`);
  }
  const majorVersion = getPnpmMajorVersion(version);

  const pnpmHome = getPnpmHome({ version, platform, arch });
  await setEnv("PNPM_HOME", pnpmHome);

  try {
    await access(pnpmHome);
    logInfo("Use cached pnpm");
  } catch {
    if (majorVersion < 11) {
      const { baseUrl, filename, ext } = getPnpmDownloadUrl({
        version,
        platform,
        arch,
      });
      const url = `${baseUrl}/${filename}${ext}`;

      logInfo("Create pnpm home");
      await mkdir(pnpmHome, { recursive: true });

      beginLogGroup("Download pnpm executable");
      const execFile = join(pnpmHome, `pnpm${ext}`);
      try {
        const args: string[] = ["-fL", "--output", execFile, url];
        logCommand("curl", ...args);
        await exec("curl", args);
      } finally {
        endLogGroup();
      }

      await makeExecutable(execFile, ext);
    } else {
      const { baseUrl, filename, ext } = getPnpm11DownloadUrl({
        version,
        platform,
        arch,
      });
      const url = `${baseUrl}/${filename}${ext}`;

      logInfo("Create pnpm home");
      await mkdir(pnpmHome, { recursive: true });

      beginLogGroup("Download pnpm archive");
      const archiveFile = join(pnpmHome, filename);
      try {
        const args: string[] = ["-fL", "--output", archiveFile, url];
        logCommand("curl", ...args);
        await exec("curl", args);
      } finally {
        endLogGroup();
      }

      beginLogGroup("Extract pnpm archive");
      try {
        await extractArchive(archiveFile, ext, pnpmHome);
      } finally {
        endLogGroup();
      }

      logInfo("Remove pnpm archive");
      await rm(archiveFile);
    }
  }

  logInfo("Add pnpm to PATH");
  await addPath(pnpmHome);

  await setOutput("version", version);
}
