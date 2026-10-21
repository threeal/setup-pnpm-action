import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { isRecord } from "./json.js";

/**
 * Extracts the pnpm version from the `packageManager` field of a `package.json`.
 *
 * The field is optional, but when set it must have the form
 * `pnpm@<major>.<minor>.<patch>`, optionally followed by a `+` and a hash. Any
 * other package manager or version format throws an error.
 * @param packageJson - The parsed contents of a `package.json` file.
 * @returns The exact pnpm version without the hash, or `undefined` if the field
 * isn't set.
 */
export function extractVersionFromPackageJson(
  packageJson: unknown,
): string | undefined {
  if (!isRecord(packageJson)) {
    throw new Error("Invalid package.json");
  }

  const { packageManager } = packageJson;
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

  return match[2];
}

/**
 * Reads the pnpm version from a version file.
 *
 * Only `package.json` is supported, read through its `packageManager` field.
 * Throws an error for any other file, or if the file can't be read or parsed.
 * @param file - The path of the version file.
 * @returns The exact pnpm version, or `undefined` if the file doesn't set one.
 */
export async function readVersionFile(
  file: string,
): Promise<string | undefined> {
  const fileName = basename(file);
  if (fileName !== "package.json") {
    throw new Error(`Unsupported version file: ${fileName}`);
  }
  const content = await readFile(file, "utf-8");
  return extractVersionFromPackageJson(JSON.parse(content));
}
