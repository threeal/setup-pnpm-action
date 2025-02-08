import fsPromises from "node:fs/promises";
import path from "node:path";

export async function createPnpmHome(): Promise<string> {
  const pnpmHome = path.join(process.env.RUNNER_TOOL_CACHE!, "pnpm");
  await fsPromises.mkdir(pnpmHome);
  return pnpmHome;
}
