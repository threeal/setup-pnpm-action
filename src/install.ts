import { exec } from "ghakit/exec";
import { logCommand, logInfo } from "ghakit/log";
import { chmod } from "node:fs/promises";
import { extname } from "node:path";

export async function extractArchive(archiveFile: string, outputDir: string) {
  const ext = extname(archiveFile);
  switch (ext) {
    case ".gz": {
      const args: string[] = ["-xzvf", archiveFile, "-C", outputDir];
      logCommand("tar", ...args);
      await exec("tar", args);
      break;
    }

    case ".zip": {
      const args: string[] = [archiveFile, "-d", outputDir];
      logCommand("unzip", ...args);
      await exec("unzip", args);
      break;
    }

    default:
      throw new Error(`Unsupported archive extension: ${ext}`);
  }
}

export async function makeExecutable(file: string) {
  if (extname(file) === ".exe") return;
  logInfo("Set file permissions");
  await chmod(file, "755");
}
