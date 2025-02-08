import { execFile } from "node:child_process";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const execFilePromise = promisify(execFile);

let tempDir: string;
beforeEach(async () => {
  tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "test"));

  process.env.RUNNER_TOOL_CACHE = tempDir;
  process.env.GITHUB_ENV = path.join(tempDir, "env");
  process.env.GITHUB_PATH = path.join(tempDir, "path");

  vi.resetModules();
});

it(
  "should download pnpm",
  async () => {
    await import("./main.js");

    const pnpmHome = path.join(process.env.RUNNER_TOOL_CACHE!, "pnpm");

    expect(process.env.PNPM_HOME).toBe(pnpmHome);
    expect(process.env.PATH).toContain(pnpmHome);

    const { stdout } = await execFilePromise("pnpm", ["--version"]);
    expect(stdout).toContain("10.2.1");
  },
  30 * 1000,
);

it("should fail to download pnpm", async () => {
  await fsPromises.writeFile(path.join(tempDir, "pnpm"), "");

  await import("./main.js");

  expect(process.exitCode).toBe(1);
  process.exitCode = undefined;
});

afterEach(async () => {
  await fsPromises.rm(tempDir, { recursive: true, force: true });
});
