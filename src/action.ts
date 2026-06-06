import { exec } from "ghakit/exec";
import { addPath, setEnv, setOutput } from "ghakit/io";
import { beginLogGroup, endLogGroup, logCommand, logInfo } from "ghakit/log";
import { getRunnerToolCache } from "ghakit/vars";
import { access, mkdir, rm } from "node:fs/promises";
import { extname, join } from "node:path";
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
    const dlUrl = getPnpmDownloadUrl({ version, platform, arch });
    const dlFile = dlUrl.pathname.slice(dlUrl.pathname.lastIndexOf("/") + 1);

    logInfo("Create pnpm home");
    await mkdir(pnpmHome, { recursive: true });

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
        await makeExecutable(dlOut);
    }
  }

  logInfo("Add pnpm to PATH");
  await addPath(pnpmHome);

  await setOutput("version", version);
}
