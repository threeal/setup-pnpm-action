import { EOL, platform, arch } from 'os';
import { spawn } from 'child_process';
import 'fs';
import { access, mkdir, rm, readFile, appendFile, chmod } from 'fs/promises';
import { join, basename, delimiter } from 'path';

// node_modules/.pnpm/ghakit@1.0.0/node_modules/ghakit/dist/log.js
function logInfo(message) {
  process.stdout.write(`${message}${EOL}`);
}
function logError(err, options) {
  const message = err instanceof Error ? err.message : String(err);
  const params = "";
  process.stdout.write(`::error${params}::${message}${EOL}`);
}
function logCommand(command, ...args) {
  const message = [command, ...args].join(" ");
  process.stdout.write(`[command]${message}${EOL}`);
}
function beginLogGroup(name) {
  process.stdout.write(`::group::${name}${EOL}`);
}
function endLogGroup() {
  process.stdout.write(`::endgroup::${EOL}`);
}
function exec(command, args, opts) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: [
        "inherit",
        "inherit" ,
        "inherit" 
      ]
    });
    const stdoutChunks = [];
    if (proc.stdout !== null) {
      proc.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
    }
    const stderrChunks = [];
    if (proc.stderr !== null) {
      proc.stderr.on("data", (chunk) => stderrChunks.push(chunk));
    }
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) {
        {
          resolve();
        }
      } else {
        reject(new Error(code !== null ? `Process "${command}" exited with code ${code.toString()}` : `Process "${command}" was terminated by a signal`));
      }
    });
  });
}

// node_modules/.pnpm/ghakit@1.0.0/node_modules/ghakit/dist/vars.js
function getGitHubEnv() {
  return process.env.GITHUB_ENV ?? "";
}
function getGitHubOutput() {
  return process.env.GITHUB_OUTPUT ?? "";
}
function getGitHubPath() {
  return process.env.GITHUB_PATH ?? "";
}
function getRunnerToolCache() {
  return process.env.RUNNER_TOOL_CACHE ?? "";
}

// node_modules/.pnpm/ghakit@1.0.0/node_modules/ghakit/dist/io.js
function getInput(name) {
  return process.env[`INPUT_${name.toUpperCase()}`] ?? "";
}
async function setOutput(name, value) {
  await appendFile(getGitHubOutput(), `${name}=${value}${EOL}`);
}
async function setEnv(name, value) {
  process.env[name] = value;
  await appendFile(getGitHubEnv(), `${name}=${value}${EOL}`);
}
async function addPath(sysPath) {
  process.env.PATH = process.env.PATH !== void 0 ? `${sysPath}${delimiter}${process.env.PATH}` : sysPath;
  await appendFile(getGitHubPath(), `${sysPath}${EOL}`);
}
function getPlatform() {
  const val = platform();
  switch (val) {
    case "linux":
    case "darwin":
    case "win32":
      return val;
    default:
      throw new Error(`Unsupported platform: ${val}`);
  }
}
function getArch() {
  const val = arch();
  switch (val) {
    case "x64":
    case "arm64":
      return val;
    default:
      throw new Error(`Unsupported arch: ${val}`);
  }
}
function extractVersionFromPackageJson(packageJson) {
  if (typeof packageJson !== "object" || packageJson === null) {
    throw new Error("package.json must be an object");
  }
  if (!("packageManager" in packageJson)) {
    throw new Error("Missing `packageManager` field in package.json");
  }
  if (typeof packageJson.packageManager !== "string") {
    throw new Error("`packageManager` must be a string");
  }
  const match = /^([^@]+)@(\d+\.\d+\.\d+)(?:$|\+.*)$/.exec(
    packageJson.packageManager
  );
  if (match?.length !== 3) {
    throw new Error(
      `Invalid \`packageManager\` value: ${packageJson.packageManager}`
    );
  }
  if (match[1] !== "pnpm") {
    throw new Error(`Unsupported package manager: ${match[1]}, expected pnpm`);
  }
  return match[2];
}
async function getVersionInput() {
  const version = getInput("version").trim();
  const versionFile = getInput("version-file").trim();
  if (version !== "") {
    if (versionFile !== "") {
      throw new Error(
        "Cannot specify both `version` and `version-file` inputs"
      );
    }
    return version;
  }
  if (versionFile !== "") {
    const versionFileName = basename(versionFile);
    if (versionFileName === "package.json") {
      logInfo("Read version from package.json");
      const content = await readFile(versionFile, "utf-8");
      return extractVersionFromPackageJson(JSON.parse(content));
    } else {
      throw new Error(`Unsupported version file: ${versionFileName}`);
    }
  }
  try {
    const content = await readFile("package.json", "utf-8");
    logInfo("No version specified, read version from package.json");
    try {
      return extractVersionFromPackageJson(JSON.parse(content));
    } catch (err) {
      logError(err);
      logInfo("Failed to read version from package.json, use latest");
      return "latest";
    }
  } catch {
    logInfo("No version specified, use latest");
    return "latest";
  }
}
async function extractArchive(file, ext, outputDir) {
  switch (ext) {
    case ".tar.gz": {
      const args = ["-xzvf", file, "-C", outputDir];
      logCommand("tar", ...args);
      await exec("tar", args);
      break;
    }
    case ".zip": {
      const args = [file, "-d", outputDir];
      logCommand("unzip", ...args);
      await exec("unzip", args);
      break;
    }
  }
}
async function makeExecutable(file, ext) {
  if (ext === ".exe") return;
  logInfo("Make pnpm executable");
  await chmod(file, "755");
}
async function resolvePnpmVersionFromResponse(version, res) {
  if (!res.ok) {
    throw new Error(`Failed to fetch version registry: ${res.statusText}`);
  }
  const data = await res.json();
  if (typeof data === "object" && data !== null) {
    if ("dist-tags" in data && typeof data["dist-tags"] === "object" && data["dist-tags"] !== null) {
      const distTags = data["dist-tags"];
      if (version in distTags && typeof distTags[version] === "string") {
        return distTags[version];
      }
    }
    if ("versions" in data && typeof data.versions === "object" && data.versions !== null) {
      if (version in data.versions) return version;
    }
  }
  throw new Error(`Unknown version: ${version}`);
}
async function resolvePnpmVersion(version) {
  const res = await fetch("https://registry.npmjs.org/@pnpm/exe");
  return resolvePnpmVersionFromResponse(version, res);
}
function getPnpmMajorVersion(version) {
  const match = /^(\d+)/.exec(version);
  if (!match) throw new Error(`Invalid version: ${version}`);
  return parseInt(match[1], 10);
}
function getPnpmHome({
  version,
  platform: platform2,
  arch: arch2
}) {
  return join(getRunnerToolCache(), "pnpm", `${version}-${platform2}-${arch2}`);
}
function getOsFromPlatform(platform2) {
  switch (platform2) {
    case "linux":
      return "linux";
    case "darwin":
      return "macos";
    case "win32":
      return "win";
  }
}
function getPnpmDownloadUrl({
  version,
  platform: platform2,
  arch: arch2
}) {
  return {
    baseUrl: `https://github.com/pnpm/pnpm/releases/download/v${version}`,
    filename: `pnpm-${getOsFromPlatform(platform2)}-${arch2}`,
    ext: platform2 === "win32" ? ".exe" : ""
  };
}
function getPnpm11DownloadUrl({
  version,
  platform: platform2,
  arch: arch2
}) {
  if (platform2 === "darwin" && arch2 === "x64") {
    throw new Error(
      "pnpm does not provide x64 macOS binaries for version 11 and above"
    );
  }
  return {
    baseUrl: `https://github.com/pnpm/pnpm/releases/download/v${version}`,
    filename: `pnpm-${platform2}-${arch2}`,
    ext: platform2 == "win32" ? ".zip" : ".tar.gz"
  };
}

// src/action.ts
async function setupPnpmAction() {
  const platform2 = getPlatform();
  const arch2 = getArch();
  const versionInput = await getVersionInput();
  logInfo("Resolve pnpm version");
  const version = await resolvePnpmVersion(versionInput);
  const majorVersion = getPnpmMajorVersion(version);
  const pnpmHome = getPnpmHome({ version, platform: platform2, arch: arch2 });
  await setEnv("PNPM_HOME", pnpmHome);
  try {
    await access(pnpmHome);
    logInfo(`Use cached pnpm ${version}`);
  } catch {
    if (majorVersion < 11) {
      const { baseUrl, filename, ext } = getPnpmDownloadUrl({
        version,
        platform: platform2,
        arch: arch2
      });
      const url = `${baseUrl}/${filename}${ext}`;
      logInfo("Create pnpm home");
      await mkdir(pnpmHome, { recursive: true });
      beginLogGroup(`Download pnpm ${version} executable`);
      const execFile = join(pnpmHome, `pnpm${ext}`);
      try {
        const args = ["-fL", "--output", execFile, url];
        logCommand("curl", ...args);
        await exec("curl", args);
      } finally {
        endLogGroup();
      }
      await makeExecutable(execFile, ext);
    } else {
      const { baseUrl, filename, ext } = getPnpm11DownloadUrl({
        version,
        platform: platform2,
        arch: arch2
      });
      const url = `${baseUrl}/${filename}${ext}`;
      logInfo("Create pnpm home");
      await mkdir(pnpmHome, { recursive: true });
      beginLogGroup(`Download pnpm ${version} archive`);
      const archiveFile = join(pnpmHome, filename);
      try {
        const args = ["-fL", "--output", archiveFile, url];
        logCommand("curl", ...args);
        await exec("curl", args);
      } finally {
        endLogGroup();
      }
      beginLogGroup("Extract pnpm archive");
      try {
        await extractArchive(archiveFile, ext, pnpmHome);
      } finally {
        endLogGroup();
      }
      logInfo("Remove pnpm archive");
      await rm(archiveFile);
    }
  }
  logInfo("Add pnpm to PATH");
  await addPath(pnpmHome);
  await setOutput("version", version);
}

// src/main.ts
await setupPnpmAction().catch((err) => {
  logError(err);
  process.exitCode = 1;
});
