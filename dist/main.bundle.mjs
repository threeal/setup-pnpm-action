import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';

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

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        https
            .get(url, (res) => {
            switch (res.statusCode) {
                case 200: {
                    const file = fs.createWriteStream(dest);
                    res.pipe(file);
                    file.on("finish", () => {
                        file.close(() => {
                            resolve();
                        });
                    });
                    file.on("error", reject);
                    break;
                }
                case 301:
                case 302:
                    logInfo(`Redirected to ${res.headers.location}`);
                    downloadFile(res.headers.location, dest)
                        .then(resolve)
                        .catch(reject);
                    break;
                default:
                    reject(new Error(res.statusMessage));
            }
        })
            .on("error", reject);
    });
}

async function createPnpmHome() {
    const pnpmHome = path.join(process.env.RUNNER_TOOL_CACHE, "pnpm");
    await fsPromises.mkdir(pnpmHome);
    return pnpmHome;
}
async function downloadPnpm(pnpmHome) {
    const pnpmFile = path.join(pnpmHome, "pnpm");
    await downloadFile("https://github.com/pnpm/pnpm/releases/download/v10.2.1/pnpm-linux-x64", pnpmFile);
    await fsPromises.chmod(pnpmFile, "755");
}
async function setupPnpm(pnpmHome) {
    await Promise.all([setEnv("PNPM_HOME", pnpmHome), addPath(pnpmHome)]);
}

try {
    const pnpmHome = await createPnpmHome();
    logInfo(`Downloading pnpm to ${pnpmHome}...`);
    await downloadPnpm(pnpmHome);
    await setupPnpm(pnpmHome);
}
catch (err) {
    logError(err);
    process.exitCode = 1;
}
