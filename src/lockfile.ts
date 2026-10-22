import { readFile } from "node:fs/promises";
import { satisfies } from "./semver.js";

/**
 * Extracts the locked pnpm version from the contents of a `pnpm-lock.yaml`.
 *
 * pnpm locks its own version in a separate YAML document at the start of the
 * lockfile, under `importers['.'].packageManagerDependencies['@pnpm/exe']`.
 * Rather than parsing YAML in full, this follows that path by indentation,
 * assuming the layout pnpm writes.
 * @param content - The contents of a `pnpm-lock.yaml` file.
 * @returns The exact locked version, or `undefined` if the lockfile doesn't
 * lock one.
 */
export function extractVersionFromPnpmLock(
  content: string,
): string | undefined {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") return undefined;

  const keys = [
    "importers:",
    ".:",
    "packageManagerDependencies:",
    "'@pnpm/exe':",
  ];
  let depth = 0;
  for (const line of lines.slice(1)) {
    // Stops at the end of the document.
    if (line === "---") break;

    const key = line.trimStart();
    if (key === "") continue;

    const indent = line.length - key.length;
    // Stops after leaving the block matched so far.
    if (indent < depth * 2) break;
    // Skips entries nested in a block that isn't on the path.
    if (indent > depth * 2) continue;

    if (depth < keys.length) {
      if (key === keys[depth]) depth++;
      continue;
    }

    const match = /^version: (\d+\.\d+\.\d+)$/.exec(key);
    if (match !== null) return match[1];
  }
  return undefined;
}

/**
 * Reads the locked pnpm version from a `pnpm-lock.yaml`.
 *
 * Like pnpm itself, this only uses the locked version if it satisfies the
 * version from `package.json`, so `latest` never uses it. Throws an error if
 * the file can't be read.
 * @param file - The path of the `pnpm-lock.yaml` file.
 * @param version - The exact pnpm version, the version range, or `latest` from
 * `package.json`.
 * @returns The exact locked version, or `undefined` if the lockfile doesn't
 * lock one that satisfies the version.
 */
export async function readLockedVersion(
  file: string,
  version: string,
): Promise<string | undefined> {
  const content = await readFile(file, "utf-8");
  const lockedVersion = extractVersionFromPnpmLock(content);
  if (lockedVersion === undefined || !satisfies(lockedVersion, version)) {
    return undefined;
  }
  return lockedVersion;
}
