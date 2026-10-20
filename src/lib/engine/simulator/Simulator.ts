/* Copyright (c) 2003–2010 Pete Sanderson and Kenneth Vollmar. MIT; see MARSlicense.txt.
 * Ports mars/simulator/Simulator.java; cooperative scheduling is documented in ADR 0004. */
import { ProgramStatement } from '../assembler/ProgramStatement.js';
import { BasicInstruction } from '../instructions/BasicInstruction.js';
import {
	ProcessingException,
	type ProcessingExceptionHost
} from '../diagnostics/ProcessingException.js';
import { ErrorList } from '../diagnostics/ErrorList.js';
import { ErrorMessage } from '../diagnostics/ErrorMessage.js';
import { Binary } from '../formatting/Binary.js';
import { AddressErrorException } from '../hardware/AddressErrorException.js';
import { Coprocessor0 } from '../hardware/Coprocessor0.js';
import type { Memory } from '../hardware/Memory.js';
import type { RegisterFile } from '../hardware/RegisterFile.js';
import type { BackStepper } from './BackStepper.js';
import type { DelayedBranch } from './DelayedBranch.js';
import { Exceptions } from './Exceptions.js';
import { SimulatorNotice } from './SimulatorNotice.js';
import type { SimulatorAction } from './SimulatorAction.js';

/** Program lifecycle operations consumed by the loop; the caller owns the assembled program. */
export interface SimulatorProgram {
	/** Whether the current history is present and enabled. */
	backSteppingEnabled(): boolean;
	/** Return the current program's history, or null before successful assembly. */
	getBackStepper(): BackStepper<ProgramStatement> | null;
}

/** Injected session hardware and scheduling replace Java globals, threads, and GUI calls. */
export interface SimulatorHost {
	/** Actual memory holding assembled/decoded statements. */
	memory: Memory<ProgramStatement>;
	/** Actual integer registers and PC. */
	registerFile: RegisterFile;
	/** Actual exception registers. */
	coprocessor0: Coprocessor0;
	/** Session-owned pending branch state. */
	delayedBranch: DelayedBranch;
	/** Runtime diagnostic/exception register services. */
	exceptionHost: ProcessingExceptionHost;
	/** Close/reset program-owned I/O handles when execution terminates. */
	resetFiles(): void;
	/** Current legacy run-speed value, with 40 denoting unlimited. */
	getRunSpeed(): number;
	/** Yield to the host event loop, optionally waiting the requested milliseconds. No timer lives in the engine. */
	yieldControl(delayMilliseconds: number): Promise<void>;
	/** Refresh visible registers/memory/instruction state during timed Go execution. */
	refresh?(): void;
	/** Maximum synchronous instructions between host yields during unlimited Go; default 1000. */
	instructionsPerYield?: number;
}

/** Consumer of an execution notice; owner must call the returned unsubscribe function. */
export type SimulatorObserver = (notice: SimulatorNotice) => void;
/** Consumer unblocking pending input when a stop/pause is requested. */
export type SimulatorStopListener = (simulator: Simulator) => void;

interface SimulationRun {
	program: SimulatorProgram;
	startPc: number;
	maxSteps: number;
	breakpoints: number[] | null;
	starter: SimulatorAction | null;
	stopper: SimulatorAction | null;
	stop: boolean;
	done: boolean;
	error: ProcessingException | null;
	reason: number;
}

/** Canonical execution loop with per-session state and bounded, injected cooperative yields. */
export class Simulator {
	/** No pending external device interrupt. */
	static readonly NO_DEVICE = 0;
	/** Paused before a breakpoint instruction. */
	static readonly BREAKPOINT = 1;
	/** Ended on an unhandled runtime exception. */
	static readonly EXCEPTION = 2;
	/** Reached the requested instruction limit, including a single step. */
	static readonly MAX_STEPS = 3;
	/** Exited via the normal syscall sentinel. */
	static readonly NORMAL_TERMINATION = 4;
	/** Fetched an empty instruction slot. */
	static readonly CLIFF_TERMINATION = 5;
	/** Left the loop following pause/stop. */
	static readonly PAUSE_OR_STOP = 6;
	/** Pending external interrupt cause, consumed once at the next instruction boundary. */
	externalInterruptingDevice = Simulator.NO_DEVICE;
	private active: SimulationRun | null = null;
	private readonly observers = new Set<SimulatorObserver>();
	private readonly stopListeners: SimulatorStopListener[] = [];
	/** Bind one machine and host; this constructor creates no timer or global state. */
	constructor(private readonly host: SimulatorHost) {}
	/** Whether the next instruction occupies a delayed branch slot. */
	inDelaySlot(): boolean {
		return this.host.delayedBranch.isTriggered();
	}
	/** Whether an execution operation still owns the machine, including a pending input or stop request. */
	isRunning(): boolean {
		return this.active !== null;
	}
	/** Whether a stop/pause already requested input release, including before a read was installed. */
	isStopRequested(): boolean {
		return this.active?.stop ?? false;
	}
	/** Subscribe to start/stop notices in Java Observable's reverse registration order. */
	subscribe(observer: SimulatorObserver): () => void {
		this.observers.add(observer);
		return () => this.observers.delete(observer);
	}
	/** Register an input-release listener; the caller owns the returned teardown. */
	addStopListener(listener: SimulatorStopListener): () => void {
		this.stopListeners.push(listener);
		return () => this.removeStopListener(listener);
	}
	/** Remove the first matching listener, matching Java ArrayList.remove. */
	removeStopListener(listener: SimulatorStopListener): void {
		const i = this.stopListeners.indexOf(listener);
		if (i >= 0) this.stopListeners.splice(i, 1);
	}
	/** Request pause/stop; completion remains at the next canonical instruction boundary. */
	stopExecution(actor: SimulatorAction | null): void {
		// Java releases its thread handle after the first request. Retain our owner
		// until completion, while keeping subsequent stop requests inert.
		if (!this.active || this.active.stop) return;
		this.active.stop = true;
		this.active.stopper = actor;
		for (const listener of [...this.stopListeners]) listener(this);
	}
	/** Execute one assembled program; resolves with completion or rejects an unhandled error for a null actor. */
	async simulate(
		program: SimulatorProgram,
		pc: number,
		maxSteps: number,
		breakpoints: number[] | null,
		actor: SimulatorAction | null
	): Promise<boolean> {
		if (this.active) throw new Error('This simulator already owns an active execution');
		const run: SimulationRun = {
			program,
			startPc: pc | 0,
			maxSteps: maxSteps | 0,
			breakpoints,
			starter: actor,
			stopper: null,
			stop: false,
			done: false,
			error: null,
			reason: 0
		};
		this.active = run;
		try {
			await this.construct(run);
			if (actor === null) {
				if (run.done) this.host.resetFiles();
				if (run.error !== null) throw run.error;
			} else this.finished(run);
			return run.done;
		} finally {
			if (this.active === run) this.active = null;
		}
	}
	private notify(action: number, run: SimulationRun, pc: number): void {
		const notice = new SimulatorNotice(action, run.maxSteps, this.host.getRunSpeed(), pc);
		for (const observer of [...this.observers].reverse()) observer(notice);
	}
	private stop(
		run: SimulationRun,
		reason: number,
		done: boolean,
		pc: number,
		error: ProcessingException | null = null
	): void {
		run.reason = reason;
		run.done = done;
		run.error = error;
		if (done) this.host.resetFiles();
		this.notify(SimulatorNotice.SIMULATOR_STOP, run, pc);
	}
	private fetchError(error: AddressErrorException, run: SimulationRun, noticePc: number): void {
		const pc = this.host.registerFile.getProgramCounter();
		const errors = new ErrorList();
		errors.add(
			new ErrorMessage(null, 0, 0, `invalid program counter value: ${Binary.intToHexString(pc)}`)
		);
		const failure = new ProcessingException(errors, error, this.host.exceptionHost);
		this.host.coprocessor0.updateRegister(
			Coprocessor0.EPC,
			this.host.registerFile.getProgramCounter()
		);
		this.stop(run, Simulator.EXCEPTION, true, noticePc, failure);
	}
	private async construct(run: SimulationRun): Promise<void> {
		await this.host.yieldControl(0);
		if (!run.breakpoints?.length) run.breakpoints = null;
		else run.breakpoints.sort((a, b) => a - b);
		this.notify(SimulatorNotice.SIMULATOR_START, run, run.startPc);
		const { registerFile, memory, delayedBranch } = this.host;
		registerFile.initializeProgramCounter(run.startPc);
		let statement: ProgramStatement | null;
		try {
			statement = memory.getStatement(registerFile.getProgramCounter());
		} catch (error) {
			if (!(error instanceof AddressErrorException)) throw error;
			this.fetchError(error, run, run.startPc);
			return;
		}
		let steps = 0,
			pc = 0,
			batch = 0;
		while (statement !== null) {
			pc = registerFile.getProgramCounter();
			registerFile.incrementPC();
			try {
				if (this.externalInterruptingDevice !== Simulator.NO_DEVICE) {
					const device = this.externalInterruptingDevice;
					this.externalInterruptingDevice = Simulator.NO_DEVICE;
					throw new ProcessingException(
						statement,
						'External Interrupt',
						this.host.exceptionHost,
						device
					);
				}
				const instruction = statement.getInstruction();
				if (instruction === null)
					throw new ProcessingException(
						statement,
						`undefined instruction (${Binary.intToHexString(statement.getBinaryStatement())})`,
						this.host.exceptionHost,
						Exceptions.RESERVED_INSTRUCTION_EXCEPTION
					);
				if (!(instruction instanceof BasicInstruction))
					throw new TypeError('A simulated statement must contain a basic instruction');
				const pending = instruction.getSimulationCode().simulate(statement);
				if (pending !== undefined) await pending;
				if (run.program.backSteppingEnabled()) run.program.getBackStepper()!.addDoNothing(pc);
			} catch (error) {
				if (!(error instanceof ProcessingException)) throw error;
				if (error.errors() === null) {
					this.stop(run, Simulator.NORMAL_TERMINATION, true, pc);
					return;
				}
				let handler: ProgramStatement | null = null;
				try {
					handler = memory.getStatement(memory.exceptionHandlerAddress);
				} catch (addressError) {
					if (!(addressError instanceof AddressErrorException)) throw addressError;
				}
				if (handler !== null) registerFile.setProgramCounter(memory.exceptionHandlerAddress);
				else {
					this.stop(run, Simulator.EXCEPTION, true, pc, error);
					return;
				}
			}
			if (delayedBranch.isTriggered()) {
				registerFile.setProgramCounter(delayedBranch.getBranchTargetAddress());
				delayedBranch.clear();
			} else if (delayedBranch.isRegistered()) delayedBranch.trigger();
			if (run.stop) {
				this.stop(run, Simulator.PAUSE_OR_STOP, false, pc);
				return;
			}
			if (
				run.breakpoints !== null &&
				this.hasBreakpoint(run.breakpoints, registerFile.getProgramCounter())
			) {
				this.stop(run, Simulator.BREAKPOINT, false, pc);
				return;
			}
			if (run.maxSteps > 0 && ++steps >= run.maxSteps) {
				this.stop(run, Simulator.MAX_STEPS, false, pc);
				return;
			}
			const speed = this.host.getRunSpeed();
			if (run.maxSteps !== 1 && speed < 40) {
				this.host.refresh?.();
				await this.host.yieldControl(Math.trunc(1000 / this.host.getRunSpeed()));
				batch = 0;
			} else if (++batch >= (this.host.instructionsPerYield ?? 1000)) {
				await this.host.yieldControl(0);
				batch = 0;
			}
			try {
				statement = memory.getStatement(registerFile.getProgramCounter());
			} catch (error) {
				if (!(error instanceof AddressErrorException)) throw error;
				this.fetchError(error, run, pc);
				return;
			}
		}
		if (delayedBranch.isTriggered() || delayedBranch.isRegistered()) delayedBranch.clear();
		this.stop(run, Simulator.CLIFF_TERMINATION, true, pc);
	}
	private hasBreakpoint(points: readonly number[], pc: number): boolean {
		let low = 0,
			high = points.length - 1;
		while (low <= high) {
			const mid = (low + high) >>> 1;
			if (points[mid] < pc) low = mid + 1;
			else if (points[mid] > pc) high = mid - 1;
			else return true;
		}
		return false;
	}
	private finished(run: SimulationRun): void {
		if (run.starter?.name === 'Step') run.starter.stepped?.(run.done, run.reason, run.error);
		if (run.starter?.name === 'Go') {
			if (run.done) run.starter.stopped?.(run.error, run.reason);
			else if (run.reason === Simulator.BREAKPOINT || run.stopper?.name === 'Pause')
				run.starter.paused?.(run.done, run.reason, run.error);
			else if (run.stopper?.name === 'Stop') run.starter.stopped?.(run.error, run.reason);
		}
	}
}
