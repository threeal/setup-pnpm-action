import { addPath, setEnv } from "gha-utils";
import fsPromises from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { createPnpmHome, downloadPnpm, setupPnpm } from "./pnpm";
import { downloadFile } from "./download";

vi.mock("gha-utils", () => ({
  addPath: vi.fn().mockResolvedValue(undefined),
  setEnv: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    chmod: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("./download.js", () => ({
  downloadFile: vi.fn().mockResolvedValue(undefined),
}));

it("should create a pnpm home directory", async () => {
  process.env.RUNNER_TOOL_CACHE = "/tool";

  const pnpmHome = await createPnpmHome("10.2.1");

  expect(pnpmHome).toBe("/tool/pnpm/10.2.1");
  expect(fsPromises.mkdir).toBeCalledWith(pnpmHome, { recursive: true });
});

describe("download pnpm", () => {
  it("should download pnpm", async () => {
    await downloadPnpm("/pnpm", "10.2.1", "linux", "x64");

    expect(downloadFile).toBeCalledWith(
      "https://github.com/pnpm/pnpm/releases/download/v10.2.1/pnpm-linux-x64",
      "/pnpm/pnpm",
    );
    expect(fsPromises.chmod).toBeCalledWith("/pnpm/pnpm", "755");
  });

  it("should download pnpm on Windows", async () => {
    await downloadPnpm("/pnpm", "10.2.1", "win", "x64");

    expect(downloadFile).toBeCalledWith(
      "https://github.com/pnpm/pnpm/releases/download/v10.2.1/pnpm-win-x64.exe",
      "/pnpm/pnpm.exe",
    );
    expect(fsPromises.chmod).toBeCalledWith("/pnpm/pnpm.exe", "755");
  });
});

it("should setup pnpm", async () => {
  await setupPnpm("/pnpm");

  expect(addPath).toBeCalledWith("/pnpm");
  expect(setEnv).toBeCalledWith("PNPM_HOME", "/pnpm");
});
