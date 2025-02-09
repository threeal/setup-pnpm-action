import os from "node:os";

export type Platform = "linux" | "macos";

export function getPlatform(): Platform {
  switch (os.platform()) {
    case "linux":
      return "linux";
    case "darwin":
      return "macos";
    default:
      throw new Error(`Unknown platform: ${os.platform()}`);
  }
}
