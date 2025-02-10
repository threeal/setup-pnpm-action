import { logError, logInfo } from "gha-utils";
import { getArchitecture, getPlatform } from "./platform.js";
import { createPnpmHome, downloadPnpm, setupPnpm } from "./pnpm.js";

try {
  const platform = getPlatform();
  const architecture = getArchitecture();
  const pnpmHome = await createPnpmHome();

  logInfo(`Downloading pnpm to ${pnpmHome}...`);
  await downloadPnpm(pnpmHome, "10.2.1", platform, architecture);
  await setupPnpm(pnpmHome);
} catch (err) {
  logError(err);
  process.exitCode = 1;
}
