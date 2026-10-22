import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { access, appendFile, chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { EOL } from "node:os";
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
//#endregion
//#region src/json.ts
function isRecord(value) {
	return typeof value === "object" && value !== null;
}
//#endregion
//#region src/npm.ts
function parseNpmPackage(data) {
	if (!isRecord(data) || !isRecord(data["dist-tags"]) || !isRecord(data.versions)) throw new Error("Invalid npm package metadata");
	return {
		"dist-tags": data["dist-tags"],
		versions: data.versions
	};
}
async function fetchNpmPackage(name) {
	const res = await fetch(`https://registry.npmjs.org/${name}`);
	if (!res.ok) throw new Error(`Failed to fetch ${name} from npm registry: ${res.statusText}`);
	return parseNpmPackage(await res.json());
}
//#endregion
//#region src/pnpm.ts
function verifyPnpmVersion(version, pkg) {
	if (!Object.hasOwn(pkg.versions, version)) throw new Error(`Unknown pnpm version: ${version}`);
}
function resolvePnpmTag(tag, pkg) {
	const version = pkg["dist-tags"][tag];
	if (typeof version !== "string") throw new Error(`Unknown pnpm tag: ${tag}`);
	return version;
}
const OS_NAMES = {
	linux: "linux",
	darwin: "macos",
	win32: "win"
};
function getPnpmAsset(version, platform, arch) {
	if (platform !== "linux" && platform !== "darwin" && platform !== "win32") throw new Error(`Unsupported platform: ${platform}`);
	if (arch !== "x64" && arch !== "arm64") throw new Error(`Unsupported arch: ${arch}`);
	const baseUrl = `https://github.com/pnpm/pnpm/releases/download/v${version}`;
	if (parseInt(version, 10) < 11) {
		const name = `pnpm-${OS_NAMES[platform]}-${arch}`;
		return platform === "win32" ? {
			type: "exe",
			url: `${baseUrl}/${name}.exe`,
			fileName: "pnpm.exe"
		} : {
			type: "binary",
			url: `${baseUrl}/${name}`,
			fileName: "pnpm"
		};
	}
	if (platform === "darwin" && arch === "x64") throw new Error("pnpm does not provide x64 macOS binaries for version 11 and above");
	const type = platform === "win32" ? "zip" : "tar.gz";
	const fileName = `pnpm-${platform}-${arch}.${type}`;
	return {
		type,
		url: `${baseUrl}/${fileName}`,
		fileName
	};
}
//#endregion
//#region src/version.ts
function extractVersionFromPackageJson(packageJson) {
	if (!isRecord(packageJson)) throw new Error("Invalid package.json");
	const { packageManager } = packageJson;
	if (packageManager === void 0) return void 0;
	if (typeof packageManager !== "string") throw new Error(`Invalid \`packageManager\` type: ${typeof packageManager}`);
	const match = /^([^@]+)@(\d+\.\d+\.\d+)(?:\+.*)?$/.exec(packageManager);
	if (match === null) throw new Error(`Invalid \`packageManager\` value: ${packageManager}`);
	if (match[1] !== "pnpm") throw new Error(`Unsupported package manager: ${match[1]}, expected pnpm`);
	return match[2];
}
async function readVersionFile(file) {
	const fileName = basename(file);
	if (fileName !== "package.json") throw new Error(`Unsupported version file: ${fileName}`);
	const content = await readFile(file, "utf-8");
	return extractVersionFromPackageJson(JSON.parse(content));
}
//#endregion
//#region src/main.ts
async function run(command, args) {
	logCommand(command, ...args);
	await exec(command, args);
}
try {
	const versionInput = getInput("version").trim();
	const versionFile = getInput("version-file").trim();
	if (versionInput !== "" && versionFile !== "") throw new Error("Cannot specify both `version` and `version-file` inputs");
	let spec;
	if (versionInput !== "") spec = versionInput;
	else if (versionFile !== "") {
		logInfo(`Read pnpm version from ${versionFile}`);
		spec = await readVersionFile(versionFile);
		if (spec === void 0) throw new Error(`Missing \`packageManager\` field in ${versionFile}`);
	} else if (existsSync("package.json")) {
		logInfo("No version specified, read pnpm version from package.json");
		try {
			spec = await readVersionFile("package.json");
			if (spec === void 0) logInfo("No `packageManager` field in package.json, use latest");
		} catch (err) {
			logError(err);
			logInfo("Failed to read pnpm version from package.json, use latest");
		}
	} else logInfo("No version specified, use latest");
	spec ??= "latest";
	let version;
	if (/^\d+\.\d+\.\d+/.test(spec)) {
		logInfo(`Verify pnpm version ${spec} from npm registry`);
		const pkg = await fetchNpmPackage("@pnpm/exe");
		verifyPnpmVersion(spec, pkg);
		version = spec;
	} else {
		logInfo(`Resolve pnpm tag ${spec} from npm registry`);
		const pkg = await fetchNpmPackage("@pnpm/exe");
		version = resolvePnpmTag(spec, pkg);
		logInfo(`Use pnpm version ${version}`);
	}
	const { platform, arch } = process;
	const asset = getPnpmAsset(version, platform, arch);
	const pnpmHome = join(getRunnerToolCache(), "pnpm", `${version}-${platform}-${arch}`);
	const completeMarker = join(pnpmHome, ".complete");
	try {
		await access(completeMarker);
		logInfo(`Use cached pnpm from ${pnpmHome}`);
	} catch {
		logInfo(`Install pnpm to ${pnpmHome}`);
		await rm(pnpmHome, {
			recursive: true,
			force: true
		});
		await mkdir(pnpmHome, { recursive: true });
		const file = join(pnpmHome, asset.fileName);
		await run("curl", [
			"-fsSL",
			"--output",
			file,
			asset.url
		]);
		switch (asset.type) {
			case "binary":
				await chmod(file, 493);
				break;
			case "exe": break;
			case "tar.gz":
				await run("tar", [
					"-xzf",
					file,
					"-C",
					pnpmHome
				]);
				await rm(file);
				break;
			case "zip":
				await run("unzip", [
					"-q",
					file,
					"-d",
					pnpmHome
				]);
				await rm(file);
		}
		await writeFile(completeMarker, "");
	}
	logInfo("Add pnpm to PATH");
	await setEnv("PNPM_HOME", pnpmHome);
	await addPath(pnpmHome);
	await setOutput("version", version);
} catch (err) {
	logError(err);
	process.exitCode = 1;
}
//#endregion
export {};
