import { logError, logInfo } from "gha-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { createPnpmHome, downloadPnpm, setupPnpm } from "./pnpm.js";

vi.mock("gha-utils", () => ({
  getInput: vi.fn().mockReturnValue("10.2.1"),
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

vi.mock("./platform.js", () => ({
  getArchitecture: vi.fn().mockReturnValue("x64"),
  getPlatform: vi.fn().mockReturnValue("linux"),
}));

vi.mock("./pnpm.js", () => ({
  createPnpmHome: vi.fn().mockResolvedValue("/pnpm"),
  downloadPnpm: vi.fn().mockResolvedValue(undefined),
  resolvePnpmVersion: vi.fn().mockImplementation((version: string) => version),
  setupPnpm: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.resetModules();
});

it("should download pnpm", async () => {
  await import("./main.js");

  expect(logError).not.toBeCalled();
  expect(process.exitCode).toBeUndefined();

  expect(createPnpmHome).toBeCalledWith("10.2.1");
  expect(logInfo).toBeCalledWith("Downloading pnpm to /pnpm...");
  expect(downloadPnpm).toBeCalledWith("/pnpm", "10.2.1", "linux", "x64");
  expect(setupPnpm).toBeCalledWith("/pnpm");
});

it("should fail to download pnpm", async () => {
  const err = new Error("something happened");
  vi.mocked(downloadPnpm).mockRejectedValue(err);

  await import("./main.js");

  expect(logError).toBeCalledWith(err);
  expect(process.exitCode).toBe(1);
  process.exitCode = undefined;
});
