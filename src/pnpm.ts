import { addPath, setEnv } from "gha-utils";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { downloadFile } from "./download.js";
import type { Architecture, Platform } from "./platform.js";

export async function createPnpmHome(version: string): Promise<string> {
  const slug = [process.env.RUNNER_TOOL_CACHE, "pnpm", version];
  const pnpmHome = path.join(...slug.filter((s) => s !== undefined));
  await fsPromises.mkdir(pnpmHome, { recursive: true });
  return pnpmHome;
}

export async function resolvePnpmVersion(version: string): Promise<string> {
  const res = await fetch("https://registry.npmjs.org/@pnpm/exe");
  if (res.ok) {
    const data = await res.json();
    if (typeof data === "object" && data !== null) {
      if (
        "dist-tags" in data &&
        typeof data["dist-tags"] === "object" &&
        data["dist-tags"] !== null
      ) {
        const distTags = data["dist-tags"] as Record<string, unknown>;
        if (version in distTags && typeof distTags[version] === "string") {
          return distTags[version];
        }
      }

      if (
        "versions" in data &&
        typeof data.versions === "object" &&
        data.versions !== null
      ) {
        const versions = data.versions as Record<string, unknown>;
        if (version in versions) {
          return version;
        }
      }
    }
  }
  throw new Error(`Unknown version: ${version}`);
}

export async function downloadPnpm(
  pnpmHome: string,
  version: string,
  platform: Platform,
  architecture: Architecture,
): Promise<void> {
  const ext = platform === "win" ? ".exe" : "";
  const pnpmFile = path.join(pnpmHome, `pnpm${ext}`);
  await downloadFile(
    `https://github.com/pnpm/pnpm/releases/download/v${version}/pnpm-${platform}-${architecture}${ext}`,
    pnpmFile,
  );
  await fsPromises.chmod(pnpmFile, "755");
}

export async function setupPnpm(pnpmHome: string): Promise<void> {
  await Promise.all([setEnv("PNPM_HOME", pnpmHome), addPath(pnpmHome)]);
}
