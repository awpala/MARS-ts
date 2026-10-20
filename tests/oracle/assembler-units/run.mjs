#!/usr/bin/env node
/** Regenerate or check foundational assembler and delayed-branch Java observations. */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../../..');
const mode = process.argv[2];
if (
	!['--update', '--check'].includes(mode) ||
	process.argv.slice(3).some((arg) => arg !== '--reuse-build')
) {
	throw new Error(
		'Usage: node tests/oracle/assembler-units/run.mjs --update|--check [--reuse-build]'
	);
}
function run(command, args, options = {}) {
	const result = spawnSync(command, args, {
		cwd: root,
		encoding: 'utf8',
		timeout: 120_000,
		...options
	});
	if (result.error || result.status !== 0) {
		throw (
			result.error ??
			new Error(`${command} exited ${result.status}: ${result.stdout}\n${result.stderr}`)
		);
	}
	return result;
}
if (!process.argv.includes('--reuse-build'))
	run(join(root, '.devcontainer/scripts/bin/build-legacy.sh'), []);
const build = join(root, '__build/assembler-probe');
mkdirSync(build, { recursive: true });
const jar = join(root, '__build/legacy/Mars.jar');
const probe = join(directory, 'AssemblerProbe.java');
run('javac', ['-encoding', 'UTF-8', '-cp', jar, '-d', build, probe]);
const preferences = mkdtempSync(join(tmpdir(), 'mars-assembler-probe-'));
try {
	mkdirSync(join(preferences, 'user/.java/.userPrefs'), { recursive: true });
	mkdirSync(join(preferences, 'system/.systemPrefs'), { recursive: true });
	const args = [
		'-Djava.awt.headless=true',
		`-Djava.util.prefs.userRoot=${preferences}/user`,
		`-Djava.util.prefs.systemRoot=${preferences}/system`,
		'-cp',
		`${build}:${jar}`,
		'mars.simulator.AssemblerProbe'
	];
	const result = run('java', args);
	const sources = [
		'mars/assembler/Directives.java',
		'mars/assembler/Symbol.java',
		'mars/simulator/DelayedBranch.java',
		'mars/assembler/TokenTypes.java',
		'mars/assembler/Macro.java',
		'mars/assembler/MacroPool.java',
		'mars/assembler/DataTypes.java',
		'mars/mips/hardware/RegisterFile.java',
		'mars/mips/hardware/Coprocessor0.java',
		'mars/mips/hardware/Coprocessor1.java',
		'mars/mips/instructions/InstructionSet.java',
		'PseudoOps.txt',
		'mars/assembler/SourceLine.java',
		'mars/assembler/Token.java',
		'mars/assembler/TokenList.java',
		'mars/assembler/SymbolTable.java',
		'mars/ErrorMessage.java',
		'mars/ErrorList.java',
		'mars/util/Binary.java',
		'tests/oracle/assembler-units/AssemblerProbe.java'
	];
	const javaVersion = run('java', ['-version']).stderr;
	if (!/version "21[."]/.test(javaVersion)) throw new Error('Oracle requires JDK 21');
	const fixture =
		JSON.stringify(
			{
				command:
					'java -Djava.awt.headless=true -Djava.util.prefs.userRoot=<isolated>/user -Djava.util.prefs.systemRoot=<isolated>/system -cp __build/assembler-probe:__build/legacy/Mars.jar mars.simulator.AssemblerProbe',
				stdin: '',
				javaVersion,
				sources: Object.fromEntries(
					sources.map((path) => [
						path,
						createHash('sha256')
							// Keep stable fixture identifiers while resolving relocated Java sources.
							.update(
								readFileSync(join(root, path.startsWith('tests/') ? path : `_legacy-app/${path}`))
							)
							.digest('hex')
					])
				),
				stdout: result.stdout,
				stderr: result.stderr,
				exitCode: result.status
			},
			null,
			2
		) + '\n';
	const path = join(directory, 'golden.json');
	if (mode === '--update') writeFileSync(path, fixture);
	else {
		const expected = JSON.parse(readFileSync(path, 'utf8'));
		const actual = JSON.parse(fixture);
		// Record toolchain provenance while allowing JDK 21 vendors and patch updates.
		if (!/version "21[."]/.test(expected.javaVersion)) throw new Error('Fixture requires JDK 21');
		delete expected.javaVersion;
		delete actual.javaVersion;
		if (JSON.stringify(expected) !== JSON.stringify(actual))
			throw new Error('Assembler unit oracle fixture mismatch');
	}
	process.stdout.write(`Assembler unit oracle ${mode === '--update' ? 'captured' : 'verified'}\n`);
} finally {
	rmSync(preferences, { recursive: true, force: true });
}
