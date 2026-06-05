import { exec } from "ghakit/exec";
import { addPath, getInput, setEnv } from "ghakit/io";
import { beginLogGroup, endLogGroup, logCommand, logInfo } from "ghakit/log";
import { getRunnerToolCache } from "ghakit/vars";
import { access, chmod, mkdir, rm } from "node:fs/promises";
import { arch, platform } from "node:os";
import { extname, join } from "node:path";
import { extractArchive } from "./archive.js";
import { getPnpmDownloadUrl, resolvePnpmVersion } from "./pnpm.js";

export async function setupPnpmAction() {
  logInfo("Resolve pnpm version");
  const version = await resolvePnpmVersion(getInput("version").trim());

  const pnpmHome = join(getRunnerToolCache(), "pnpm", version);
  try {
    await access(pnpmHome);
    logInfo(`Use cached pnpm ${version}`);
  } catch {
    logInfo("Create pnpm home");
    await mkdir(pnpmHome, { recursive: true });

    const dlUrl = getPnpmDownloadUrl({
      version,
      platform: platform(),
      arch: arch(),
    });

    const dlFile = dlUrl.pathname.slice(dlUrl.pathname.lastIndexOf("/") + 1);

    let dlOut: string;
    const dlFileExt = extname(dlFile);
    switch (dlFileExt) {
      case ".gz":
      case ".zip":
        dlOut = join(pnpmHome, dlFile);
        break;

      default:
        dlOut = join(pnpmHome, `pnpm${dlFileExt}`);
    }

    beginLogGroup(`Download pnpm ${version}`);
    try {
      const args: string[] = ["-fL", "--output", dlOut, dlUrl.href];
      logCommand("curl", ...args);
      await exec("curl", args);
    } finally {
      endLogGroup();
    }

    const dlOutExt = extname(dlOut);
    switch (dlOutExt) {
      case ".gz":
      case ".zip":
        beginLogGroup("Extract archive");
        try {
          await extractArchive(dlOut, pnpmHome);
        } finally {
          endLogGroup();
        }

        logInfo("Remove archive");
        await rm(dlOut);
        break;

      default:
        logInfo("Set file permissions");
        await chmod(dlOut, "755");
    }
  }

  logInfo("Add pnpm to PATH");
  await Promise.all([setEnv("PNPM_HOME", pnpmHome), addPath(pnpmHome)]);
}
