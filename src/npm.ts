import { isRecord } from "./json.js";

/**
 * The parts of a package's metadata from the npm registry used by this action.
 */
export interface NpmPackage {
  "dist-tags": Record<string, unknown>;
  versions: Record<string, unknown>;
}

/**
 * Parses a package's metadata as returned by the npm registry.
 *
 * Throws an error if the metadata lacks the `dist-tags` or `versions` objects.
 * @param data - The package's metadata as parsed JSON.
 * @returns The package's metadata.
 */
export function parseNpmPackage(data: unknown): NpmPackage {
  if (
    !isRecord(data) ||
    !isRecord(data["dist-tags"]) ||
    !isRecord(data.versions)
  ) {
    throw new Error("Invalid npm package metadata");
  }
  return { "dist-tags": data["dist-tags"], versions: data.versions };
}

/**
 * Fetches a package's metadata from the npm registry.
 * @param name - The name of the package to fetch.
 * @returns The package's metadata.
 */
export async function fetchNpmPackage(name: string): Promise<NpmPackage> {
  const res = await fetch(`https://registry.npmjs.org/${name}`);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch ${name} from npm registry: ${res.statusText}`,
    );
  }
  return parseNpmPackage(await res.json());
}
