import os from "node:os";
import { describe, it, expect, vi } from "vitest";
import { getArchitecture, getPlatform } from "./platform.js";

vi.mock("node:os", () => ({
  default: {
    arch: vi.fn(),
    platform: vi.fn(),
  },
}));

describe("retrieve the platform", () => {
  it("should retrieve the platform on Linux", () => {
    vi.mocked(os.platform).mockReturnValue("linux");
    expect(getPlatform()).toBe("linux");
  });

  it("should retrieve the platform on macOS", () => {
    vi.mocked(os.platform).mockReturnValue("darwin");
    expect(getPlatform()).toBe("macos");
  });

  it("should retrieve the platform on Windows", () => {
    vi.mocked(os.platform).mockReturnValue("win32");
    expect(getPlatform()).toBe("win");
  });

  it("should fail to retrieve the platform", () => {
    vi.mocked(os.platform).mockReturnValue("android");
    expect(() => getPlatform()).toThrow("Unknown platform: android");
  });
});

describe("retrieve the architecture", () => {
  it("should retrieve the architecture on x64", () => {
    vi.mocked(os.arch).mockReturnValue("x64");
    expect(getArchitecture()).toBe("x64");
  });

  it("should retrieve the architecture on arm64", () => {
    vi.mocked(os.arch).mockReturnValue("arm64");
    expect(getArchitecture()).toBe("arm64");
  });

  it("should fail to retrieve the architecture", () => {
    vi.mocked(os.arch).mockReturnValue("ia32");
    expect(() => getArchitecture()).toThrow("Unknown architecture: ia32");
  });
});
