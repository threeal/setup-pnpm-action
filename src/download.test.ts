import { mkdir, readFile, rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { downloadFile } from "./download.js";

const tmpDir = resolve(
  import.meta.dirname,
  `.${basename(import.meta.filename)}.tmp`,
);

beforeAll(async () => {
  await rm(tmpDir, { force: true, recursive: true });
  await mkdir(tmpDir, { recursive: true });
});

afterAll(() => rm(tmpDir, { force: true, recursive: true }));

describe("downloadFile", { concurrent: true }, () => {
  test("downloads a file", async () => {
    await downloadFile(
      "https://raw.githubusercontent.com/pnpm/pnpm/refs/heads/main/LICENSE",
      join(tmpDir, "LICENSE"),
    );

    const data = await readFile(join(tmpDir, "LICENSE"), "utf8");
    expect(data).toContain("The MIT License (MIT)");
  });

  test("downloads a file following a redirect", async () => {
    await downloadFile(
      "https://raw.github.com/pnpm/pnpm/refs/heads/main/LICENSE",
      join(tmpDir, "releases"),
    );

    const data = await readFile(join(tmpDir, "releases"), "utf8");
    expect(data).toContain("The MIT License (MIT)");
  });

  test("fails to download a nonexistent file", async () => {
    await expect(
      downloadFile(
        "https://raw.githubusercontent.com/pnpm/pnpm/refs/heads/main/LICENSEe",
        join(tmpDir, "LICENSEe"),
      ),
    ).rejects.toThrow("The requested URL returned error: 404");
  });
});
