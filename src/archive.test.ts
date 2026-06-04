import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { chdir } from "node:process";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { extractArchive } from "./archive.js";

const execFileAsync = promisify(execFile);

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

describe("extractArchive", { concurrent: true }, () => {
  test("extracts .tar.gz archive", { timeout: 60000 }, async () => {
    await mkdir(join(tmpDir, "tar", "foo"), { recursive: true });
    await writeFile(join(tmpDir, "tar", "foo", "bar"), "foo bar");

    const archiveFile = join(tmpDir, "archive.tar.gz");
    await execFileAsync("tar", ["-czf", archiveFile, "-C", tmpDir, "tar"]);
    await rm(join(tmpDir, "tar"), { force: true, recursive: true });

    await extractArchive(archiveFile, tmpDir);

    const content = await readFile(join(tmpDir, "tar", "foo", "bar"), "utf-8");
    expect(content).toBe("foo bar");
  });

  test("extracts .zip archive", { timeout: 60000 }, async () => {
    await mkdir(join(tmpDir, "zip", "foo"), { recursive: true });
    await writeFile(join(tmpDir, "zip", "foo", "bar"), "foo bar");

    const archiveFile = join(tmpDir, "archive.zip");
    await execFileAsync("zip", ["-r", archiveFile, "zip"], { cwd: tmpDir });
    await rm(join(tmpDir, "zip"), { force: true, recursive: true });

    await extractArchive(archiveFile, tmpDir);

    const content = await readFile(join(tmpDir, "zip", "foo", "bar"), "utf-8");
    expect(content).toBe("foo bar");
  });

  test("throws for unsupported archive extension", async () => {
    await writeFile("archive.7z", "");

    await expect(extractArchive("archive.7z", tmpDir)).rejects.toThrow(
      "Unsupported archive extension: .7z",
    );
  });
});
