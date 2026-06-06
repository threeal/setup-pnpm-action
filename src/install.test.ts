import { logCommand, logInfo } from "ghakit/log";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
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
import { extractArchive, makeExecutable } from "./install.js";

const execFileAsync = promisify(execFile);

vi.mock(import("ghakit/exec"), async (importOriginal) => {
  const original = await importOriginal();
  return {
    exec: (command, args) =>
      original.exec(command, args, { stdout: "silent", stderr: "silent" }),
  } as typeof original;
});

vi.mock(import("ghakit/log"));

beforeEach(() => vi.clearAllMocks());

const tmpDir = resolve(
  import.meta.dirname,
  `.${basename(import.meta.filename)}.tmp`,
);

beforeAll(async () => {
  await rm(tmpDir, { force: true, recursive: true });
  await mkdir(tmpDir, { recursive: true });
  chdir(tmpDir);
});

afterAll(() => rm(tmpDir, { force: true, recursive: true }));

describe("extractArchive", () => {
  test("extracts .tar.gz archive", { timeout: 60000 }, async () => {
    await mkdir(join(tmpDir, "tar", "foo"), { recursive: true });
    await writeFile(join(tmpDir, "tar", "foo", "bar"), "foo bar");

    const file = join(tmpDir, "archive.tar.gz");
    await execFileAsync("tar", ["-czf", file, "-C", tmpDir, "tar"]);
    await rm(join(tmpDir, "tar"), { force: true, recursive: true });

    await extractArchive(file, tmpDir);

    expect(logCommand).toHaveBeenCalledOnce();

    const content = await readFile(join(tmpDir, "tar", "foo", "bar"), "utf-8");
    expect(content).toBe("foo bar");
  });

  test("extracts .zip archive", { timeout: 60000 }, async () => {
    await mkdir(join(tmpDir, "zip", "foo"), { recursive: true });
    await writeFile(join(tmpDir, "zip", "foo", "bar"), "foo bar");

    const file = join(tmpDir, "archive.zip");
    await execFileAsync("zip", ["-r", file, "zip"], { cwd: tmpDir });
    await rm(join(tmpDir, "zip"), { force: true, recursive: true });

    await extractArchive(file, tmpDir);

    expect(logCommand).toHaveBeenCalledOnce();

    const content = await readFile(join(tmpDir, "zip", "foo", "bar"), "utf-8");
    expect(content).toBe("foo bar");
  });

  test("throws for unsupported archive extension", async () => {
    await writeFile("archive.7z", "");

    await expect(extractArchive("archive.7z", tmpDir)).rejects.toThrow(
      "Unsupported archive extension: .7z",
    );

    expect(logCommand).not.toHaveBeenCalled();
  });
});

describe("makeExecutable", () => {
  test("sets file permissions for files without extension", async () => {
    const file = join(tmpDir, "pnpm");
    await writeFile(file, "");

    await makeExecutable(file);

    expect(vi.mocked(logInfo).mock.calls).toStrictEqual([
      ["Set file permissions"],
    ]);

    const { mode } = await stat(file);
    expect(mode & 0o111).toBeGreaterThan(0);
  });

  test("skips setting file permissions for .exe files", async () => {
    const file = join(tmpDir, "pnpm.exe");
    await writeFile(file, "");

    await makeExecutable(file);

    expect(logInfo).not.toHaveBeenCalled();
  });
});
