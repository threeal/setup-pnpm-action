import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { access, appendFile, chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { EOL } from "node:os";
import { basename, delimiter, dirname, join } from "node:path";
// node_modules/.pnpm/ghakit@1.0.0/node_modules/ghakit/dist/exec.js
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
// node_modules/.pnpm/ghakit@1.0.0/node_modules/ghakit/dist/log.js
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
// src/semver.ts
function parseVersion(version) {
	const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
	if (match === null) return void 0;
	return [
		Number(match[1]),
		Number(match[2]),
		Number(match[3])
	];
}
function compareVersions(a, b) {
	return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}
function parseRange(range) {
	const checks = [];
	for (const comparator of range.trim().split(/\s+/)) {
		const match = /^([<>]=?|[=~^])?(\d+)\.(\d+)\.(\d+)$/.exec(comparator);
		if (match === null) return void 0;
		const base = [
			Number(match[2]),
			Number(match[3]),
			Number(match[4])
		];
		const compare = (version) => compareVersions(version, base);
		switch (match[1]) {
			case "<":
				checks.push((version) => compare(version) < 0);
				break;
			case "<=":
				checks.push((version) => compare(version) <= 0);
				break;
			case ">":
				checks.push((version) => compare(version) > 0);
				break;
			case ">=":
				checks.push((version) => compare(version) >= 0);
				break;
			case "~": {
				const upper = [
					base[0],
					base[1] + 1,
					0
				];
				checks.push((version) => compare(version) >= 0 && compareVersions(version, upper) < 0);
				break;
			}
			case "^": {
				const upper = base[0] > 0 ? [
					base[0] + 1,
					0,
					0
				] : base[1] > 0 ? [
					0,
					base[1] + 1,
					0
				] : [
					0,
					0,
					base[2] + 1
				];
				checks.push((version) => compare(version) >= 0 && compareVersions(version, upper) < 0);
				break;
			}
			default: checks.push((version) => compare(version) === 0);
		}
	}
	return (version) => checks.every((check) => check(version));
}
function satisfies(version, range) {
	const parsed = parseVersion(version);
	const check = parseRange(range);
	if (parsed === void 0 || check === void 0) return false;
	return check(parsed);
}
function maxSatisfying(versions, range) {
	const satisfies = parseRange(range);
	if (satisfies === void 0) throw new Error(`Unsupported version range: ${range}`);
	let max;
	for (const version of versions) {
		const parsed = parseVersion(version);
		if (parsed === void 0 || !satisfies(parsed)) continue;
		if (max === void 0 || compareVersions(parsed, max.parsed) > 0) max = {
			version,
			parsed
		};
	}
	return max?.version;
}
// src/lockfile.ts
function extractVersionFromPnpmLock(content) {
	const lines = content.split(/\r?\n/);
	if (lines[0] !== "---") return void 0;
	const keys = [
		"importers:",
		".:",
		"packageManagerDependencies:",
		"'@pnpm/exe':"
	];
	let depth = 0;
	for (const line of lines.slice(1)) {
		if (line === "---") break;
		const key = line.trimStart();
		if (key === "") continue;
		const indent = line.length - key.length;
		if (indent < depth * 2) break;
		if (indent > depth * 2) continue;
		if (depth < keys.length) {
			if (key === keys[depth]) depth++;
			continue;
		}
		const match = /^version: (\d+\.\d+\.\d+)$/.exec(key);
		if (match !== null) return match[1];
	}
}
async function readLockedVersion(file, version) {
	const lockedVersion = extractVersionFromPnpmLock(await readFile(file, "utf-8"));
	if (lockedVersion === void 0 || !satisfies(lockedVersion, version)) return;
	return lockedVersion;
}
// src/json.ts
function isRecord(value) {
	return typeof value === "object" && value !== null;
}
// src/npm.ts
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
// src/pnpm.ts
function verifyPnpmVersion(version, pkg) {
	if (!Object.hasOwn(pkg.versions, version)) throw new Error(`Unknown pnpm version: ${version}`);
}
function resolvePnpmTag(tag, pkg) {
	const version = pkg["dist-tags"][tag];
	if (typeof version !== "string") throw new Error(`Unknown pnpm tag: ${tag}`);
	return version;
}
function resolvePnpmRange(range, pkg) {
	const version = maxSatisfying(Object.keys(pkg.versions), range);
	if (version === void 0) throw new Error(`No pnpm version satisfies range: ${range}`);
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
// src/version.ts
function extractVersionFromDevEngines(devEngines) {
	if (devEngines === void 0) return void 0;
	if (!isRecord(devEngines)) throw new Error(`Invalid \`devEngines\` type: ${typeof devEngines}`);
	const { packageManager } = devEngines;
	if (packageManager === void 0) return void 0;
	if (Array.isArray(packageManager)) throw new Error("Unsupported `devEngines.packageManager` array");
	if (!isRecord(packageManager)) throw new Error(`Invalid \`devEngines.packageManager\` type: ${typeof packageManager}`);
	const { name, version } = packageManager;
	if (name === void 0) return void 0;
	if (typeof name !== "string") throw new Error(`Invalid \`devEngines.packageManager.name\` type: ${typeof name}`);
	if (name !== "pnpm") throw new Error(`Unsupported package manager: ${name}, expected pnpm`);
	if (version === void 0) return "latest";
	if (typeof version !== "string") throw new Error(`Invalid \`devEngines.packageManager.version\` type: ${typeof version}`);
	const match = /^(\d+\.\d+\.\d+)(?:\+.*)?$/.exec(version);
	if (match !== null) return match[1];
	if (/^[<>=~^]/.test(version)) return version;
	throw new Error(`Invalid \`devEngines.packageManager.version\` value: ${version}`);
}
function extractVersionFromPackageManager(packageManager) {
	if (packageManager === void 0) return void 0;
	if (typeof packageManager !== "string") throw new Error(`Invalid \`packageManager\` type: ${typeof packageManager}`);
	const match = /^([^@]+)@(\d+\.\d+\.\d+)(?:\+.*)?$/.exec(packageManager);
	if (match === null) throw new Error(`Invalid \`packageManager\` value: ${packageManager}`);
	if (match[1] !== "pnpm") throw new Error(`Unsupported package manager: ${match[1]}, expected pnpm`);
	return match[2];
}
function extractVersionFromPackageJson(packageJson) {
	if (!isRecord(packageJson)) throw new Error("Invalid package.json");
	return extractVersionFromDevEngines(packageJson.devEngines) ?? extractVersionFromPackageManager(packageJson.packageManager);
}
async function readVersionFile(file) {
	const fileName = basename(file);
	if (fileName !== "package.json") throw new Error(`Unsupported version file: ${fileName}`);
	const content = await readFile(file, "utf-8");
	return extractVersionFromPackageJson(JSON.parse(content));
}
// src/main.ts
async function run(command, args) {
	logCommand(command, ...args);
	await exec(command, args);
}
try {
	const versionInput = getInput("version").trim();
	const versionFile = getInput("version-file").trim();
	if (versionInput !== "" && versionFile !== "") throw new Error("Cannot specify both `version` and `version-file` inputs");
	let version;
	let packageJsonFile;
	if (versionInput !== "") version = versionInput;
	else if (versionFile !== "") {
		logInfo(`Read pnpm version from ${versionFile}`);
		version = await readVersionFile(versionFile);
		if (version === void 0) throw new Error(`Missing \`devEngines.packageManager\` or \`packageManager\` field in ${versionFile}`);
		packageJsonFile = versionFile;
	} else if (existsSync("package.json")) {
		logInfo("No version specified, read pnpm version from package.json");
		try {
			version = await readVersionFile("package.json");
			packageJsonFile = "package.json";
			if (version === void 0) logInfo("No `devEngines.packageManager` or `packageManager` field in package.json, use latest");
		} catch (err) {
			logError(err);
			logInfo("Failed to read pnpm version from package.json, use latest");
		}
	} else logInfo("No version specified, use latest");
	version ??= "latest";
	let isVersionVerified = false;
	if (packageJsonFile !== void 0) {
		const lockfile = join(dirname(packageJsonFile), "pnpm-lock.yaml");
		if (existsSync(lockfile)) try {
			const lockedVersion = await readLockedVersion(lockfile, version);
			if (lockedVersion !== void 0) {
				version = lockedVersion;
				isVersionVerified = true;
				logInfo(`Use pnpm version ${version} locked in ${lockfile}`);
			}
		} catch (err) {
			logError(err);
			logInfo(`Failed to read pnpm version from ${lockfile}, ignore it`);
		}
	}
	if (!/^\d+\.\d+\.\d+/.test(version)) {
		if (/^[<>=~^]/.test(version)) {
			logInfo(`Resolve pnpm version range ${version} from npm registry`);
			const pkg = await fetchNpmPackage("@pnpm/exe");
			version = resolvePnpmRange(version, pkg);
		} else {
			logInfo(`Resolve pnpm tag ${version} from npm registry`);
			const pkg = await fetchNpmPackage("@pnpm/exe");
			version = resolvePnpmTag(version, pkg);
		}
		isVersionVerified = true;
		logInfo(`Use pnpm version ${version}`);
	}
	const { platform, arch } = process;
	const pnpmHome = join(getRunnerToolCache(), "pnpm", `${version}-${platform}-${arch}`);
	const completeMarker = join(pnpmHome, ".complete");
	try {
		await access(completeMarker);
		logInfo(`Use cached pnpm from ${pnpmHome}`);
	} catch {
		if (!isVersionVerified) {
			logInfo(`Verify pnpm version ${version} from npm registry`);
			const pkg = await fetchNpmPackage("@pnpm/exe");
			verifyPnpmVersion(version, pkg);
		}
		const asset = getPnpmAsset(version, platform, arch);
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
export {};
