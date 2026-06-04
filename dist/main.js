import 'node:fs';
import fsPromises, { mkdir, chmod } from 'node:fs/promises';
import os, { platform, arch } from 'node:os';
import path, { join } from 'node:path';
import { spawn } from 'node:child_process';

/**
 * @internal
 * Retrieves the value of an environment variable.
 *
 * @param name - The name of the environment variable.
 * @returns The value of the environment variable.
 * @throws Error if the environment variable is not defined.
 */
function mustGetEnvironment(name) {
    const value = process.env[name];
    if (value === undefined) {
        throw new Error(`the ${name} environment variable must be defined`);
    }
    return value;
}
/**
 * Retrieves the value of a GitHub Actions input.
 *
 * @param name - The name of the GitHub Actions input.
 * @returns The value of the GitHub Actions input, or an empty string if not found.
 */
function getInput(name) {
    const value = process.env[`INPUT_${name.toUpperCase()}`] ?? "";
    return value.trim();
}
/**
 * Sets the value of an environment variable in GitHub Actions.
 *
 * @param name - The name of the environment variable.
 * @param value - The value to set for the environment variable.
 * @returns A promise that resolves when the environment variable is
 *          successfully set.
 */
async function setEnv(name, value) {
    process.env[name] = value;
    const filePath = mustGetEnvironment("GITHUB_ENV");
    await fsPromises.appendFile(filePath, `${name}=${value}${os.EOL}`);
}
/**
 * Adds a system path to the environment in GitHub Actions.
 *
 * @param sysPath - The system path to add to the environment.
 * @returns A promise that resolves when the system path is successfully added.
 */
async function addPath(sysPath) {
    process.env.PATH =
        process.env.PATH !== undefined
            ? `${sysPath}${path.delimiter}${process.env.PATH}`
            : sysPath;
    const filePath = mustGetEnvironment("GITHUB_PATH");
    await fsPromises.appendFile(filePath, `${sysPath}${os.EOL}`);
}

/**
 * Logs an information message in GitHub Actions.
 *
 * @param message - The information message to log.
 */
function logInfo(message) {
    process.stdout.write(`${message}${os.EOL}`);
}
/**
 * Logs an error message in GitHub Actions.
 *
 * @param err - The error, which can be of any type.
 */
function logError(err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stdout.write(`::error::${message}${os.EOL}`);
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

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const curl = spawn("curl", ["-fLSs", "--output", dest, url]);
        const chunks = [];
        curl.stderr.on("data", (chunk) => chunks.push(chunk));
        curl.on("error", reject);
        curl.on("close", (code) => {
            if (code === 0) {
                resolve(undefined);
            }
            else {
                reject(new Error(Buffer.concat(chunks).toString().trim()));
            }
        });
    });
}

async function setupPnpmAction() {
    logInfo("Resolve pnpm version");
    const version = await resolvePnpmVersion(getInput("version"));
    logInfo("Create pnpm home");
    const slug = [process.env.RUNNER_TOOL_CACHE, "pnpm", version];
    const pnpmHome = join(...slug.filter((s) => s !== undefined));
    await mkdir(pnpmHome, { recursive: true });
    const binPath = join(pnpmHome, getPnpmBinaryName(platform()));
    const url = getPnpmDownloadUrl({
        version,
        platform: platform(),
        arch: arch(),
    });
    logInfo(`Download pnpm ${version}`);
    await downloadFile(url, binPath);
    logInfo("Set file permissions");
    await chmod(binPath, "755");
    logInfo("Add pnpm to PATH");
    await Promise.all([setEnv("PNPM_HOME", pnpmHome), addPath(pnpmHome)]);
}

await setupPnpmAction().catch((err) => {
    logError(err);
    process.exitCode = 1;
});
