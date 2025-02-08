import { addPath, logError, logInfo, setEnv } from "gha-utils";
import { createPnpmHome, downloadPnpm } from "./pnpm.js";

try {
  const pnpmHome = await createPnpmHome();

  logInfo(`Downloading pnpm to ${pnpmHome}...`);
  await downloadPnpm(pnpmHome);

  await Promise.all([setEnv("PNPM_HOME", pnpmHome), addPath(pnpmHome)]);
} catch (err) {
  logError(err);
  process.exitCode = 1;
}
