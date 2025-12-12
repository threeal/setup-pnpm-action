import { addPath, setEnv } from "gha-utils";
import fsPromises from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

import {
  createPnpmHome,
  downloadPnpm,
  parsePnpmVersionsRegistry,
  resolvePnpmVersion,
  setupPnpm,
} from "./pnpm.js";

import { downloadFile } from "./download.js";

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

describe("parse pnpm versions registry", { concurrent: true }, () => {
  it("should parse valid registry", () => {
    const versionsRegistry = parsePnpmVersionsRegistry({
      "dist-tags": {
        latest: "1.0.0",
      },
      versions: {
        "1.0.0": {},
        "0.1.0": {},
      },
    });

    expect(versionsRegistry).toStrictEqual({
      latest: "1.0.0",
      "1.0.0": "1.0.0",
      "0.1.0": "0.1.0",
    });
  });

  it("should parse invalid registries", () => {
    const datas = [
      null,
      {},
      {
        "dist-tags": {
          latest: null,
        },
      },
    ];

    for (const data of datas) {
      const versionsRegistry = parsePnpmVersionsRegistry(data);
      expect(versionsRegistry).toStrictEqual({});
    }
  });
});

describe("resolve pnpm version", { concurrent: true }, () => {
  it("should resolve pnpm version", async () => {
    await expect(resolvePnpmVersion("10.2.1")).resolves.toBe("10.2.1");
  });

  it("should resolve pnpm version using tag", async () => {
    await expect(resolvePnpmVersion("latest")).resolves.not.toThrow();
  });

  it("should not resolve pnpm version", async () => {
    await expect(resolvePnpmVersion("invalid")).rejects.toThrow(
      "Unknown version: invalid",
    );
  });
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
