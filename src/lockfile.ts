/**
 * Extracts the locked pnpm version from the contents of a `pnpm-lock.yaml`.
 *
 * pnpm locks its own version in a separate YAML document at the start of the
 * lockfile, under `importers['.'].packageManagerDependencies['@pnpm/exe']`.
 * Rather than parsing YAML in full, this follows that path by indentation,
 * assuming the layout pnpm writes.
 * @param content - The contents of a `pnpm-lock.yaml` file.
 * @returns The exact locked version, or `undefined` if the lockfile doesn't
 * lock one.
 */
export function extractVersionFromPnpmLock(
  content: string,
): string | undefined {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") return undefined;

  const keys = [
    "importers:",
    ".:",
    "packageManagerDependencies:",
    "'@pnpm/exe':",
  ];
  let depth = 0;
  for (const line of lines.slice(1)) {
    // Stops at the end of the document.
    if (line === "---") break;

    const key = line.trimStart();
    if (key === "") continue;

    const indent = line.length - key.length;
    // Stops after leaving the block matched so far.
    if (indent < depth * 2) break;
    // Skips entries nested in a block that isn't on the path.
    if (indent > depth * 2) continue;

    if (depth < keys.length) {
      if (key === keys[depth]) depth++;
      continue;
    }

    const match = /^version: (\d+\.\d+\.\d+)$/.exec(key);
    if (match !== null) return match[1];
  }
  return undefined;
}
