import { logError, logInfo } from "gha-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { createPnpmHome, downloadPnpm, setupPnpm } from "./pnpm.js";

vi.mock("gha-utils", () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

vi.mock("./pnpm.js", () => ({
  createPnpmHome: vi.fn().mockResolvedValue("/pnpm"),
  downloadPnpm: vi.fn().mockResolvedValue(undefined),
  setupPnpm: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.resetModules();
});

it("should download pnpm", async () => {
  await import("./main.js");

  expect(createPnpmHome).toBeCalled();
  expect(logInfo).toBeCalledWith("Downloading pnpm to /pnpm...");
  expect(downloadPnpm).toBeCalledWith("/pnpm");
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
