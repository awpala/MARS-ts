import { Globals } from '#lib/engine/Globals.js';
import { Settings } from '#lib/engine/Settings.js';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ProgramStatement } from '#lib/engine/assembler/ProgramStatement.js';
import { SymbolTable } from '#lib/engine/assembler/SymbolTable.js';
import { ErrorList } from '#lib/engine/diagnostics/ErrorList.js';
import { ProcessingException } from '#lib/engine/diagnostics/ProcessingException.js';
import { AddressErrorException } from '#lib/engine/hardware/AddressErrorException.js';
interface StatementRecord {
	address: number;
	binary: number;
	basic: string | null;
	printable: string;
	machine: string | null;
	source: string;
	file: string | null;
	line: number;
	operands: number[] | null;
}
interface SymbolRecord {
	name: string;
	address: number;
	data: boolean;
}
interface ErrorRecord {
	file: string | null;
	line: number;
	column: number;
	message: string;
	warning: boolean;
	history: string;
}
interface Case {
	id: string;
	config: string;
	delayed: boolean;
	bare: boolean;
	extended: boolean;
	warnings: boolean;
	hex: boolean;
	sources: { name: string; text: string }[];
	failure: string | null;
	result: StatementRecord[] | null;
	errors: ErrorRecord[] | null;
	parsed: (StatementRecord[] | null)[];
	locals: (SymbolRecord[] | null)[];
	globals: SymbolRecord[];
	memory: [number, number | null][];
}
const captured = JSON.parse(
	readFileSync(new URL('./oracle/assembler-programs/golden.json', import.meta.url), 'utf8')
) as { stdout: string; stderr: string; status: number };
const rows = captured.stdout
	.trimEnd()
	.split('\n')
	.map((line) => JSON.parse(line) as Case);
function statements(list: ProgramStatement[] | null): StatementRecord[] | null {
	return (
		list?.map((s) => ({
			address: s.getAddress(),
			binary: s.getBinaryStatement(),
			basic: s.getBasicAssemblyStatement(),
			printable: s.getPrintableBasicAssemblyStatement(),
			machine: s.getMachineStatement(),
			source: s.getSource(),
			file: s.getSourceFile(),
			line: s.getSourceLine(),
			operands: s.getOperands()
		})) ?? null
	);
}
function symbols(table: SymbolTable | null): SymbolRecord[] | null {
	return (
		table
			?.getAllSymbols()
			.map((s) => ({ name: s.getName(), address: s.getAddress(), data: s.getType() })) ?? null
	);
}
function errors(list: ErrorList | null): ErrorRecord[] | null {
	return (
		list?.getErrorMessages().map((e) => ({
			file: e.getFilename(),
			line: e.getLine(),
			column: e.getPosition(),
			message: e.getMessage(),
			warning: e.isWarning(),
			history: e.getMacroExpansionHistory()
		})) ?? null
	);
}
function machine() {
	let current: Case;
	let resets = 0;
	const globals = new Globals({
		readSource: (name) =>
			current.sources.find((source) => source.name === name)?.text ?? readFileSync(name, 'utf8'),
		sourcePaths: {
			separator: '/',
			isAbsolute: (name) => name.startsWith('/'),
			getParent: (name) => (name.includes('/') ? name.slice(0, name.lastIndexOf('/')) : null)
		},
		readInput: () => {
			throw new Error('Assembler fixtures must not request input');
		},
		printString: (message) => {
			throw new Error(message);
		},
		yieldControl: async () => {},
		resetFiles: () => {
			resets++;
		}
	});
	return {
		globals,
		memory: globals.memory,
		symbolTable: globals.symbolTable,
		resets: () => resets,
		select: (row: Case) => {
			current = row;
			const settings = globals.getSettings();
			for (const [id, value] of [
				[Settings.DELAYED_BRANCHING_ENABLED, row.delayed],
				[Settings.BARE_MACHINE_ENABLED, row.bare],
				[Settings.DISPLAY_ADDRESSES_IN_HEX, row.hex],
				[Settings.DISPLAY_VALUES_IN_HEX, row.hex]
			] as const)
				settings.setBooleanSettingNonPersistent(id, value);
			globals.memoryConfigurations.setCurrentConfiguration(
				globals.memoryConfigurations.getConfigurationByName(row.config)
			);
			globals.memory.clear();
			globals.symbolTable.clear();
		}
	};
}
describe('complete Assembler Java oracle', () => {
	it('captures successful Java execution', () => {
		expect(captured.status).toBe(0);
		expect(captured.stderr).toBe('');
		expect(rows.length).toBeGreaterThan(600);
	});
	it('matches source/encoding, diagnostics, macros, symbols and data for all catalog and directive cases', () => {
		const session = machine();
		for (const row of rows) {
			session.select(row);
			const programs = row.sources.map((source) => {
				const program = session.globals.createProgram();
				program.readSource(source.name);
				return program;
			});
			const assembler = session.globals.createAssembler();
			let result: ProgramStatement[] | null = null,
				list: ErrorList | null,
				failure: string | null = null;
			try {
				for (const program of programs) program.tokenize();
				result = assembler.assemble(programs, row.extended, row.warnings);
				list = assembler.getErrorList();
			} catch (error) {
				if (error instanceof ProcessingException) {
					failure = error.name;
					list = error.errors();
				} else {
					failure =
						error instanceof TypeError
							? 'NullPointerException'
							: error instanceof RangeError
								? 'IndexOutOfBoundsException'
								: (error as Error).name;
					list = assembler.getErrorList();
				}
			}
			const actual = {
				failure,
				result: statements(result),
				errors: errors(list),
				parsed: programs.map((program) => statements(program.getParsedList())),
				locals: programs.map((program) => symbols(program.getLocalSymbolTable())),
				globals: symbols(session.symbolTable),
				memory: row.memory.map(([address]) => {
					try {
						return [address, session.memory.getByte(address)];
					} catch (error) {
						if (!(error instanceof AddressErrorException)) throw error;
						return [address, null];
					}
				})
			};
			expect(actual, row.id + ' ' + row.sources.map((source) => source.text).join('\n')).toEqual({
				failure: row.failure,
				result: row.result,
				errors: row.errors,
				parsed: row.parsed,
				locals: row.locals,
				globals: row.globals,
				memory: row.memory
			});
		}
	}, 30000);
	it('retains diagnostics on null/empty assembly and does not reset files before code generation', () => {
		const session = machine();
		session.select(rows[0]);
		const assembler = session.globals.createAssembler();
		expect(assembler.getErrorList()).toBeNull();
		expect(assembler.assemble(null, true)).toBeNull();
		expect(assembler.assemble([], true)).toBeNull();
		expect(session.resets()).toBe(0);
		const program = session.globals.createProgram();
		program.readSource(rows[0].sources[0].name);
		program.tokenize();
		expect(assembler.assemble(program, true)).toEqual([]);
		const errors = assembler.getErrorList();
		expect(session.resets()).toBe(1);
		assembler.assemble([], false);
		expect(assembler.getErrorList()).toBe(errors);
	});
});
