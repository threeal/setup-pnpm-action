import { logError, logInfo } from "gha-utils";
import { createPnpmHome, downloadPnpm, setupPnpm } from "./pnpm.js";

try {
  const pnpmHome = await createPnpmHome();

  logInfo(`Downloading pnpm to ${pnpmHome}...`);
  await downloadPnpm(pnpmHome);
  await setupPnpm(pnpmHome);
} catch (err) {
  logError(err);
  process.exitCode = 1;
}
