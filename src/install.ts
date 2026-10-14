import { exec } from "ghakit/exec";
import { logCommand, logInfo } from "ghakit/log";
import { chmod } from "node:fs/promises";

/**
 * Extracts a pnpm archive into a directory.
 *
 * Uses `tar` for a `.tar.gz` archive and `unzip` for a `.zip` archive.
 * @param file - The path of the archive to extract.
 * @param ext - The archive's extension, which decides how it's extracted.
 * @param outputDir - The directory to extract the archive into.
 */
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

/**
 * Makes a downloaded pnpm executable runnable.
 *
 * Does nothing for a Windows `.exe`, which needs no permission change.
 * @param file - The path of the pnpm executable.
 * @param ext - The executable's extension, either empty or `.exe`.
 */
export async function makeExecutable(file: string, ext: "" | ".exe") {
  if (ext === ".exe") return;
  logInfo("Make pnpm executable");
  await chmod(file, "755");
}
