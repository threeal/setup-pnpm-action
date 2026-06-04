import {
  getPnpmDownloadUrl,
  getPnpmBinaryName,
  resolvePnpmVersion,
} from "./pnpm.js";
import { join } from "node:path";
import { chmod, mkdir } from "node:fs/promises";
import { arch, platform } from "node:os";
import { logInfo } from "ghakit/log";
import { addPath, getInput, setEnv } from "ghakit/io";
import { getRunnerToolCache } from "ghakit/vars";
import { exec } from "ghakit/exec";

export async function setupPnpmAction() {
  logInfo("Resolve pnpm version");
  const version = await resolvePnpmVersion(getInput("version").trim());

  logInfo("Create pnpm home");
  const pnpmHome = join(getRunnerToolCache(), "pnpm", version);
  await mkdir(pnpmHome, { recursive: true });

  const binPath = join(pnpmHome, getPnpmBinaryName(platform()));
  const url = getPnpmDownloadUrl({
    version,
    platform: platform(),
    arch: arch(),
  });

  logInfo(`Download pnpm ${version}`);
  await exec("curl", ["-fLSs", "--output", binPath, url], {
    stdout: "silent",
    stderr: "silent",
  });

  logInfo("Set file permissions");
  await chmod(binPath, "755");

  logInfo("Add pnpm to PATH");
  await Promise.all([setEnv("PNPM_HOME", pnpmHome), addPath(pnpmHome)]);
}
