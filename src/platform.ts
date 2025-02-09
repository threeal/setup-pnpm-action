import os from "node:os";

export type Platform = "linux";

export function getPlatform(): Platform {
  switch (os.platform()) {
    case "linux":
      return "linux";
    default:
      throw new Error(`Unknown platform: ${os.platform()}`);
  }
}
