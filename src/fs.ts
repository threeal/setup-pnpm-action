import { isRecord } from "./json.js";

/**
 * Checks whether an error was thrown because a file doesn't exist.
 * @param err - The error to check.
 * @returns Whether the error has the `ENOENT` code.
 */
export function isNotFoundError(err: unknown): boolean {
  return isRecord(err) && err.code === "ENOENT";
}
