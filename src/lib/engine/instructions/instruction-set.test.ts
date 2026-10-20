import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ProgramStatement } from '../assembler/ProgramStatement.js';
import { TokenList } from '../assembler/TokenList.js';
import { Tokenizer } from '../assembler/Tokenizer.js';
import { Coprocessor0 } from '../hardware/Coprocessor0.js';
import { Coprocessor1 } from '../hardware/Coprocessor1.js';
import { RegisterFile } from '../hardware/RegisterFile.js';
import { Memory } from '../hardware/Memory.js';
import { DelayedBranch } from '../simulator/DelayedBranch.js';
import { Exceptions } from '../simulator/Exceptions.js';
import { ProcessingException } from '../diagnostics/ProcessingException.js';
import { BasicInstruction } from './BasicInstruction.js';
import { ExtendedInstruction } from './ExtendedInstruction.js';
import { InstructionSet } from './InstructionSet.js';
import pseudoOperations from './pseudo-operations.json';

const fixture = JSON.parse(readFileSync('tests/oracle/instruction-set/golden.json', 'utf8')) as {
	stdout: string;
	stderr: string;
	status: number;
};
const rows = fixture.stdout
	.replace(/\n$/, '')
	.split('\n')
	.map((row) => row.split('\t'));
const decode = (value: string) => Buffer.from(value, 'base64').toString('utf8');
const values = [
	0, -1, 2147483647, -2147483648, 1, -2, 0x3fc00000, 0x7fc12345, 0x7f800000, 0xff800000, 0x80000000,
	0x40240000, 0x40160000, 0xc0160000, 0x4f000000, 0xcf000001
].map((value) => value | 0);

function machine() {
	const registerFile = new RegisterFile(),
		coprocessor0 = new Coprocessor0(),
		coprocessor1 = new Coprocessor1(),
		delayedBranch = new DelayedBranch();
	const exceptions = new Exceptions(coprocessor0, registerFile);
	let delayed = false;
	const output: string[] = [];
	const statementHost = {
		findByBinaryCode: (word: number) => set.findByBinaryCode(word),
		matchOperator: (name: string) => set.matchOperator(name),
		registerFile,
		coprocessor1,
		getDisplayAddressesInHex: () => true,
		getDisplayValuesInHex: () => true
	};
	const memory: Memory<ProgramStatement> = new Memory({
		decodeStatement: (word, address) => new ProgramStatement(word, address, statementHost)
	});
	const context = {
		registerFile,
		coprocessor0,
		coprocessor1,
		instructionSet: { matchOperator: (name: string) => set.matchOperator(name) }
	};
	const set: InstructionSet = new InstructionSet({
		registerFile,
		coprocessor0,
		coprocessor1,
		memory,
		delayedBranch,
		exceptionHost: {
			getProgramCounter: () => registerFile.getProgramCounter(),
			setRegisters: (cause, address) => exceptions.setRegisters(cause, address)
		},
		getDelayedBranchingEnabled: () => delayed,
		findSyscall: () => null,
		tokenizeExampleInstruction: (example) =>
			new Tokenizer(context).tokenizeExampleInstruction(example),
		write: (text) => output.push(text)
	});
	set.populate();
	return {
		registerFile,
		coprocessor0,
		coprocessor1,
		delayedBranch,
		memory,
		set,
		statementHost,
		output,
		setDelayed: (value: boolean) => {
			delayed = value;
		}
	};
}

describe('complete canonical instruction set', () => {
	it('contains all155 basic definitions and every unchanged pseudo specification', () => {
		const m = machine();
		expect(m.output).toEqual([]);
		expect(pseudoOperations).toBe(readFileSync('_legacy-app/PseudoOps.txt', 'utf8'));
		const metadata = JSON.parse(
			readFileSync('tests/oracle/instruction-units/golden.json', 'utf8')
		) as { stdout: string };
		const basic = m.set
			.getInstructionList()
			.filter((instruction) => instruction instanceof BasicInstruction);
		for (const [i, row] of metadata.stdout
			.trimEnd()
			.split('\n')
			.slice(0, -1)
			.map((row) => row.split('\t'))
			.entries()) {
			const instruction = basic[i];
			expect([
				instruction.getExampleFormat(),
				instruction.getDescription(),
				instruction.getOperationMask(),
				String(instruction.getOpcodeMask()),
				String(instruction.getOpcodeMatch()),
				instruction.getTokenList()!.toString(),
				instruction.getTokenList()!.toTypeString()
			]).toEqual([
				decode(row[0]),
				decode(row[1]),
				row[2],
				row[4],
				row[5],
				decode(row[8]),
				decode(row[9])
			]);
		}
		const counts = rows.find((row) => row[0] === 'COUNT')!;
		expect(
			m.set.getInstructionList().filter((instruction) => instruction instanceof BasicInstruction)
		).toHaveLength(Number(counts[1]));
		expect(m.set.getInstructionList()).toHaveLength(Number(counts[2]));
		m.setDelayed(true);
		const pseudoRows = rows.filter((row) => row[0] === 'P');
		const pseudo = m.set
			.getInstructionList()
			.filter((instruction) => instruction instanceof ExtendedInstruction);
		expect(pseudo).toHaveLength(pseudoRows.length);
		for (let i = 0; i < pseudoRows.length; i++) {
			const row = pseudoRows[i],
				instruction = pseudo[i];
			const list = (value: string[] | null) => (value === null ? 'null' : `[${value.join(', ')}]`);
			expect([
				instruction.getExampleFormat(),
				instruction.getDescription(),
				list(instruction.getBasicIntructionTemplateList()),
				list(instruction.getCompactBasicIntructionTemplateList()),
				String(instruction.getInstructionLength()),
				String(instruction.getCompactInstructionLength())
			]).toEqual([...row.slice(1, 5).map(decode), ...row.slice(5)]);
		}
	});
	it('matches most-specific binary decoding, overlaps, ignored fields, and unknown words', () => {
		const m = machine();
		for (const row of rows.filter((row) => row[0] === 'D'))
			expect(m.set.findByBinaryCode(Number(row[1]))?.getExampleFormat() ?? '', row[1]).toBe(
				decode(row[2])
			);
		expect(
			m.set.matchOperator('ADD')?.map((instruction) => instruction.getExampleFormat())
		).toEqual(m.set.matchOperator('add')?.map((instruction) => instruction.getExampleFormat()));
		expect(m.set.prefixMatchOperator(null)).toBeNull();
		expect(m.set.matchOperator(null)).toBeNull();
		for (const row of rows.filter((row) => row[0] === 'M'))
			expect(
				m.set
					.matchOperator(decode(row[1]))
					?.map((instruction) => instruction.getExampleFormat())
					.join('\n') ?? '<null>'
			).toBe(decode(row[2]));
		expect(m.set.prefixMatchOperator('no-such-op')).toBeNull();
		expect(m.set.prefixMatchOperator('')?.length).toBe(m.set.getInstructionList().length);
	});
	const grouped = Map.groupBy(
		rows.filter((row) => /^\d+$/.test(row[0])),
		(row) => Number(row[0])
	);
	const callbackMachine = machine();
	for (const [index, cases] of grouped)
		it(`${index}: ${decode(cases[0][2])} matches Java state and exceptions across32 cases`, () => {
			const m = callbackMachine;
			const instruction = m.set.getInstructionList()[index] as BasicInstruction<ProgramStatement>;
			for (const row of cases) {
				const scenario = Number(row[1]);
				m.memory.clear();
				m.registerFile.resetRegisters();
				m.coprocessor0.resetRegisters();
				m.coprocessor1.resetRegisters();
				m.delayedBranch.clear();
				m.setDelayed(scenario % 2 === 1);
				const a = values[scenario % values.length],
					b = values[(scenario + (scenario < 16 ? 3 : 1)) % values.length];
				for (let r = 1; r < 32; r++) {
					m.registerFile.updateRegister(r, r % 4 < 2 ? b : a);
					m.coprocessor1.updateRegister(r, r % 4 < 2 ? b : a);
				}
				m.coprocessor1.updateRegister(0, b);
				if (scenario >= 16) {
					const doubles = [
						-5.5,
						-4.5,
						4.5,
						5.5,
						2147483647.5,
						-2147483648.5,
						NaN,
						Infinity,
						-Infinity,
						0,
						-0,
						Number.MIN_VALUE,
						Number.MAX_VALUE,
						1.25,
						-2.75,
						Math.sqrt(2)
					];
					for (let r = 0; r < 32; r += 2)
						m.coprocessor1.setRegisterPairToDouble(
							r,
							doubles[(scenario - 16 + (r % 4 === 0 ? 1 : 0)) % 16]
						);
				}
				m.registerFile.updateRegister(33, 0x87654321);
				m.registerFile.updateRegister(34, 0x12345678);
				m.coprocessor1.setConditionFlags();
				if (scenario % 2 === 0) m.coprocessor1.clearConditionFlags();
				m.coprocessor0.updateRegister(14, 0x00400200);
				m.registerFile.setProgramCounter(0x00400004);
				for (let i = -8; i < 20; i += 4) m.memory.setWord(0x10010000 + i, 0x89abcdef + i);
				if (instruction.getExampleFormat().includes('($t2)'))
					m.registerFile.updateRegister(6, scenario === 15 ? 0 : 0x10010000);
				if (instruction.getName() === 'syscall') m.registerFile.updateRegister(2, 99999);
				const statement = new ProgramStatement(
					null,
					'',
					new TokenList(),
					new TokenList(),
					instruction,
					0x00400000,
					0,
					m.statementHost
				);
				const operands = JSON.parse(row[3]) as number[];
				statement.getOperands()!.splice(0, 4, ...operands);
				let outcome = 'ok';
				try {
					instruction.getSimulationCode().simulate(statement);
				} catch (error) {
					if (error instanceof ProcessingException)
						outcome = error.errors()?.generateErrorReport() ?? 'exit';
					else throw error;
				}
				const state: number[] = [];
				for (let r = 0; r < 35; r++) if (r !== 32) state.push(m.registerFile.getValue(r));
				state.push(m.registerFile.getProgramCounter());
				for (let r = 0; r < 32; r++) state.push(m.coprocessor1.getValue(r));
				for (const r of [8, 12, 13, 14]) state.push(m.coprocessor0.getValue(r));
				state.push(
					m.coprocessor1.getConditionFlags(),
					Number(m.delayedBranch.isRegistered()),
					m.delayedBranch.getBranchTargetAddress()
				);
				for (let i = -8; i < 20; i += 4) state.push(m.memory.getWord(0x10010000 + i));
				expect({ outcome, state: state.join(',') + ',' }, `scenario${scenario}`).toEqual({
					outcome: decode(row[4]),
					state: row[5]
				});
			}
		});
	it('keeps independent hardware and decode registries per session', () => {
		const a = machine(),
			b = machine();
		a.registerFile.updateRegister(2, 123);
		a.memory.setWord(0x10010000, -1);
		a.setDelayed(true);
		a.delayedBranch.register(1024);
		expect(b.registerFile.getValue(2)).toBe(0);
		expect(b.memory.getWord(0x10010000)).toBe(0);
		expect(b.delayedBranch.isRegistered()).toBe(false);
		expect(a.set.findByBinaryCode(0)).not.toBe(b.set.findByBinaryCode(0));
	});
});
