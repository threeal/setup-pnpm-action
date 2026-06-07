import { exec } from "ghakit/exec";
import { logCommand, logInfo } from "ghakit/log";
import { chmod } from "node:fs/promises";

export async function extractArchive(
  file: string,
  ext: ".tar.gz" | ".zip",
  outputDir: string,
) {
  switch (ext) {
    case ".tar.gz": {
      const args: string[] = ["-xzvf", file, "-C", outputDir];
      logCommand("tar", ...args);
      await exec("tar", args);
      break;
    }

    case ".zip": {
      const args: string[] = [file, "-d", outputDir];
      logCommand("unzip", ...args);
      await exec("unzip", args);
      break;
    }
  }
}

export async function makeExecutable(file: string, ext: "" | ".exe") {
  if (ext === ".exe") return;
  logInfo("Make pnpm executable");
  await chmod(file, "755");
}
