import { logError } from "gha-utils";
import { setupPnpmAction } from "./action.js";

await setupPnpmAction().catch((err: unknown) => {
  logError(err);
  process.exitCode = 1;
});
