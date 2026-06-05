import { arch, platform, EOL } from 'os';
import { spawn } from 'child_process';
import 'fs';
import { access, mkdir, chmod, rm, appendFile } from 'fs/promises';
import { join, extname, delimiter } from 'path';

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
async function extractArchive(archiveFile, outputDir) {
  const ext = extname(archiveFile);
  switch (ext) {
    case ".gz": {
      const args = ["-xzvf", archiveFile, "-C", outputDir];
      logCommand("tar", ...args);
      await exec("tar", args);
      break;
    }
    case ".zip": {
      const args = [archiveFile, "-d", outputDir];
      logCommand("unzip", ...args);
      await exec("unzip", args);
      break;
    }
    default:
      throw new Error(`Unsupported archive extension: ${ext}`);
  }
}

// src/pnpm.ts
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
function getPnpmDownloadUrl({
  version,
  platform: platform2,
  arch: arch2
}) {
  const match = /^(\d+)/.exec(version);
  if (!match) throw new Error(`Invalid version: ${version}`);
  const major = parseInt(match[1], 10);
  let os;
  switch (platform2) {
    case "linux":
      os = "linux";
      break;
    case "darwin":
      os = "macos";
      break;
    case "win32":
      os = "win";
      break;
    default:
      throw new Error(`Unsupported platform: ${platform2}`);
  }
  switch (arch2) {
    case "x64":
      if (platform2 === "darwin" && major >= 11) {
        throw new Error(
          "pnpm does not provide x64 macOS binaries for version 11 and above"
        );
      }
      break;
    case "arm64":
      break;
    default:
      throw new Error(`Unsupported arch: ${arch2}`);
  }
  const file = major >= 11 ? `pnpm-${platform2}-${arch2}${platform2 == "win32" ? ".zip" : ".tar.gz"}` : `pnpm-${os}-${arch2}${platform2 === "win32" ? ".exe" : ""}`;
  return new URL(
    `https://github.com/pnpm/pnpm/releases/download/v${version}/${file}`
  );
}

// src/action.ts
async function setupPnpmAction() {
  logInfo("Resolve pnpm version");
  const version = await resolvePnpmVersion(getInput("version").trim());
  const pnpmHome = join(getRunnerToolCache(), "pnpm", version);
  await setEnv("PNPM_HOME", pnpmHome);
  try {
    await access(pnpmHome);
    logInfo(`Use cached pnpm ${version}`);
  } catch {
    logInfo("Create pnpm home");
    await mkdir(pnpmHome, { recursive: true });
    const dlUrl = getPnpmDownloadUrl({
      version,
      platform: platform(),
      arch: arch()
    });
    const dlFile = dlUrl.pathname.slice(dlUrl.pathname.lastIndexOf("/") + 1);
    let dlOut;
    const dlFileExt = extname(dlFile);
    switch (dlFileExt) {
      case ".gz":
      case ".zip":
        dlOut = join(pnpmHome, dlFile);
        break;
      default:
        dlOut = join(pnpmHome, `pnpm${dlFileExt}`);
    }
    beginLogGroup(`Download pnpm ${version}`);
    try {
      const args = ["-fL", "--output", dlOut, dlUrl.href];
      logCommand("curl", ...args);
      await exec("curl", args);
    } finally {
      endLogGroup();
    }
    const dlOutExt = extname(dlOut);
    switch (dlOutExt) {
      case ".gz":
      case ".zip":
        beginLogGroup("Extract archive");
        try {
          await extractArchive(dlOut, pnpmHome);
        } finally {
          endLogGroup();
        }
        logInfo("Remove archive");
        await rm(dlOut);
        break;
      default:
        logInfo("Set file permissions");
        await chmod(dlOut, "755");
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
