import { EOL, platform, arch } from 'node:os';
import { delimiter, join } from 'node:path';
import { appendFile, mkdir, chmod } from 'node:fs/promises';
import 'node:fs';
import { spawn } from 'node:child_process';

/**
 * Logs an information message in GitHub Actions.
 *
 * @param message - The information message to log.
 */
function logInfo(message) {
    process.stdout.write(`${message}${EOL}`);
}
/**
 * Logs an error message in GitHub Actions.
 *
 * @param err - The error, which can be of any type.
 * @param options - Optional annotation parameters to pin the message to a file location.
 */
function logError(err, options) {
    const message = err instanceof Error ? err.message : String(err);
    const params = "";
    process.stdout.write(`::error${params}::${message}${EOL}`);
}

async function resolvePnpmVersionFromResponse(version, res) {
    if (!res.ok) {
        throw new Error(`Failed to fetch version registry: ${res.statusText}`);
    }
    const data = await res.json();
    if (typeof data === "object" && data !== null) {
        if ("dist-tags" in data &&
            typeof data["dist-tags"] === "object" &&
            data["dist-tags"] !== null) {
            const distTags = data["dist-tags"];
            if (version in distTags && typeof distTags[version] === "string") {
                return distTags[version];
            }
        }
        if ("versions" in data &&
            typeof data.versions === "object" &&
            data.versions !== null) {
            if (version in data.versions)
                return version;
        }
    }
    throw new Error(`Unknown version: ${version}`);
}
async function resolvePnpmVersion(version) {
    const res = await fetch("https://registry.npmjs.org/@pnpm/exe");
    return resolvePnpmVersionFromResponse(version, res);
}
function getPnpmBinaryName(platform) {
    return platform === "win32" ? "pnpm.exe" : "pnpm";
}
function getPnpmDownloadUrl({ version, platform, arch, }) {
    let os;
    switch (platform) {
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
            throw new Error(`Unsupported platform: ${platform}`);
    }
    let archStr;
    switch (arch) {
        case "x64":
            archStr = "x64";
            break;
        case "arm64":
            archStr = "arm64";
            break;
        default:
            throw new Error(`Unsupported arch: ${arch}`);
    }
    const ext = platform === "win32" ? ".exe" : "";
    return `https://github.com/pnpm/pnpm/releases/download/v${version}/pnpm-${os}-${archStr}${ext}`;
}

/**
 * Returns whether the workflow is running in a CI environment.
 *
 * @returns `true` if running in a CI environment, `false` otherwise.
 */
/**
 * Returns the path to the file used to set environment variables from
 * workflow commands.
 *
 * @returns The path to the GitHub env file, or an empty string if not set.
 */
function getGitHubEnv() {
    return process.env.GITHUB_ENV ?? "";
}
/**
 * Returns the path to the file used to prepend entries to the system `PATH`
 * from workflow commands.
 *
 * @returns The path to the GitHub path file, or an empty string if not set.
 */
function getGitHubPath() {
    return process.env.GITHUB_PATH ?? "";
}
/**
 * Returns the path to the directory containing preinstalled tools for
 * GitHub-hosted runners.
 *
 * @returns The runner tool cache path, or an empty string if not set.
 */
function getRunnerToolCache() {
    return process.env.RUNNER_TOOL_CACHE ?? "";
}

/**
 * Retrieves the value of a GitHub Actions input.
 *
 * Input names are matched case-insensitively — `getInput("token")` and
 * `getInput("TOKEN")` both read the same `INPUT_TOKEN` env var.
 *
 * @param name - The name of the GitHub Actions input.
 * @returns The value of the GitHub Actions input, or an empty string if not set.
 */
function getInput(name) {
    return process.env[`INPUT_${name.toUpperCase()}`] ?? "";
}
/**
 * Sets the value of an environment variable in GitHub Actions.
 *
 * Updates `process.env` immediately so the variable is available in the
 * current process, and appends it to the env file for subsequent steps.
 *
 * @param name - The name of the environment variable.
 * @param value - The value to set for the environment variable.
 * @returns A promise that resolves when the environment variable is successfully set.
 */
async function setEnv(name, value) {
    process.env[name] = value;
    await appendFile(getGitHubEnv(), `${name}=${value}${EOL}`);
}
/**
 * Adds a system path to the environment in GitHub Actions.
 *
 * Prepends the path to `process.env.PATH` immediately so it is available in
 * the current process, and appends it to the path file for subsequent steps.
 *
 * @param sysPath - The system path to add to the environment.
 * @returns A promise that resolves when the system path is successfully added.
 */
async function addPath(sysPath) {
    process.env.PATH =
        process.env.PATH !== undefined
            ? `${sysPath}${delimiter}${process.env.PATH}`
            : sysPath;
    await appendFile(getGitHubPath(), `${sysPath}${EOL}`);
}

function exec(command, args, opts) {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args, {
            stdio: [
                "inherit",
                "ignore",
                "ignore",
            ],
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
            }
            else {
                reject(new Error(code !== null
                    ? `Process "${command}" exited with code ${code.toString()}`
                    : `Process "${command}" was terminated by a signal`));
            }
        });
    });
}

async function setupPnpmAction() {
    logInfo("Resolve pnpm version");
    const version = await resolvePnpmVersion(getInput("version").trim());
    logInfo("Create pnpm home");
    const pnpmHome = join(getRunnerToolCache(), "pnpm", version);
    await mkdir(pnpmHome, { recursive: true });
    const binPath = join(pnpmHome, getPnpmBinaryName(platform()));
    const url = getPnpmDownloadUrl({
        version,
        platform: platform(),
        arch: arch(),
    });
    logInfo(`Download pnpm ${version}`);
    await exec("curl", ["-fLSs", "--output", binPath, url]);
    logInfo("Set file permissions");
    await chmod(binPath, "755");
    logInfo("Add pnpm to PATH");
    await Promise.all([setEnv("PNPM_HOME", pnpmHome), addPath(pnpmHome)]);
}

await setupPnpmAction().catch((err) => {
    logError(err);
    process.exitCode = 1;
});
