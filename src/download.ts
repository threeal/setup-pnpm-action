import { logInfo } from "gha-utils";
import https from "node:https";
import fs from "node:fs";

export async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    https
      .get(url, (res) => {
        switch (res.statusCode) {
          case 200: {
            const file = fs.createWriteStream(dest);

            res.pipe(file);

            file.on("finish", () => {
              file.close(() => {
                resolve();
              });
            });

            file.on("error", reject);
            break;
          }

          case 301:
          case 302:
            logInfo(`Redirected to ${res.headers.location}`);
            downloadFile(res.headers.location!, dest)
              .then(resolve)
              .catch(reject);
            break;

          default:
            reject(new Error(res.statusMessage));
        }
      })
      .on("error", reject);
  });
}
