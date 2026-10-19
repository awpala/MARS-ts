import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import golden from '../../../../tests/oracle/program-units/golden.json';
import { MIPSprogram, type MIPSprogramHost, type ProgramAssembler } from './MIPSprogram.js';
import { ProgramStatement } from './ProgramStatement.js';
import { SourceLine } from './SourceLine.js';
import { SymbolTable } from './SymbolTable.js';
import { Tokenizer } from './Tokenizer.js';
import { Coprocessor0 } from '../hardware/Coprocessor0.js';
import { Coprocessor1 } from '../hardware/Coprocessor1.js';
import { RegisterFile } from '../hardware/RegisterFile.js';
import { Memory } from '../hardware/Memory.js';
import { InstructionSet } from '../instructions/InstructionSet.js';
import { BackStepper } from '../simulator/BackStepper.js';
import { DelayedBranch } from '../simulator/DelayedBranch.js';
import { Exceptions } from '../simulator/Exceptions.js';
import { ErrorList } from '../diagnostics/ErrorList.js';
import { ProcessingException } from '../diagnostics/ProcessingException.js';

interface Snapshot {
	filename: string | null;
	source: string[] | null;
	mapping: [string, string | null, number, boolean][] | null;
	tokens: [string, string, number, number][][] | null;
	parsed: number | null;
	machine: [number, number][] | null;
	tokenizer: boolean;
	symbols: boolean;
	macro: boolean;
	backstep: boolean;
	enabled: boolean;
	stepped: boolean;
}
type Row =
	| { kind: 'state'; key: string; state: Snapshot }
	| { kind: 'error'; key: string; state: Snapshot; errors: string }
	| { kind: 'lines'; key: string; lines: (string | null)[] }
	| {
			kind: 'prepare';
			case: number;
			handler: boolean;
			files: string[];
			programs: { own: boolean; state: Snapshot }[];
			lead: Snapshot;
	  };
const rows = golden.stdout
	.trimEnd()
	.split('\n')
	.map((line) => JSON.parse(line) as Row);
const base = 'tests/oracle/program-units/sources/';
function snapshot(program: MIPSprogram): Snapshot {
	return {
		filename: program.getFilename(),
		source: program.getSourceList(),
		mapping:
			program
				.getSourceLineList()
				?.map((line) => [
					line.getSource(),
					line.getFilename(),
					line.getLineNumber(),
					line.getMIPSprogram() === program
				]) ?? null,
		tokens:
			program.getTokenList()?.map((line) =>
				Array.from({ length: line.size() }, (_, i) => {
					const t = line.get(i);
					return [t.getType().toString(), t.getValue(), t.getSourceLine(), t.getStartPos()];
				})
			) ?? null,
		parsed: program.getParsedList()?.length ?? null,
		machine:
			program
				.getMachineList()
				?.map((statement) => [statement.getAddress(), statement.getBinaryStatement()]) ?? null,
		tokenizer: program.getTokenizer() !== null,
		symbols: program.getLocalSymbolTable() !== null,
		macro: program.getLocalMacroPool() !== null,
		backstep: program.getBackStepper() !== null,
		enabled: program.backSteppingEnabled(),
		stepped: program.inSteppedExecution()
	};
}
function machine() {
	const registerFile = new RegisterFile(),
		coprocessor0 = new Coprocessor0(),
		coprocessor1 = new Coprocessor1(),
		delayedBranch = new DelayedBranch();
	const exceptions = new Exceptions(coprocessor0, registerFile);
	const statementHost = {
		findByBinaryCode: (word: number) => instructionSet.findByBinaryCode(word),
		matchOperator: (name: string) => instructionSet.matchOperator(name),
		registerFile,
		coprocessor1,
		getDisplayAddressesInHex: () => true,
		getDisplayValuesInHex: () => true
	};
	const memory: Memory<ProgramStatement> = new Memory({
		decodeStatement: (word, address) => new ProgramStatement(word, address, statementHost)
	});
	const classification = {
		registerFile,
		coprocessor0,
		coprocessor1,
		instructionSet: { matchOperator: (name: string) => instructionSet.matchOperator(name) }
	};
	const instructionSet: InstructionSet = new InstructionSet({
		registerFile,
		coprocessor0,
		coprocessor1,
		delayedBranch,
		memory,
		exceptionHost: {
			getProgramCounter: () => registerFile.getProgramCounter(),
			setRegisters: (cause, address) => exceptions.setRegisters(cause, address)
		},
		getDelayedBranchingEnabled: () => false,
		findSyscall: () => null,
		tokenizeExampleInstruction: (example) =>
			new Tokenizer(classification).tokenizeExampleInstruction(example),
		write: (text) => {
			throw new Error(text);
		}
	});
	instructionSet.populate();
	const host: MIPSprogramHost = {
		readSource: (filename) => {
			try {
				return readFileSync(filename, 'utf8');
			} catch {
				throw new Error(`java.io.FileNotFoundException: ${filename} (No such file or directory)`);
			}
		},
		describeReadError: (error) => (error as Error).message,
		sourcePaths: {
			separator: '/',
			isAbsolute: (filename) => filename.startsWith('/'),
			getParent: (filename) =>
				filename.includes('/') ? filename.substring(0, filename.lastIndexOf('/')) : null
		},
		classification,
		globalSymbolTable: new SymbolTable('global', null),
		createAssembler: () => {
			throw new Error('This lifecycle test does not substitute an assembler');
		},
		createBackStepper: () =>
			new BackStepper({
				memory,
				registerFile,
				coprocessor0,
				coprocessor1,
				inDelaySlot: () => false,
				fatal: (text) => {
					throw new Error(text);
				}
			}),
		registerFile,
		simulator: {
			simulate: () => {
				throw new Error('This lifecycle test does not substitute instruction execution');
			}
		}
	};
	return { host, registerFile, statementHost };
}
function checkState(key: string, program: MIPSprogram) {
	const row = rows.find((row) => row.kind === 'state' && row.key === key);
	if (!row || row.kind !== 'state') throw new Error(key);
	expect(snapshot(program), key).toEqual(row.state);
}
function checkError(key: string, program: MIPSprogram, action: () => void) {
	const row = rows.find((row) => row.kind === 'error' && row.key === key);
	if (!row || row.kind !== 'error') throw new Error(key);
	try {
		action();
		throw new Error('Expected ProcessingException');
	} catch (error) {
		expect(error).toBeInstanceOf(ProcessingException);
		expect((error as ProcessingException).errors()!.generateErrorReport()).toBe(row.errors);
	}
	expect(snapshot(program), key).toEqual(row.state);
}
describe('MIPSprogram Java lifecycle', () => {
	it('preserves fresh state, readLine boundaries, source mapping, includes and real tokenization', () => {
		const { host } = machine();
		checkState('fresh', new MIPSprogram(host));
		for (const file of [
			'empty.txt',
			'blank.txt',
			'mixed.txt',
			'unicode.txt',
			'lead.asm',
			'include.asm'
		]) {
			const program = new MIPSprogram(host);
			program.readSource(base + file);
			checkState('read:' + file, program);
			const row = rows.find((row) => row.kind === 'lines' && row.key === file);
			if (!row || row.kind !== 'lines') throw new Error(file);
			expect(
				Array.from({ length: program.getSourceList()!.length + 4 }, (_, i) =>
					program.getSourceLine(i - 1)
				)
			).toEqual(row.lines);
			if (file.endsWith('.asm')) {
				program.tokenize();
				checkState('tokenize:' + file, program);
			}
		}
	});
	it('retains documented mutable aliases and stale state on read/tokenization failure', () => {
		const { host, statementHost } = machine();
		let program = new MIPSprogram(host);
		program.readSource(base + 'lead.asm');
		program.tokenize();
		const mapping = [new SourceLine('replacement', program, 9)];
		program.setSourceLineList(mapping);
		mapping.push(new SourceLine('later', program, 10));
		checkState('mapping-alias', program);
		program.getSourceList()!.push('direct source edit');
		checkState('source-alias', program);
		program.createParsedList().push(new ProgramStatement(0, 0, statementHost));
		checkState('parsed-alias', program);
		program.createParsedList();
		checkState('parsed-replace', program);
		const pool = program.createMacroPool();
		checkState('macro-created', program);
		program.setLocalMacroPool(null);
		checkState('macro-cleared', program);
		program.setLocalMacroPool(pool);
		checkState('macro-restored', program);
		checkError('read-failure-retains-other-state', program, () =>
			program.readSource(base + 'missing.asm')
		);
		program = new MIPSprogram(host);
		program.readSource(base + 'lead.asm');
		program.tokenize();
		program.readSource(base + 'bad.asm');
		checkError('tokenize-failure-retains-old-tokens-symbols', program, () => program.tokenize());
	});
	it('prepares only requested files, retaining lead identity, duplicates and handler list mutation', () => {
		const { host } = machine();
		const cases = [
			['other.asm', 'lead.asm'],
			['lead.asm', 'other.asm'],
			['other.asm'],
			['lead.asm', 'lead.asm'],
			[]
		];
		for (const row of rows)
			if (row.kind === 'prepare') {
				const program = new MIPSprogram(host);
				const files = cases[row.case].map((file) => base + file);
				const programs = program.prepareFilesForAssembly(
					files,
					base + 'lead.asm',
					row.handler ? base + 'handler.asm' : null
				);
				expect(files).toEqual(row.files);
				expect(programs.map((p) => ({ own: p === program, state: snapshot(p) }))).toEqual(
					row.programs
				);
				expect(snapshot(program)).toEqual(row.lead);
			}
	});
	it('delegates assembly and asynchronous simulation without inventing machine behavior', async () => {
		const { host, registerFile, statementHost } = machine();
		const program = new MIPSprogram(host),
			warnings = new ErrorList(),
			statements = [new ProgramStatement(0, 0x00400000, statementHost)];
		const assembler: ProgramAssembler = {
			assemble: vi.fn(() => statements),
			getErrorList: () => warnings
		};
		host.createAssembler = vi.fn(() => assembler);
		const createBackStepper = vi.spyOn(host, 'createBackStepper');
		expect(program.assemble([program], true)).toBe(warnings);
		expect(assembler.assemble).toHaveBeenCalledWith([program], true, false);
		expect(program.getMachineList()).toBe(statements);
		expect(program.backSteppingEnabled()).toBe(true);
		expect(createBackStepper).toHaveBeenCalledTimes(1);
		program.getBackStepper()!.setEnabled(false);
		expect(program.backSteppingEnabled()).toBe(false);
		assembler.assemble = () => {
			throw new ProcessingException(warnings);
		};
		expect(() => program.assemble([program], false, true)).toThrow(ProcessingException);
		expect(program.getBackStepper()).toBeNull();
		expect(program.getMachineList()).toBe(statements);
		expect(createBackStepper).toHaveBeenCalledTimes(1);
		registerFile.setProgramCounter(0x00400010);
		const simulate = vi.fn(async () => false);
		host.simulator = { simulate };
		const action = { name: 'Step' };
		expect(await program.simulateStepAtPC(action)).toBe(false);
		expect(program.inSteppedExecution()).toBe(true);
		expect(simulate).toHaveBeenLastCalledWith(program, 0x00400010, 1, null, action);
		const breakpoints = [0x00400020];
		expect(await program.simulate(breakpoints)).toBe(false);
		expect(program.inSteppedExecution()).toBe(false);
		expect(simulate).toHaveBeenLastCalledWith(program, 0x00400010, -1, breakpoints, null);
		await program.simulate(42);
		expect(simulate).toHaveBeenLastCalledWith(program, 0x00400010, 42, null, null);
		host.simulator = {
			simulate: async () => {
				throw new ProcessingException(warnings);
			}
		};
		await expect(program.simulateStepAtPC(null)).rejects.toBeInstanceOf(ProcessingException);
		expect(program.inSteppedExecution()).toBe(true);
	});
});
