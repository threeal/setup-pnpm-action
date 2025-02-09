import { spawn } from "node:child_process";

export async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const curl = spawn("curl", ["-fLSs", "--output", dest, url]);

    const chunks: Uint8Array[] = [];
    curl.stderr?.on("data", (chunk) => chunks.push(chunk));

    curl.on("error", reject);
    curl.on("close", (code) => {
      if (code === 0) {
        resolve(undefined);
      } else {
        reject(new Error(Buffer.concat(chunks).toString().trim()));
      }
    });
  });
}
