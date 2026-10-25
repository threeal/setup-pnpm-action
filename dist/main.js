import { spawn } from "node:child_process";
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
// src/json.ts
function isRecord(value) {
	return typeof value === "object" && value !== null;
}
// src/fs.ts
function isNotFoundError(err) {
	return isRecord(err) && err.code === "ENOENT";
}
// src/lockfile.ts
function extractVersionFromPnpmLock(content) {
	const lines = content.split(/\r?\n/);
	if (lines[0] !== "---") return void 0;
	const keys = [
		"importers:",
		".:",
		"packageManagerDependencies:",
		"pnpm:"
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
const OS_NAMES = {
	linux: "linux",
	darwin: "macos",
	win32: "win"
};
async function findPnpmAsset(version, platform, arch) {
	if (platform !== "linux" && platform !== "darwin" && platform !== "win32") throw new Error(`Unsupported platform: ${platform}`);
	if (arch !== "x64" && arch !== "arm64") throw new Error(`Unsupported arch: ${arch}`);
	const baseUrl = `https://github.com/pnpm/pnpm/releases/download/v${version}`;
	let asset;
	if (parseInt(version, 10) < 11) {
		const name = `pnpm-${OS_NAMES[platform]}-${arch}`;
		asset = platform === "win32" ? {
			type: "exe",
			url: `${baseUrl}/${name}.exe`,
			fileName: "pnpm.exe"
		} : {
			type: "binary",
			url: `${baseUrl}/${name}`,
			fileName: "pnpm"
		};
	} else {
		const type = platform === "win32" ? "zip" : "tar.gz";
		const fileName = `pnpm-${platform}-${arch}.${type}`;
		asset = {
			type,
			url: `${baseUrl}/${fileName}`,
			fileName
		};
	}
	const res = await fetch(asset.url, { method: "HEAD" });
	if (res.status === 404) throw new Error(`pnpm does not provide a build of version ${version} for ${platform}/${arch}`);
	if (!res.ok) throw new Error(`Failed to find pnpm build at ${asset.url}: ${res.statusText}`);
	return asset;
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
function parsePartialVersion(version) {
	if (!/^v?(?:\d+|[xX*])(?:\.(?:\d+|[xX*])){0,2}$/.test(version)) return;
	const base = [
		0,
		0,
		0
	];
	let count = 0;
	for (const part of version.replace(/^v/, "").split(".")) {
		if (!/^\d+$/.test(part)) break;
		base[count] = Number(part);
		count++;
	}
	return {
		base,
		count
	};
}
function compareVersions(a, b) {
	return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}
function bumpVersion(version, index) {
	switch (index) {
		case 0: return [
			version[0] + 1,
			0,
			0
		];
		case 1: return [
			version[0],
			version[1] + 1,
			0
		];
		default: return [
			version[0],
			version[1],
			version[2] + 1
		];
	}
}
function atLeast(lower) {
	return (version) => compareVersions(version, lower) >= 0;
}
function below(upper) {
	return (version) => compareVersions(version, upper) < 0;
}
function createComparatorMatchers(comparator) {
	const operator = /^(?:<=?|>=?|~>?|\^|=)/.exec(comparator)?.[0] ?? "";
	const partial = parsePartialVersion(comparator.slice(operator.length));
	if (partial === void 0) return void 0;
	const { base, count } = partial;
	if (count === 0) return operator === "<" || operator === ">" ? [() => false] : [];
	const next = bumpVersion(base, count - 1);
	switch (operator) {
		case "<": return [below(base)];
		case "<=": return [below(next)];
		case ">": return [atLeast(next)];
		case ">=": return [atLeast(base)];
		case "~":
		case "~>": return [atLeast(base), below(bumpVersion(base, count === 1 ? 0 : 1))];
		case "^": {
			const index = base.slice(0, count).findIndex((number) => number > 0);
			return [atLeast(base), below(bumpVersion(base, index < 0 ? count - 1 : index))];
		}
		default: return [atLeast(base), below(next)];
	}
}
function createComparatorSetMatchers(set) {
	const trimmed = set.trim().replace(/([<>]=?|~>?|\^|=)\s+/g, "$1");
	if (trimmed === "") return void 0;
	const hyphen = /^(\S+)\s+-\s+(\S+)$/.exec(trimmed);
	if (hyphen !== null) {
		const lower = parsePartialVersion(hyphen[1]);
		const upper = parsePartialVersion(hyphen[2]);
		if (lower === void 0 || upper === void 0) return void 0;
		const matchers = [];
		if (lower.count > 0) matchers.push(atLeast(lower.base));
		if (upper.count > 0) matchers.push(below(bumpVersion(upper.base, upper.count - 1)));
		return matchers;
	}
	const matchers = [];
	for (const comparator of trimmed.split(/\s+/)) {
		const comparatorMatchers = createComparatorMatchers(comparator);
		if (comparatorMatchers === void 0) return void 0;
		matchers.push(...comparatorMatchers);
	}
	return matchers;
}
function createRangeMatcher(range) {
	const sets = [];
	for (const set of range.split("||")) {
		const matchers = createComparatorSetMatchers(set);
		if (matchers === void 0) return void 0;
		sets.push(matchers);
	}
	return (version) => sets.some((matchers) => matchers.every((matcher) => matcher(version)));
}
function satisfies(version, range) {
	const parsed = parseVersion(version);
	const matcher = createRangeMatcher(range);
	if (parsed === void 0 || matcher === void 0) return false;
	return matcher(parsed);
}
function maxMatching(versions, matcher) {
	let max;
	for (const version of versions) {
		const parsed = parseVersion(version);
		if (parsed === void 0 || !matcher(parsed)) continue;
		if (max === void 0 || compareVersions(parsed, max.parsed) > 0) max = {
			version,
			parsed
		};
	}
	return max?.version;
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
	const key = "devEngines.packageManager";
	if (version === void 0) return { key };
	if (typeof version !== "string") throw new Error(`Invalid \`devEngines.packageManager.version\` type: ${typeof version}`);
	const match = /^(\d+\.\d+\.\d+)(?:\+.*)?$/.exec(version);
	if (match !== null) return {
		key,
		version: match[1]
	};
	if (createRangeMatcher(version) !== void 0) return {
		key,
		version
	};
	throw new Error(`Invalid \`devEngines.packageManager.version\` value: ${version}`);
}
function extractVersionFromPackageManager(packageManager) {
	if (packageManager === void 0) return void 0;
	if (typeof packageManager !== "string") throw new Error(`Invalid \`packageManager\` type: ${typeof packageManager}`);
	const match = /^([^@]+)@(\d+\.\d+\.\d+)(?:\+.*)?$/.exec(packageManager);
	if (match === null) throw new Error(`Invalid \`packageManager\` value: ${packageManager}`);
	if (match[1] !== "pnpm") throw new Error(`Unsupported package manager: ${match[1]}, expected pnpm`);
	return {
		key: "packageManager",
		version: match[2]
	};
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
	let version = getInput("version").trim();
	let versionFile = getInput("version-file").trim();
	if (version !== "" && versionFile !== "") throw new Error("Cannot specify both `version` and `version-file` inputs");
	let isVersionVerified = false;
	if (version === "") {
		let versionField;
		if (versionFile !== "") {
			logInfo(`Read pnpm version from ${versionFile}`);
			versionField = await readVersionFile(versionFile);
			if (versionField === void 0) throw new Error(`Missing \`devEngines.packageManager\` or \`packageManager\` field in ${versionFile}`);
		} else {
			versionFile = "package.json";
			logInfo(`No version specified, read pnpm version from ${versionFile}`);
			try {
				versionField = await readVersionFile(versionFile);
				if (versionField === void 0) {
					logInfo(`No \`devEngines.packageManager\` or \`packageManager\` field in ${versionFile}, use latest`);
					version = "latest";
				}
			} catch (err) {
				if (isNotFoundError(err)) {
					logInfo(`No ${versionFile} found, use latest`);
					version = "latest";
				} else {
					logError(err);
					logInfo(`Failed to read pnpm version from ${versionFile}, use latest`);
					version = "latest";
				}
			}
		}
		if (versionField !== void 0) {
			if (versionField.version === void 0) {
				logInfo(`No version in the \`${versionField.key}\` field of ${versionFile}, use latest`);
				version = "latest";
			} else {
				logInfo(`Found pnpm version ${versionField.version} in the \`${versionField.key}\` field of ${versionFile}`);
				version = versionField.version;
				const lockfile = join(dirname(versionFile), "pnpm-lock.yaml");
				logInfo(`Read pnpm version from ${lockfile}`);
				try {
					const lockedVersion = extractVersionFromPnpmLock(await readFile(lockfile, "utf-8"));
					if (lockedVersion === void 0) logInfo(`No pnpm version in ${lockfile}, ignore it`);
					else if (!satisfies(lockedVersion, version)) logInfo(`Found pnpm version ${lockedVersion} in ${lockfile}, which doesn't satisfy ${version}, ignore it`);
					else {
						logInfo(`Found pnpm version ${lockedVersion} in ${lockfile}`);
						version = lockedVersion;
						isVersionVerified = true;
					}
				} catch (err) {
					if (isNotFoundError(err)) logInfo(`No ${lockfile} found, ignore it`);
					else {
						logError(err);
						logInfo(`Failed to read pnpm version from ${lockfile}, ignore it`);
					}
				}
			}
		}
	}
	if (!/^\d+\.\d+\.\d+(?:-\S+)?$/.test(version)) {
		logInfo(`Resolve pnpm ${version} from npm registry`);
		const pkg = await fetchNpmPackage("pnpm");
		const taggedVersion = pkg["dist-tags"][version];
		if (typeof taggedVersion === "string") {
			logInfo(`Found pnpm version ${taggedVersion} tagged ${version}`);
			version = taggedVersion;
		} else {
			const matcher = createRangeMatcher(version);
			if (matcher === void 0) throw new Error(`Unknown pnpm version range or tag: ${version}`);
			const matchingVersion = maxMatching(Object.keys(pkg.versions), matcher);
			if (matchingVersion === void 0) throw new Error(`No pnpm version satisfies ${version}`);
			logInfo(`Found pnpm version ${matchingVersion} satisfying ${version}`);
			version = matchingVersion;
		}
		isVersionVerified = true;
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
			const pkg = await fetchNpmPackage("pnpm");
			verifyPnpmVersion(version, pkg);
		}
		logInfo(`Find pnpm build for ${platform}/${arch} in GitHub releases`);
		const asset = await findPnpmAsset(version, platform, arch);
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
