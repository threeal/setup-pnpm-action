import { getInput, logError, logInfo } from "gha-utils";
import { getArchitecture, getPlatform } from "./platform.js";

import {
  createPnpmHome,
  downloadPnpm,
  resolvePnpmVersion,
  setupPnpm,
} from "./pnpm.js";

try {
  const version = await resolvePnpmVersion(getInput("version"));
  const platform = getPlatform();
  const architecture = getArchitecture();
  const pnpmHome = await createPnpmHome(version);

  logInfo(`Downloading pnpm to ${pnpmHome}...`);
  await downloadPnpm(pnpmHome, version, platform, architecture);
  await setupPnpm(pnpmHome);
} catch (err) {
  logError(err);
  process.exitCode = 1;
}
