import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { BackStepper } from './BackStepper.js';
import { Memory, type MemoryStatement } from '../hardware/memory/Memory.js';
import { RegisterFile } from '../hardware/registers/RegisterFile.js';
import { Coprocessor0 } from '../hardware/registers/Coprocessor0.js';
import { Coprocessor1 } from '../hardware/registers/Coprocessor1.js';
import { DelayedBranch } from './DelayedBranch.js';

const T = 0x00400000,
	D = 0x10010000;
const golden = JSON.parse(readFileSync('tests/oracle/backstep-units/golden.json', 'utf8')) as {
	stdout: string;
	stderr: string;
	status: number;
};

it('matches Java undo grouping, every hardware action, PC adjustment, flags, delay slots, and circular capacity', () => {
	const output: string[] = [];
	let back: BackStepper<MemoryStatement> | undefined;
	const branch = new DelayedBranch();
	const registers = new RegisterFile(undefined, {
		addRegisterFileRestore: (n, old) =>
			back?.enabled() ? back.addRegisterFileRestore(n, old) : old,
		addPCRestore: (old) => {
			if (back?.enabled()) back.addPCRestore(old);
		}
	});
	const cp0 = new Coprocessor0((n, old) =>
		back?.enabled() ? back.addCoprocessor0Restore(n, old) : old
	);
	const cp1 = new Coprocessor1({
		addCoprocessor1Restore: (n, old) =>
			back?.enabled() ? back.addCoprocessor1Restore(n, old) : old,
		addConditionFlagClear: (flag) => {
			if (back?.enabled()) back.addConditionFlagClear(flag);
		},
		addConditionFlagSet: (flag) => {
			if (back?.enabled()) back.addConditionFlagSet(flag);
		}
	});
	const memory = new Memory<MemoryStatement>({
		decodeStatement: (word) => ({ getBinaryStatement: () => word }),
		addMemoryRestoreRawWord: (a, old) => {
			if (back?.enabled()) back.addMemoryRestoreRawWord(a, old);
		},
		addMemoryRestoreWord: (a, old) => (back?.enabled() ? back.addMemoryRestoreWord(a, old) : old),
		addMemoryRestoreHalf: (a, old) => (back?.enabled() ? back.addMemoryRestoreHalf(a, old) : old),
		addMemoryRestoreByte: (a, old) => (back?.enabled() ? back.addMemoryRestoreByte(a, old) : old)
	});
	const fresh = () => {
		back = undefined;
		memory.clear();
		registers.resetRegisters();
		cp0.resetRegisters();
		cp1.resetRegisters();
		branch.clear();
		for (let i = 0; i < 2010; i++) memory.setStatement(T + i * 4, { getBinaryStatement: () => 0 });
		memory.setWord(D, 0);
		back = new BackStepper({
			memory,
			registerFile: registers,
			coprocessor0: cp0,
			coprocessor1: cp1,
			inDelaySlot: () => branch.isTriggered(),
			fatal: (message) => {
				throw new Error(message);
			}
		});
		return back;
	};
	const emit = (key: string) =>
		output.push(
			`${key}\t${[back!.enabled(), back!.empty(), back!.inDelaySlot(), registers.getProgramCounter(), registers.getValue(8), registers.getValue(9), memory.getWord(D), cp0.getValue(8), cp1.getValue(0), cp1.getConditionFlags()].join(',')}`
		);
	let b = fresh();
	emit('fresh');
	registers.initializeProgramCounter(T + 4);
	registers.updateRegister(8, 11);
	registers.updateRegister(9, 22);
	memory.setWord(D, 0x12345678);
	memory.setHalf(D, 0xaabb);
	memory.setByte(D + 1, 0xcc);
	memory.setRawWord(D, -1);
	cp0.updateRegister(8, 123);
	cp1.updateRegister(0, 456);
	cp1.setConditionFlag(3);
	b.addDoNothing(T);
	emit('group-written');
	b.backStep();
	emit('group-restored');
	registers.initializeProgramCounter(T + 4);
	registers.updateRegister(8, 10);
	registers.initializeProgramCounter(T + 8);
	registers.updateRegister(8, 20);
	b.setEnabled(false);
	b.backStep();
	emit('disabled-undo');
	b.setEnabled(true);
	b.backStep();
	emit('second-undone');
	b.backStep();
	emit('first-undone');
	registers.initializeProgramCounter(T + 4);
	cp1.setConditionFlag(2);
	registers.initializeProgramCounter(T + 8);
	cp1.clearConditionFlag(2);
	b.backStep();
	emit('condition-restored-set');
	b.backStep();
	emit('condition-restored-clear');
	registers.initializeProgramCounter(T + 4);
	registers.setProgramCounter(T + 100);
	emit('branch');
	b.backStep();
	emit('branch-undone');
	branch.register(T + 100);
	branch.trigger();
	b.addDoNothing(T + 4);
	emit('delay-recorded');
	branch.clear();
	emit('delay-retained');
	b.backStep();
	emit('delay-undone');
	b = fresh();
	registers.initializeProgramCounter(T);
	registers.updateRegister(8, 7);
	registers.updateRegister(9, 8);
	b.backStep();
	emit('gui-before-program');
	b = fresh();
	registers.initializeProgramCounter(T + 40000);
	registers.updateRegister(8, 7);
	registers.updateRegister(9, 8);
	b.backStep();
	emit('null-statement-group');
	b = fresh();
	b.setEnabled(false);
	b.addRegisterFileRestore(8, 99);
	emit('disabled-add');
	b.setEnabled(true);
	b.backStep();
	emit('disabled-add-undone');
	b = fresh();
	for (let i = 0; i < 2005; i++) {
		registers.initializeProgramCounter(T + (i + 1) * 4);
		registers.updateRegister(8, i + 1);
	}
	let count = 0;
	while (!b.empty()) {
		b.backStep();
		count++;
	}
	output.push(`capacity\t${count}`);
	emit('capacity-state');
	b = fresh();
	output.push(`pc-return\t${b.addPCRestore(-2147483648)}`);
	b.backStep();
	emit('pc-wrap');
	expect(output.join('\n') + '\n').toBe(golden.stdout);
	expect(golden.stderr).toBe('');
	expect(golden.status).toBe(0);
});

it('keeps histories isolated and reports fatal restore failures through the injected boundary', () => {
	const registers = new RegisterFile();
	let failure: [string, number] | undefined;
	const host = {
		memory: {
			getStatementNoNotify: () => ({ getBinaryStatement: () => 0 }),
			setRawWord: () => {
				throw new Error('restore failed');
			},
			setWord: () => 0,
			setHalf: () => 0,
			setByte: () => 0
		},
		registerFile: registers,
		coprocessor0: new Coprocessor0(),
		coprocessor1: new Coprocessor1(),
		inDelaySlot: () => false,
		fatal: (message: string, status: number): never => {
			failure = [message, status];
			throw new Error('terminated');
		}
	};
	const first = new BackStepper(host),
		second = new BackStepper(host);
	first.addMemoryRestoreRawWord(D, 1);
	expect(second.empty()).toBe(true);
	expect(() => first.backStep()).toThrow('terminated');
	expect(failure).toEqual(['Internal MARS error: address exception while back-stepping.\n', 0]);
	expect(first.enabled()).toBe(false);
});
