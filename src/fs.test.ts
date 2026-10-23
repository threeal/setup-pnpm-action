import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { isNotFoundError } from "./fs.js";

describe("isNotFoundError", { concurrent: true }, () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "setup-pnpm-action-"));
  });

  afterAll(() => rm(tmpDir, { force: true, recursive: true }));

  test("returns true for a missing file", async () => {
    const err: unknown = await readFile(join(tmpDir, "missing")).catch(
      (err: unknown) => err,
    );
    expect(isNotFoundError(err)).toBe(true);
  });

  test("returns false for another file error", async () => {
    const err: unknown = await readFile(tmpDir).catch((err: unknown) => err);
    expect(isNotFoundError(err)).toBe(false);
  });

  test("returns false for a value that isn't an object", () => {
    expect(isNotFoundError("ENOENT")).toBe(false);
  });
});
