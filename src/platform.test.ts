import os from "node:os";
import { describe, it, expect, vi } from "vitest";
import { getPlatform } from "./platform.js";

vi.mock("node:os", () => ({ default: { platform: vi.fn() } }));

describe("retrieve the platform", () => {
  it("should retrieve the platform on Linux", () => {
    vi.mocked(os.platform).mockReturnValue("linux");
    expect(getPlatform()).toBe("linux");
  });

  it("should retrieve the platform on macOS", () => {
    vi.mocked(os.platform).mockReturnValue("darwin");
    expect(getPlatform()).toBe("macos");
  });

  it("should fail to retrieve the platform", () => {
    vi.mocked(os.platform).mockReturnValue("android");
    expect(() => getPlatform()).toThrow("Unknown platform: android");
  });
});
