import { addPath, getInput, logInfo, setEnv } from "gha-utils";
import {
  getPnpmDownloadUrl,
  getPnpmBinaryName,
  resolvePnpmVersion,
} from "./pnpm.js";
import { join } from "node:path";
import { chmod, mkdir } from "node:fs/promises";
import { downloadFile } from "./download.js";
import { arch, platform } from "node:os";

export async function setupPnpmAction() {
  logInfo("Resolve pnpm version");
  const version = await resolvePnpmVersion(getInput("version"));

  logInfo("Create pnpm home");
  const slug = [process.env.RUNNER_TOOL_CACHE, "pnpm", version];
  const pnpmHome = join(...slug.filter((s) => s !== undefined));
  await mkdir(pnpmHome, { recursive: true });

  const binPath = join(pnpmHome, getPnpmBinaryName(platform()));
  const url = getPnpmDownloadUrl({
    version,
    platform: platform(),
    arch: arch(),
  });

  logInfo(`Download pnpm ${version}`);
  await downloadFile(url, binPath);

  logInfo("Set file permissions");
  await chmod(binPath, "755");

  logInfo("Add pnpm to PATH");
  await Promise.all([setEnv("PNPM_HOME", pnpmHome), addPath(pnpmHome)]);
}
