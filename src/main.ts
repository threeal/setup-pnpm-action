import { addPath, logError, logInfo, setEnv } from "gha-utils";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { downloadFile } from "./download.js";
import { createPnpmHome } from "./pnpm.js";

try {
  const pnpmHome = await createPnpmHome();
  const pnpmFile = path.join(pnpmHome, "pnpm");

  logInfo(`Downloading pnpm to ${pnpmFile}...`);
  await downloadFile(
    "https://github.com/pnpm/pnpm/releases/download/v10.2.1/pnpm-linux-x64",
    pnpmFile,
  );
  await fsPromises.chmod(pnpmFile, "755");

  await Promise.all([setEnv("PNPM_HOME", pnpmHome), addPath(pnpmHome)]);
} catch (err) {
  logError(err);
  process.exitCode = 1;
}
