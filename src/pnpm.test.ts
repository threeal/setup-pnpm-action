import fsPromises from "node:fs/promises";
import { expect, it, vi } from "vitest";
import { createPnpmHome } from "./pnpm";

vi.mock("node:fs/promises", () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
  },
}));

it("should create a pnpm home directory", async () => {
  process.env.RUNNER_TOOL_CACHE = "/tool";

  const pnpmHome = await createPnpmHome();

  expect(pnpmHome).toBe("/tool/pnpm");
  expect(fsPromises.mkdir).toBeCalledWith(pnpmHome);
});
