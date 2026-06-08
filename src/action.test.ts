import { addPath, setEnv, setOutput } from "ghakit/io";
import { beginLogGroup, endLogGroup, logCommand, logInfo } from "ghakit/log";
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
import { getVersionInput } from "./input.js";
import { getPnpmHome, resolvePnpmVersion } from "./pnpm.js";

const execFileAsync = promisify(execFile);

vi.mock(import("ghakit/exec"), async (importOriginal) => {
  const original = await importOriginal();
  return {
    exec: (command, args) =>
      original.exec(command, args, { stdout: "silent", stderr: "silent" }),
  } as typeof original;
});

vi.mock(import("ghakit/io"));
vi.mock(import("ghakit/log"));

vi.mock(import("./input.js"), async (importOriginal) => ({
  ...(await importOriginal()),
  getVersionInput: vi.fn(),
}));

vi.mock(import("./pnpm.js"), async (importOriginal) => ({
  ...(await importOriginal()),
  getPnpmHome: vi.fn(),
}));

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
    vi.mocked(logCommand).mockImplementation(() => logs.push("[command]"));
    vi.mocked(beginLogGroup).mockImplementation((name) =>
      logs.push(`[begin] ${name}`),
    );
    vi.mocked(endLogGroup).mockImplementation(() => logs.push("[end]"));
    vi.mocked(getPnpmHome).mockImplementation(({ version }) =>
      join(tmpDir, "pnpm", version),
    );
  });

  test("sets up the latest version", { timeout: 60000 }, async () => {
    vi.mocked(getVersionInput).mockResolvedValue("latest");
    const version = await resolvePnpmVersion("latest");

    await setupPnpmAction();

    expect(logs).toStrictEqual([
      "Resolve pnpm version",
      "Create pnpm home",
      `[begin] Download pnpm ${version} archive`,
      "[command]",
      "[end]",
      "[begin] Extract pnpm archive",
      "[command]",
      "[end]",
      "Remove pnpm archive",
      "Add pnpm to PATH",
    ]);

    const pnpmHome = join(tmpDir, "pnpm", version);
    expect(vi.mocked(setEnv).mock.calls).toStrictEqual([
      ["PNPM_HOME", pnpmHome],
    ]);
    expect(vi.mocked(addPath).mock.calls).toStrictEqual([[pnpmHome]]);

    expect(vi.mocked(setOutput).mock.calls).toStrictEqual([
      ["version", version],
    ]);
    await assertPnpmVersion(version, pnpmHome);
  });

  test("sets up a specific version", { timeout: 60000 }, async () => {
    const version = "10.34.0";
    vi.mocked(getVersionInput).mockResolvedValue(version);

    await setupPnpmAction();

    expect(logs).toStrictEqual([
      "Resolve pnpm version",
      "Create pnpm home",
      `[begin] Download pnpm ${version} executable`,
      "[command]",
      "[end]",
      "Make pnpm executable",
      "Add pnpm to PATH",
    ]);

    const pnpmHome = join(tmpDir, "pnpm", version);
    expect(vi.mocked(setEnv).mock.calls).toStrictEqual([
      ["PNPM_HOME", pnpmHome],
    ]);
    expect(vi.mocked(addPath).mock.calls).toStrictEqual([[pnpmHome]]);

    expect(vi.mocked(setOutput).mock.calls).toStrictEqual([
      ["version", version],
    ]);
    await assertPnpmVersion(version, pnpmHome);
  });

  test("sets up from cache", async () => {
    vi.mocked(getVersionInput).mockResolvedValue("latest");
    const version = await resolvePnpmVersion("latest");

    await setupPnpmAction();

    expect(logs).toStrictEqual([
      "Resolve pnpm version",
      `Use cached pnpm ${version}`,
      "Add pnpm to PATH",
    ]);

    const pnpmHome = join(tmpDir, "pnpm", version);
    expect(vi.mocked(setEnv).mock.calls).toStrictEqual([
      ["PNPM_HOME", pnpmHome],
    ]);
    expect(vi.mocked(addPath).mock.calls).toStrictEqual([[pnpmHome]]);

    expect(vi.mocked(setOutput).mock.calls).toStrictEqual([
      ["version", version],
    ]);
    await assertPnpmVersion(version, pnpmHome);
  });
});
