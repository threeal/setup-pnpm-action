import { exec } from "ghakit/exec";
import { addPath, setEnv, setOutput } from "ghakit/io";
import { beginLogGroup, endLogGroup, logCommand, logInfo } from "ghakit/log";
import { getRunnerToolCache } from "ghakit/vars";
import { access, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { getArch, getPlatform, getVersionInput } from "./input.js";
import { extractArchive, makeExecutable } from "./install.js";
import { getPnpmDownloadUrl, resolvePnpmVersion } from "./pnpm.js";

export async function setupPnpmAction() {
  const platform = getPlatform();
  const arch = getArch();

  const versionInput = await getVersionInput();

  logInfo("Resolve pnpm version");
  const version = await resolvePnpmVersion(versionInput);

  const pnpmHome = join(getRunnerToolCache(), "pnpm", version);
  await setEnv("PNPM_HOME", pnpmHome);

  try {
    await access(pnpmHome);
    logInfo(`Use cached pnpm ${version}`);
  } catch {
    const { baseUrl, filename, ext } = getPnpmDownloadUrl({
      version,
      platform,
      arch,
    });
    const url = `${baseUrl}/${filename}${ext}`;

    logInfo("Create pnpm home");
    await mkdir(pnpmHome, { recursive: true });

    switch (ext) {
      case "":
      case ".exe": {
        const pnpmFile = join(pnpmHome, `pnpm${ext}`);

        beginLogGroup(`Download pnpm ${version} executable`);
        try {
          const args: string[] = ["-fL", "--output", pnpmFile, url];
          logCommand("curl", ...args);
          await exec("curl", args);
        } finally {
          endLogGroup();
        }

        await makeExecutable(pnpmFile, ext);
        break;
      }

      case ".tar.gz":
      case ".zip": {
        const archiveFile = join(pnpmHome, filename);

        beginLogGroup(`Download pnpm ${version} archive`);
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
        break;
      }
    }
  }

  logInfo("Add pnpm to PATH");
  await addPath(pnpmHome);

  await setOutput("version", version);
}
