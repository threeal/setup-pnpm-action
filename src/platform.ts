import os from "node:os";

export type Platform = "linux" | "macos";
export type Architecture = "x64" | "arm64";

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

export function getArchitecture(): Architecture {
  switch (os.arch()) {
    case "x64":
      return "x64";
    case "arm64":
      return "arm64";
    default:
      throw new Error(`Unknown architecture: ${os.arch()}`);
  }
}
