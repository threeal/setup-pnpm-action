import { spawn } from "node:child_process";
import { access, appendFile, chmod, mkdir, readFile, rm } from "node:fs/promises";
import { EOL, arch, platform } from "node:os";
import { basename, delimiter, join } from "node:path";
//#region node_modules/.pnpm/ghakit@1.0.0/node_modules/ghakit/dist/exec.js
function exec(command, args, opts) {
	return new Promise((resolve, reject) => {
		const stdoutMode = opts?.stdout ?? "inherit";
		const stderrMode = opts?.stderr ?? "inherit";
		const proc = spawn(command, args, { stdio: [
			"inherit",
			stdoutMode === "inherit" ? "inherit" : stdoutMode === "capture" ? "pipe" : "ignore",
			stderrMode === "inherit" ? "inherit" : stderrMode === "capture" ? "pipe" : "ignore"
		] });
		const stdoutChunks = [];
		if (proc.stdout !== null) proc.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
		const stderrChunks = [];
		if (proc.stderr !== null) proc.stderr.on("data", (chunk) => stderrChunks.push(chunk));
		proc.on("error", reject);
		proc.on("close", (code) => {
			if (code === 0) {
				if (stdoutMode === "capture" || stderrMode === "capture") {
					const result = {};
					if (stdoutMode === "capture") result.stdout = Buffer.concat(stdoutChunks).toString();
					if (stderrMode === "capture") result.stderr = Buffer.concat(stderrChunks).toString();
					resolve(result);
				} else resolve();
			} else reject(new Error(code !== null ? `Process "${command}" exited with code ${code.toString()}` : `Process "${command}" was terminated by a signal`));
		});
	});
}
//#endregion
//#region node_modules/.pnpm/ghakit@1.0.0/node_modules/ghakit/dist/vars.js
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
//#endregion
//#region node_modules/.pnpm/ghakit@1.0.0/node_modules/ghakit/dist/io.js
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
//#endregion
//#region node_modules/.pnpm/ghakit@1.0.0/node_modules/ghakit/dist/log.js
function logInfo(message) {
	process.stdout.write(`${message}${EOL}`);
}
function formatAnnotationParams(options) {
	const params = Object.entries(options).filter(([, v]) => v !== void 0).map(([k, v]) => `${k}=${String(v)}`).join(",");
	return params ? ` ${params}` : "";
}
function logError(err, options) {
	const message = err instanceof Error ? err.message : String(err);
	const params = options ? formatAnnotationParams(options) : "";
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
//#endregion
//#region src/input.ts
function getPlatform() {
	const val = platform();
	switch (val) {
		case "linux":
		case "darwin":
		case "win32": return val;
		default: throw new Error(`Unsupported platform: ${val}`);
	}
}
function getArch() {
	const val = arch();
	switch (val) {
		case "x64":
		case "arm64": return val;
		default: throw new Error(`Unsupported arch: ${val}`);
	}
}
function extractVersionFromPackageJson(packageJson) {
	if (typeof packageJson !== "object" || packageJson === null) throw new Error("package.json must be an object");
	if (!("packageManager" in packageJson)) throw new Error("Missing `packageManager` field in package.json");
	if (typeof packageJson.packageManager !== "string") throw new Error("`packageManager` must be a string");
	const match = /^([^@]+)@(\d+\.\d+\.\d+)(?:$|\+.*)$/.exec(packageJson.packageManager);
	if (match?.length !== 3) throw new Error(`Invalid \`packageManager\` value: ${packageJson.packageManager}`);
	if (match[1] !== "pnpm") throw new Error(`Unsupported package manager: ${match[1]}, expected pnpm`);
	return match[2];
}
async function getVersionInput() {
	const version = getInput("version").trim();
	const versionFile = getInput("version-file").trim();
	if (version !== "") {
		if (versionFile !== "") throw new Error("Cannot specify both `version` and `version-file` inputs");
		return version;
	}
	if (versionFile !== "") {
		const versionFileName = basename(versionFile);
		if (versionFileName === "package.json") {
			logInfo("Read version from package.json");
			const content = await readFile(versionFile, "utf-8");
			return extractVersionFromPackageJson(JSON.parse(content));
		} else throw new Error(`Unsupported version file: ${versionFileName}`);
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
//#endregion
//#region src/install.ts
async function extractArchive(file, ext, outputDir) {
	switch (ext) {
		case ".tar.gz": {
			const args = [
				"-xzvf",
				file,
				"-C",
				outputDir
			];
			logCommand("tar", ...args);
			await exec("tar", args);
			break;
		}
		case ".zip": {
			const args = [
				file,
				"-d",
				outputDir
			];
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
//#endregion
//#region src/pnpm.ts
async function fetchNpmPackageRegistry(pkg) {
	const res = await fetch(`https://registry.npmjs.org/${pkg}`);
	if (!res.ok) throw new Error(`Failed to fetch ${pkg} from npm registry: ${res.statusText}`);
	return res.json();
}
function resolvePnpmVersion(tag, registry) {
	if (typeof registry !== "object" || registry === null) throw new Error("Registry must be an object");
	if (!("dist-tags" in registry)) throw new Error("Missing `dist-tags` field in registry");
	const distTags = registry["dist-tags"];
	if (typeof distTags !== "object" || distTags === null) throw new Error("`dist-tags` must be an object");
	const entry = Object.entries(distTags).find((entry) => entry[0] === tag);
	if (!entry) throw new Error(`Unknown tag: ${tag}`);
	if (typeof entry[1] !== "string") throw new Error(`Tag ${tag} did not resolve to a string`);
	return entry[1];
}
function verifyPnpmVersion(tag, registry) {
	if (typeof registry !== "object" || registry === null) throw new Error("Registry must be an object");
	if (!("versions" in registry)) throw new Error("Missing `versions` field in registry");
	const versions = registry.versions;
	if (typeof versions !== "object" || versions === null) throw new Error("`versions` must be an object");
	if (!Object.entries(versions).find((entry) => entry[0] === tag)) throw new Error(`Unknown version: ${tag}`);
}
function getPnpmMajorVersion(version) {
	const match = /^(\d+)/.exec(version);
	if (!match) throw new Error(`Invalid version: ${version}`);
	return parseInt(match[1], 10);
}
function getPnpmHome({ version, platform, arch }) {
	return join(getRunnerToolCache(), "pnpm", `${version}-${platform}-${arch}`);
}
function getOsFromPlatform(platform) {
	switch (platform) {
		case "linux": return "linux";
		case "darwin": return "macos";
		case "win32": return "win";
	}
}
function getPnpmDownloadUrl({ version, platform, arch }) {
	return {
		baseUrl: `https://github.com/pnpm/pnpm/releases/download/v${version}`,
		filename: `pnpm-${getOsFromPlatform(platform)}-${arch}`,
		ext: platform === "win32" ? ".exe" : ""
	};
}
function getPnpm11DownloadUrl({ version, platform, arch }) {
	if (platform === "darwin" && arch === "x64") throw new Error("pnpm does not provide x64 macOS binaries for version 11 and above");
	return {
		baseUrl: `https://github.com/pnpm/pnpm/releases/download/v${version}`,
		filename: `pnpm-${platform}-${arch}`,
		ext: platform === "win32" ? ".zip" : ".tar.gz"
	};
}
//#endregion
//#region src/main.ts
try {
	const platform = getPlatform();
	const arch = getArch();
	let version = await getVersionInput();
	if (/^\d+\.\d+\.\d+/.test(version)) {
		logInfo(`Verify pnpm version ${version}`);
		const registry = await fetchNpmPackageRegistry("@pnpm/exe");
		verifyPnpmVersion(version, registry);
	} else {
		logInfo(`Resolve pnpm version from ${version}`);
		const registry = await fetchNpmPackageRegistry("@pnpm/exe");
		version = resolvePnpmVersion(version, registry);
		logInfo(`Use pnpm version ${version}`);
	}
	const majorVersion = getPnpmMajorVersion(version);
	const pnpmHome = getPnpmHome({
		version,
		platform,
		arch
	});
	await setEnv("PNPM_HOME", pnpmHome);
	try {
		await access(pnpmHome);
		logInfo("Use cached pnpm");
	} catch {
		if (majorVersion < 11) {
			const { baseUrl, filename, ext } = getPnpmDownloadUrl({
				version,
				platform,
				arch
			});
			const url = `${baseUrl}/${filename}${ext}`;
			logInfo("Create pnpm home");
			await mkdir(pnpmHome, { recursive: true });
			beginLogGroup("Download pnpm executable");
			const execFile = join(pnpmHome, `pnpm${ext}`);
			try {
				const args = [
					"-fL",
					"--output",
					execFile,
					url
				];
				logCommand("curl", ...args);
				await exec("curl", args);
			} finally {
				endLogGroup();
			}
			await makeExecutable(execFile, ext);
		} else {
			const { baseUrl, filename, ext } = getPnpm11DownloadUrl({
				version,
				platform,
				arch
			});
			const url = `${baseUrl}/${filename}${ext}`;
			logInfo("Create pnpm home");
			await mkdir(pnpmHome, { recursive: true });
			beginLogGroup("Download pnpm archive");
			const archiveFile = join(pnpmHome, filename);
			try {
				const args = [
					"-fL",
					"--output",
					archiveFile,
					url
				];
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
} catch (err) {
	logError(err);
	process.exitCode = 1;
}
//#endregion
export {};
