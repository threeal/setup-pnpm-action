import { addPath, getInput, setEnv } from "ghakit/io";
import { logInfo } from "ghakit/log";
import { getRunnerToolCache } from "ghakit/vars";
import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { chdir } from "node:process";
import { promisify } from "node:util";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { setupPnpmAction } from "./action.js";
import { resolvePnpmVersion } from "./pnpm.js";

const execFileAsync = promisify(execFile);

vi.mock(import("ghakit/io"));
vi.mock(import("ghakit/log"));
vi.mock(import("ghakit/vars"));

beforeEach(() => vi.clearAllMocks());

const tmpDir = resolve(
  import.meta.dirname,
  `.${basename(import.meta.filename)}.tmp`,
);

beforeAll(async () => {
  await rm(tmpDir, { force: true, recursive: true });
  await mkdir(tmpDir, { recursive: true });
  chdir(homedir());
});

afterAll(() => rm(tmpDir, { force: true, recursive: true }));

describe("setupPnpmAction", () => {
  let logs: string[] = [];

  const assertPnpmVersion = async (version: string, pnpmHome: string) => {
    const { stdout, stderr } = await execFileAsync("pnpm", ["--version"], {
      env: {
        PATH: pnpmHome,
      },
    });
    expect(stdout.trim()).toBe(version);
    expect(stderr.trim()).toBe("");
  };

  beforeEach(() => {
    logs = [];
    vi.mocked(logInfo).mockImplementation((message) => logs.push(message));
    vi.mocked(getRunnerToolCache).mockReturnValue(join(tmpDir, "cache"));
  });

  test("downloads latest version", { timeout: 60000 }, async () => {
    vi.mocked(getInput).mockReturnValue("latest");
    const version = await resolvePnpmVersion("latest");

    await setupPnpmAction();

    expect(logs).toStrictEqual([
      "Resolve pnpm version",
      "Create pnpm home",
      `Download pnpm ${version}`,
      "Extract archive",
      "Remove archive",
      "Add pnpm to PATH",
    ]);

    const pnpmHome = join(tmpDir, "cache", "pnpm", version);
    expect(vi.mocked(setEnv).mock.calls).toStrictEqual([
      ["PNPM_HOME", pnpmHome],
    ]);
    expect(vi.mocked(addPath).mock.calls).toStrictEqual([[pnpmHome]]);

    await assertPnpmVersion(version, pnpmHome);
  });

  test("downloads specified version", { timeout: 60000 }, async () => {
    const version = "10.34.0";
    vi.mocked(getInput).mockReturnValue(version);

    await setupPnpmAction();

    expect(logs).toStrictEqual([
      "Resolve pnpm version",
      "Create pnpm home",
      `Download pnpm ${version}`,
      "Set file permissions",
      "Add pnpm to PATH",
    ]);

    const pnpmHome = join(tmpDir, "cache", "pnpm", version);
    expect(vi.mocked(setEnv).mock.calls).toStrictEqual([
      ["PNPM_HOME", pnpmHome],
    ]);
    expect(vi.mocked(addPath).mock.calls).toStrictEqual([[pnpmHome]]);

    await assertPnpmVersion(version, pnpmHome);
  });
});
