import fsPromises from "node:fs/promises";
import path from "node:path";
import { downloadFile } from "./download.js";

export async function createPnpmHome(): Promise<string> {
  const pnpmHome = path.join(process.env.RUNNER_TOOL_CACHE!, "pnpm");
  await fsPromises.mkdir(pnpmHome);
  return pnpmHome;
}

export async function downloadPnpm(pnpmHome: string): Promise<void> {
  const pnpmFile = path.join(pnpmHome, "pnpm");
  await downloadFile(
    "https://github.com/pnpm/pnpm/releases/download/v10.2.1/pnpm-linux-x64",
    pnpmFile,
  );
  await fsPromises.chmod(pnpmFile, "755");
}
