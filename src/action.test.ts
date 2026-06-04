import { addPath, getInput, logInfo, setEnv } from "gha-utils";
import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
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
import { chdir } from "node:process";
import { homedir } from "node:os";

const execFileAsync = promisify(execFile);

vi.mock(import("gha-utils"));

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

  beforeEach(() => {
    logs = [];
    vi.mocked(logInfo).mockImplementation((message) => logs.push(message));
    vi.stubEnv("RUNNER_TOOL_CACHE", join(tmpDir, "cache"));
  });

  test("downloads specified version", { timeout: 60000 }, async () => {
    vi.mocked(getInput).mockReturnValue("10.34.0");

    await setupPnpmAction();

    expect(logs).toStrictEqual([
      "Resolve pnpm version",
      "Create pnpm home",
      "Download pnpm 10.34.0",
      "Set file permissions",
      "Add pnpm to PATH",
    ]);

    const pnpmHome = join(tmpDir, "cache/pnpm/10.34.0");
    expect(vi.mocked(setEnv).mock.calls).toStrictEqual([
      ["PNPM_HOME", pnpmHome],
    ]);
    expect(vi.mocked(addPath).mock.calls).toStrictEqual([[pnpmHome]]);

    const { stdout, stderr } = await execFileAsync("pnpm", ["--version"], {
      env: {
        PATH: pnpmHome,
      },
    });
    expect(stdout.trim()).toBe("10.34.0");
    expect(stderr.trim()).toBe("");
  });
});
