import { logError } from "ghakit/log";
import { setupPnpmAction } from "./action.js";

await setupPnpmAction().catch((err: unknown) => {
  logError(err);
  process.exitCode = 1;
});
