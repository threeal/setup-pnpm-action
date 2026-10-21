/**
 * Checks whether a parsed JSON value is an object.
 * @param value - The value to check.
 * @returns Whether the value is a non-null object.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
