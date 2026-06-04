import { getPnpmDownloadUrl, resolvePnpmVersion } from "./pnpm.js";
import { extname, join } from "node:path";
import { chmod, mkdir, rm } from "node:fs/promises";
import { arch, platform } from "node:os";
import { logInfo } from "ghakit/log";
import { addPath, getInput, setEnv } from "ghakit/io";
import { getRunnerToolCache } from "ghakit/vars";
import { exec } from "ghakit/exec";
import { extractArchive } from "./archive.js";

export async function setupPnpmAction() {
  logInfo("Resolve pnpm version");
  const version = await resolvePnpmVersion(getInput("version").trim());

  logInfo("Create pnpm home");
  const pnpmHome = join(getRunnerToolCache(), "pnpm", version);
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

  logInfo(`Download pnpm ${version}`);
  await exec("curl", ["-fLSs", "--output", dlOut, dlUrl.href], {
    stdout: "silent",
    stderr: "silent",
  });

  const dlOutExt = extname(dlOut);
  switch (dlOutExt) {
    case ".gz":
    case ".zip":
      logInfo("Extract archive");
      await extractArchive(dlOut, pnpmHome);

      logInfo("Remove archive");
      await rm(dlOut);
      break;

    default:
      logInfo("Set file permissions");
      await chmod(dlOut, "755");
  }

  logInfo("Add pnpm to PATH");
  await Promise.all([setEnv("PNPM_HOME", pnpmHome), addPath(pnpmHome)]);
}
