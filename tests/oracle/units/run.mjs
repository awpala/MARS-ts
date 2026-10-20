/** Java method-probe capture with the same headless/preferences isolation as run-legacy. */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	mkdtempSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));

function files(path) {
	return readdirSync(resolve(root, path), { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory() ? files(`${path}/${entry.name}`) : [`${path}/${entry.name}`]
	);
}

function checked(command, args, options = {}) {
	const result = spawnSync(command, args, {
		cwd: root,
		encoding: 'utf8',
		timeout: 60000,
		maxBuffer: 16 * 1024 * 1024,
		...options
	});
	if (result.error) throw result.error;
	if (result.signal || result.status !== 0)
		throw new Error(`${command} failed (${result.status ?? result.signal}): ${result.stderr}`);
	return result;
}

/** Compile an external probe against the already-built immutable oracle and capture exact streams/status. */
export function captureProbe({ source, className, golden, check = false, legacySources = [] }) {
	const temporary = mkdtempSync(join(tmpdir(), 'mars-unit-oracle-'));
	try {
		const javac = checked('javac', ['-version']).stdout.trim();
		const java = checked('java', ['-version']).stderr;
		if (!/^javac 21(?:\D|$)/.test(javac) || !/version "21(?:\D|$)/.test(java))
			throw new Error('Method probes require the pinned JDK 21 toolchain.');
		const inputs = [
			'Mars.java',
			...files('mars').filter((path) => path.endsWith('.java')),
			'PseudoOps.txt',
			'Config.properties',
			'Syscall.properties',
			'Settings.properties',
			'MARSlicense.txt',
			'MipsXRayOpcode.xml',
			'registerDatapath.xml',
			'controlDatapath.xml',
			'ALUcontrolDatapath.xml',
			...files('help'),
			...files('images')
		].sort();
		const jarTime = statSync(join(root, '__build/legacy/Mars.jar')).mtimeMs;
		for (const path of inputs)
			if (statSync(resolve(root, path)).mtimeMs > jarTime)
				throw new Error(`Oracle jar is older than ${path}; run build-legacy first.`);
		if (
			!/^javac=javac 21(?:\D|$)/m.test(
				readFileSync(join(root, '__build/legacy/BUILD_INFO'), 'utf8')
			)
		)
			throw new Error('Oracle jar was not built with JDK 21; run build-legacy first.');
		const sourceDigest = createHash('sha256');
		for (const path of inputs)
			sourceDigest
				.update(path + '\0')
				.update(readFileSync(resolve(root, path)))
				.update('\0');
		const classes = join(temporary, 'classes');
		const user = join(temporary, 'user');
		const system = join(temporary, 'system');
		mkdirSync(classes);
		mkdirSync(join(user, '.java', '.userPrefs'), { recursive: true });
		mkdirSync(join(system, '.systemPrefs'), { recursive: true });
		const jar = join(root, '__build/legacy/Mars.jar');
		checked('javac', ['-cp', jar, '-d', classes, resolve(root, source)], {
			cwd: root,
			encoding: 'utf8'
		});
		const command = [
			'-Djava.awt.headless=true',
			`-Djava.util.prefs.userRoot=${user}`,
			`-Djava.util.prefs.systemRoot=${system}`,
			'-cp',
			`${classes}:${jar}`,
			className
		];
		const execution = checked('java', command, {
			cwd: root,
			input: '',
			encoding: 'utf8',
			maxBuffer: 16 * 1024 * 1024
		});
		const hashes = Object.fromEntries(
			[source, ...legacySources].map((path) => [
				path,
				createHash('sha256')
					.update(readFileSync(resolve(root, path)))
					.digest('hex')
			])
		);
		const captured =
			JSON.stringify(
				{
					jdkMajor: 21,
					legacySourceSha256: sourceDigest.digest('hex'),
					command: [
						'java',
						'-Djava.awt.headless=true',
						'-Djava.util.prefs.userRoot=<fresh-user>',
						'-Djava.util.prefs.systemRoot=<fresh-system>',
						'-cp',
						'<probe-classes>:__build/legacy/Mars.jar',
						className
					],
					stdin: '',
					stdout: execution.stdout,
					stderr: execution.stderr,
					status: execution.status,
					hashes
				},
				null,
				2
			) + '\n';
		if (check) {
			if (readFileSync(resolve(root, golden), 'utf8') !== captured)
				throw new Error(`Oracle mismatch: ${golden}`);
			console.log(`PASS ${basename(source)} matches ${golden}`);
		} else {
			writeFileSync(resolve(root, golden), captured);
			console.log(`Captured ${golden}`);
		}
		return JSON.parse(captured);
	} finally {
		rmSync(temporary, { recursive: true, force: true });
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	captureProbe({
		source: 'tests/oracle/units/Probe.java',
		className: 'Probe',
		golden: 'tests/oracle/units/foundation.json',
		check: process.argv.includes('--check'),
		legacySources: [
			'mars/util/Binary.java',
			'mars/Globals.java',
			'Config.properties',
			'mars/assembler/DataTypes.java',
			'mars/mips/hardware/Register.java',
			'mars/mips/hardware/RegisterAccessNotice.java',
			'mars/mips/hardware/AccessNotice.java',
			'mars/mips/hardware/RegisterFile.java',
			'mars/mips/hardware/Coprocessor0.java',
			'mars/mips/hardware/Coprocessor1.java',
			'mars/mips/hardware/MemoryConfiguration.java',
			'mars/mips/hardware/MemoryConfigurations.java',
			'mars/mips/hardware/MemoryAccessNotice.java',
			'mars/mips/hardware/AddressErrorException.java',
			'mars/simulator/Exceptions.java'
		]
	});
}
