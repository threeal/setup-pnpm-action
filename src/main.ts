import { logError, logInfo } from "gha-utils";
import { getPlatform } from "./platform.js";
import { createPnpmHome, downloadPnpm, setupPnpm } from "./pnpm.js";

try {
  const platform = getPlatform();
  const pnpmHome = await createPnpmHome();

  logInfo(`Downloading pnpm to ${pnpmHome}...`);
  await downloadPnpm(pnpmHome, platform);
  await setupPnpm(pnpmHome);
} catch (err) {
  logError(err);
  process.exitCode = 1;
}
