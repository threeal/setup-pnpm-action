import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { downloadFile } from "./download.js";

let tempDir: string;
beforeAll(async () => {
  tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "test"));
});

it("should download a file", async () => {
  await downloadFile(
    "https://raw.githubusercontent.com/pnpm/pnpm/refs/heads/main/LICENSE",
    path.join(tempDir, "LICENSE"),
  );

  const data = await fsPromises.readFile(path.join(tempDir, "LICENSE"), "utf8");
  expect(data).toContain("The MIT License (MIT)");
});

it("should download a file following redirect", async () => {
  await downloadFile(
    "https://raw.github.com/pnpm/pnpm/refs/heads/main/LICENSE",
    path.join(tempDir, "releases"),
  );

  const data = await fsPromises.readFile(
    path.join(tempDir, "releases"),
    "utf8",
  );
  expect(data).toContain("The MIT License (MIT)");
});

it("should fail to download a file", async () => {
  await expect(
    downloadFile(
      "https://raw.githubusercontent.com/pnpm/pnpm/refs/heads/main/LICENSEe",
      path.join(tempDir, "LICENSEe"),
    ),
  ).rejects.toThrow("The requested URL returned error: 404");
});

afterAll(async () => {
  await fsPromises.rm(tempDir, { recursive: true, force: true });
});
