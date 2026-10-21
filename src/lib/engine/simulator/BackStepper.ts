/* Copyright (c) 2003–2006 Pete Sanderson and Kenneth Vollmar. MIT; see MARSlicense.txt.
 * Ports mars/simulator/BackStepper.java. */
import type { Memory, MemoryStatement } from '../hardware/memory/Memory.js';
import type { RegisterFile } from '../hardware/registers/RegisterFile.js';
import type { Coprocessor0 } from '../hardware/registers/Coprocessor0.js';
import type { Coprocessor1 } from '../hardware/registers/Coprocessor1.js';
import { Instruction } from '../instructions/Instruction.js';
import { BackStepAction, type BackStep } from './BackStep.js';
import { BackstepStack } from './BackstepStack.js';

/** Detached bounded undo history; statement references retain their original grouping until serialization. */
export interface BackStepperState<Statement> {
	/** Whether recording/restoration are enabled. */
	enabled: boolean;
	/** Oldest-first copies of restoration records, without assign methods. */
	records: Omit<BackStep<Statement>, 'assign'>[];
}

/** Session-owned machine and fatal-error boundary used to restore canonical undo actions. */
export interface BackStepperHost<Statement extends MemoryStatement> {
	/** Original memory instance; restoration must use its normal write APIs. */
	memory: Pick<
		Memory<Statement>,
		'getStatementNoNotify' | 'setRawWord' | 'setWord' | 'setHalf' | 'setByte'
	>;
	/** Original integer-register and PC owner. */
	registerFile: Pick<RegisterFile, 'getProgramCounter' | 'setProgramCounter' | 'updateRegister'>;
	/** Original coprocessor-zero owner. */
	coprocessor0: Pick<Coprocessor0, 'updateRegister'>;
	/** Original coprocessor-one owner. */
	coprocessor1: Pick<Coprocessor1, 'updateRegister' | 'clearConditionFlag' | 'setConditionFlag'>;
	/** Current Simulator delay-slot state. */
	inDelaySlot(): boolean;
	/** Replace Java's fatal diagnostic and process exit; report the message/status and terminate this operation. */
	fatal(message: string, status: number): never;
}

/** Per-session bounded undo history, grouping all writes by original statement identity. */
export class BackStepper<Statement extends MemoryStatement = MemoryStatement> {
	private engaged = true;
	private readonly backSteps: BackstepStack<Statement>;
	/** Creates enabled history using the canonical Config.properties default limit unless supplied. */
	constructor(
		private readonly host: BackStepperHost<Statement>,
		maximumBacksteps = 2000
	) {
		this.backSteps = new BackstepStack(maximumBacksteps, {
			getStatementNoNotify: (address) => host.memory.getStatementNoNotify(address),
			inDelaySlot: () => host.inDelaySlot()
		});
	}
	/** Capture bounded undo records and their statement identities at an idle checkpoint. */
	captureState(): BackStepperState<Statement> {
		return { enabled: this.engaged, records: this.backSteps.captureState() };
	}
	/** Restore retained undo groups without recording hardware writes. */
	restoreState(state: BackStepperState<Statement>): void {
		this.backSteps.restoreState(state.records);
		this.engaged = state.enabled;
	}
	/** Whether callers should record undo actions; add methods themselves intentionally do not gate recording. */
	enabled(): boolean {
		return this.engaged;
	}
	/** Enables or disables recording/restoration without clearing history. */
	setEnabled(state: boolean): void {
		this.engaged = state;
	}
	/** Whether no actions can be undone. */
	empty(): boolean {
		return this.backSteps.empty();
	}
	/** Whether the next instruction to undo executed in a delayed branch slot. */
	inDelaySlot(): boolean {
		return !this.empty() && this.backSteps.peek().inDelaySlot;
	}
	/** Undoes every action of the latest statement, suppressing recursive recording through enabled(). */
	backStep(): void {
		if (!this.engaged || this.backSteps.empty()) return;
		const statement = this.backSteps.peek().ps;
		this.engaged = false;
		do {
			const step = this.backSteps.pop();
			if (step.pc !== -1) this.host.registerFile.setProgramCounter(step.pc);
			try {
				switch (step.action) {
					case BackStepAction.MemoryRawWord:
						this.host.memory.setRawWord(step.param1, step.param2);
						break;
					case BackStepAction.MemoryWord:
						this.host.memory.setWord(step.param1, step.param2);
						break;
					case BackStepAction.MemoryHalf:
						this.host.memory.setHalf(step.param1, step.param2);
						break;
					case BackStepAction.MemoryByte:
						this.host.memory.setByte(step.param1, step.param2);
						break;
					case BackStepAction.Register:
						this.host.registerFile.updateRegister(step.param1, step.param2);
						break;
					case BackStepAction.ProgramCounter:
						this.host.registerFile.setProgramCounter(step.param1);
						break;
					case BackStepAction.Coprocessor0:
						this.host.coprocessor0.updateRegister(step.param1, step.param2);
						break;
					case BackStepAction.Coprocessor1:
						this.host.coprocessor1.updateRegister(step.param1, step.param2);
						break;
					case BackStepAction.ConditionClear:
						this.host.coprocessor1.clearConditionFlag(step.param1);
						break;
					case BackStepAction.ConditionSet:
						this.host.coprocessor1.setConditionFlag(step.param1);
						break;
					case BackStepAction.DoNothing:
						break;
				}
			} catch {
				this.host.fatal('Internal MARS error: address exception while back-stepping.\n', 0);
			}
		} while (!this.backSteps.empty() && statement === this.backSteps.peek().ps);
		this.engaged = true;
	}
	private pc(): number {
		return (this.host.registerFile.getProgramCounter() - Instruction.INSTRUCTION_LENGTH) | 0;
	}
	/** Records raw-word restoration and returns the supplied old value. */
	addMemoryRestoreRawWord(address: number, value: number): number {
		this.backSteps.push(BackStepAction.MemoryRawWord, this.pc(), address, value);
		return value;
	}
	/** Records byte-order-aware word restoration and returns the old value. */
	addMemoryRestoreWord(address: number, value: number): number {
		this.backSteps.push(BackStepAction.MemoryWord, this.pc(), address, value);
		return value;
	}
	/** Records halfword restoration and returns the old value. */
	addMemoryRestoreHalf(address: number, value: number): number {
		this.backSteps.push(BackStepAction.MemoryHalf, this.pc(), address, value);
		return value;
	}
	/** Records byte restoration and returns the old value. */
	addMemoryRestoreByte(address: number, value: number): number {
		this.backSteps.push(BackStepAction.MemoryByte, this.pc(), address, value);
		return value;
	}
	/** Records integer-register restoration and returns the old value. */
	addRegisterFileRestore(register: number, value: number): number {
		this.backSteps.push(BackStepAction.Register, this.pc(), register, value);
		return value;
	}
	/** Records the original branch PC after subtracting the instruction width; returns that adjusted PC. */
	addPCRestore(value: number): number {
		value = (value - Instruction.INSTRUCTION_LENGTH) | 0;
		this.backSteps.push(BackStepAction.ProgramCounter, value, value);
		return value;
	}
	/** Records coprocessor-zero restoration and returns the old value. */
	addCoprocessor0Restore(register: number, value: number): number {
		this.backSteps.push(BackStepAction.Coprocessor0, this.pc(), register, value);
		return value;
	}
	/** Records coprocessor-one restoration and returns the old value. */
	addCoprocessor1Restore(register: number, value: number): number {
		this.backSteps.push(BackStepAction.Coprocessor1, this.pc(), register, value);
		return value;
	}
	/** Records setting a condition flag and returns its index. */
	addConditionFlagSet(flag: number): number {
		this.backSteps.push(BackStepAction.ConditionSet, this.pc(), flag);
		return flag;
	}
	/** Records clearing a condition flag and returns its index. */
	addConditionFlagClear(flag: number): number {
		this.backSteps.push(BackStepAction.ConditionClear, this.pc(), flag);
		return flag;
	}
	/** Records an instruction with no writes unless the newest record already has the same PC; returns zero. */
	addDoNothing(pc: number): number {
		if (this.backSteps.empty() || this.backSteps.peek().pc !== (pc | 0))
			this.backSteps.push(BackStepAction.DoNothing, pc);
		return 0;
	}
}
