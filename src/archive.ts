import { exec } from "ghakit/exec";
import { extname } from "node:path";

export async function extractArchive(archiveFile: string, outputDir: string) {
  const ext = extname(archiveFile);
  switch (ext) {
    case ".gz":
      await exec("tar", ["-xzf", archiveFile, "-C", outputDir], {
        stdout: "silent",
        stderr: "silent",
      });
      break;

    case ".zip":
      await exec("unzip", [archiveFile, "-d", outputDir], {
        stdout: "silent",
        stderr: "silent",
      });
      break;

    default:
      throw new Error(`Unsupported archive extension: ${ext}`);
  }
}
