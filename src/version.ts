import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { isRecord } from "./json.js";
import { createRangeMatcher } from "./semver.js";

/**
 * The field of a version file that sets the pnpm version, and the version it
 * sets.
 *
 * The `version` is an exact version or a version range. Only
 * `devEngines.packageManager` can name pnpm without a version.
 */
export type VersionField =
  | { key: "devEngines.packageManager"; version?: string }
  | { key: "packageManager"; version: string };

/**
 * Extracts the pnpm version from the `devEngines` field of a `package.json`.
 *
 * This reads `devEngines.packageManager`, which must be an object with a `name`
 * and an optional `version`, as its array form isn't supported. The `version`
 * must be an exact `<major>.<minor>.<patch>` version, optionally followed by a
 * `+` and a hash, or a version range. Any other package manager or version
 * format throws an error.
 * @param devEngines - The `devEngines` field of a `package.json`.
 * @returns The exact pnpm version without the hash or the version range, with
 * no version if none is set, or `undefined` if no package manager is named.
 */
function extractVersionFromDevEngines(
  devEngines: unknown,
): VersionField | undefined {
  if (devEngines === undefined) return undefined;

  if (!isRecord(devEngines)) {
    throw new Error(`Invalid \`devEngines\` type: ${typeof devEngines}`);
  }

  const { packageManager } = devEngines;
  if (packageManager === undefined) return undefined;

  if (Array.isArray(packageManager)) {
    throw new Error("Unsupported `devEngines.packageManager` array");
  }

  if (!isRecord(packageManager)) {
    throw new Error(
      `Invalid \`devEngines.packageManager\` type: ${typeof packageManager}`,
    );
  }

  const { name, version } = packageManager;
  if (name === undefined) return undefined;

  if (typeof name !== "string") {
    throw new Error(
      `Invalid \`devEngines.packageManager.name\` type: ${typeof name}`,
    );
  }

  if (name !== "pnpm") {
    throw new Error(`Unsupported package manager: ${name}, expected pnpm`);
  }

  const key = "devEngines.packageManager";
  if (version === undefined) return { key };

  if (typeof version !== "string") {
    throw new Error(
      `Invalid \`devEngines.packageManager.version\` type: ${typeof version}`,
    );
  }

  const match = /^(\d+\.\d+\.\d+)(?:\+.*)?$/.exec(version);
  if (match !== null) return { key, version: match[1] };

  if (createRangeMatcher(version) !== undefined) return { key, version };

  throw new Error(
    `Invalid \`devEngines.packageManager.version\` value: ${version}`,
  );
}

/**
 * Extracts the pnpm version from the `packageManager` field of a `package.json`.
 *
 * The field must have the form `pnpm@<major>.<minor>.<patch>`, optionally
 * followed by a `+` and a hash. Any other package manager or version format
 * throws an error.
 * @param packageManager - The `packageManager` field of a `package.json`.
 * @returns The exact pnpm version without the hash, or `undefined` if the field
 * isn't set.
 */
function extractVersionFromPackageManager(
  packageManager: unknown,
): VersionField | undefined {
  if (packageManager === undefined) return undefined;

  if (typeof packageManager !== "string") {
    throw new Error(
      `Invalid \`packageManager\` type: ${typeof packageManager}`,
    );
  }

  const match = /^([^@]+)@(\d+\.\d+\.\d+)(?:\+.*)?$/.exec(packageManager);
  if (match === null) {
    throw new Error(`Invalid \`packageManager\` value: ${packageManager}`);
  }

  if (match[1] !== "pnpm") {
    throw new Error(`Unsupported package manager: ${match[1]}, expected pnpm`);
  }

  return { key: "packageManager", version: match[2] };
}

/**
 * Extracts the pnpm version from a `package.json`.
 *
 * Like pnpm itself, this reads the `devEngines` field when it names a package
 * manager, and otherwise the `packageManager` field.
 * @param packageJson - The parsed contents of a `package.json` file.
 * @returns The field that sets the pnpm version, or `undefined` if neither
 * field names a package manager.
 */
export function extractVersionFromPackageJson(
  packageJson: unknown,
): VersionField | undefined {
  if (!isRecord(packageJson)) {
    throw new Error("Invalid package.json");
  }

  return (
    extractVersionFromDevEngines(packageJson.devEngines) ??
    extractVersionFromPackageManager(packageJson.packageManager)
  );
}

/**
 * Reads the pnpm version from a version file.
 *
 * Only `package.json` is supported, read through its `devEngines` or
 * `packageManager` field. Throws an error for any other file, or if the file
 * can't be read or parsed.
 * @param file - The path of the version file.
 * @returns The field that sets the pnpm version, or `undefined` if the file
 * doesn't set one.
 */
export async function readVersionFile(
  file: string,
): Promise<VersionField | undefined> {
  const fileName = basename(file);
  if (fileName !== "package.json") {
    throw new Error(`Unsupported version file: ${fileName}`);
  }
  const content = await readFile(file, "utf-8");
  return extractVersionFromPackageJson(JSON.parse(content));
}
