import { addPath, setEnv } from "gha-utils";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { downloadFile } from "./download.js";
import type { Platform } from "./platform.js";

export async function createPnpmHome(): Promise<string> {
  const pnpmHome = path.join(process.env.RUNNER_TOOL_CACHE!, "pnpm");
  await fsPromises.mkdir(pnpmHome);
  return pnpmHome;
}

export async function downloadPnpm(
  pnpmHome: string,
  platform: Platform,
): Promise<void> {
  const pnpmFile = path.join(pnpmHome, "pnpm");
  await downloadFile(
    `https://github.com/pnpm/pnpm/releases/download/v10.2.1/pnpm-${platform}-x64`,
    pnpmFile,
  );
  await fsPromises.chmod(pnpmFile, "755");
}

export async function setupPnpm(pnpmHome: string): Promise<void> {
  await Promise.all([setEnv("PNPM_HOME", pnpmHome), addPath(pnpmHome)]);
}
