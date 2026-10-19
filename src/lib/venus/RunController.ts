/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports the engine workflows in mars/venus/Run{Assemble,Go,Step,Backstep,Pause,Stop,Reset}Action.java. */
import { Globals } from '../engine/Globals.js';
import type { MIPSprogram } from '../engine/assembler/MIPSprogram.js';
import type { ProgramStatement } from '../engine/assembler/ProgramStatement.js';
import type { ErrorList } from '../engine/diagnostics/ErrorList.js';
import { ProcessingException } from '../engine/diagnostics/ProcessingException.js';
import { Simulator } from '../engine/simulator/Simulator.js';
import type { SimulatorAction } from '../engine/simulator/SimulatorAction.js';

/** Desktop execution state; concrete registers/memory remain owned by the machine. */
export interface RunState {
	/** Increases after every controller publication, including silent register resets. */
	readonly revision: number;
	/** Current desktop run state. */
	readonly status: 'idle' | 'assembled' | 'running' | 'paused' | 'terminated' | 'error';
	/** Whether this assembly has begun executing. */
	readonly started: boolean;
	/** Whether the machine is still at its assembly/reset state. */
	readonly reset: boolean;
	/** Last canonical Simulator stop reason, or zero before execution. */
	readonly reason: number;
	/** Last reported processing error, or null. */
	readonly error: ProcessingException | null;
	/** Most recent assembly diagnostics, including warnings. */
	readonly diagnostics: ErrorList | null;
	/** Programs retained for canonical Reset, which does not reread edited buffers. */
	readonly programs: readonly MIPSprogram[];
	/** Successful machine statements, in the original unsigned-address sort order. */
	readonly statements: readonly ProgramStatement[];
}
/** Subscriber to read-only controller state; teardown belongs to its GUI owner. */
export type RunStateObserver = (state: RunState) => void;

/** Framework-free Venus action coordinator; source selection and modal/console presentation stay with its GUI owner. */
export class RunController {
	private state: RunState = {
		revision: 0,
		status: 'idle',
		started: false,
		reset: false,
		reason: 0,
		error: null,
		diagnostics: null,
		programs: [],
		statements: []
	};
	private readonly observers = new Set<RunStateObserver>();
	private programs: MIPSprogram[] | null = null;
	private extended = true;
	private warnings = false;
	private pending: Promise<boolean> | null = null;
	private disposed = false;
	private disposalPromise: Promise<void> | null = null;
	private readonly unsubscribeSimulator: () => void;
	/** Bind one GUI controller to one machine; constructor owns one simulator subscription. */
	constructor(readonly machine: Globals) {
		this.unsubscribeSimulator = machine.simulator.subscribe(() => this.refresh());
	}
	/** Return the latest immutable state record; referenced program/statement objects remain engine-owned. */
	getState(): RunState {
		return this.state;
	}
	/** Subscribe and receive the current state immediately; caller must invoke the returned teardown. */
	subscribe(observer: RunStateObserver): () => void {
		this.observers.add(observer);
		observer(this.state);
		return () => this.observers.delete(observer);
	}
	/** Publish a revision after timed execution or external machine edits without copying engine state. */
	refresh(): void {
		if (!this.disposed) this.publish({});
	}
	/** Read current virtual buffers and assemble either the lead file or explicitly supplied open files. */
	assemble(openFilenames: readonly string[], leadFilename: string): ErrorList | null {
		this.requireIdle();
		const settings = this.machine.getSettings();
		this.extended = settings.getExtendedAssemblerEnabled();
		this.warnings = settings.getWarningsAreErrors();
		const filenames = settings.getAssembleAllEnabled() ? [...openFilenames] : [leadFilename];
		const exceptionHandler =
			settings.getExceptionHandlerEnabled() && settings.getExceptionHandler().length > 0
				? settings.getExceptionHandler()
				: null;
		const program = this.machine.createProgram();
		this.machine.program = program;
		this.programs = null;
		try {
			this.programs = program.prepareFilesForAssembly(filenames, leadFilename, exceptionHandler);
			const diagnostics = program.assemble(this.programs, this.extended, this.warnings);
			this.resetRegisters();
			this.machine.systemIO.resetFiles();
			this.publish({
				status: 'assembled',
				started: false,
				reset: true,
				reason: 0,
				error: null,
				diagnostics,
				programs: this.programs,
				statements: program.getMachineList() ?? []
			});
			return diagnostics;
		} catch (error) {
			this.assemblyFailure(error);
			throw error;
		}
	}
	/** Invalidate assembled execution after a source edit; retained engine memory remains available for inspection. */
	invalidate(): void {
		this.requireIdle();
		this.programs = null;
		this.publish({
			status: 'idle',
			started: false,
			reset: false,
			reason: 0,
			error: null,
			diagnostics: null,
			programs: [],
			statements: []
		});
	}
	/** Run from current PC with current breakpoint addresses and an optional instruction limit. */
	run(breakpoints: readonly number[] = [], maxSteps = -1): Promise<boolean> {
		return this.execute(false, breakpoints, maxSteps);
	}
	/** Execute exactly one machine instruction, preserving the canonical stepped-execution flag. */
	step(): Promise<boolean> {
		return this.execute(true, [], 1);
	}
	/** Request pause at the next canonical instruction boundary, releasing pending host input. */
	pause(): void {
		this.machine.simulator.stopExecution({ name: 'Pause' });
	}
	/** Request Stop; the initiating Go callback owns final desktop state. */
	stop(): void {
		this.machine.simulator.stopExecution({ name: 'Stop' });
	}
	/** Undo the most recent instruction using the actual program's BackStepper. */
	backStep(): void {
		this.requireIdle();
		this.requireProgram();
		if (this.machine.getSettings().getBackSteppingEnabled()) {
			this.machine.withGuiAccess(() => this.machine.program!.getBackStepper()!.backStep());
			this.publish({ status: 'paused', started: true, reset: false, error: null, reason: 0 });
		}
	}
	/** Reassemble retained tokenized programs with the previous assembly policy, then reset registers. */
	reset(): ErrorList | null {
		this.requireIdle();
		this.requireProgram();
		try {
			const diagnostics = this.machine.program!.assemble(
				this.programs,
				this.extended,
				this.warnings
			);
			this.resetRegisters();
			this.machine.systemIO.resetFiles();
			this.publish({
				status: 'assembled',
				started: false,
				reset: true,
				reason: 0,
				error: null,
				diagnostics,
				statements: this.machine.program!.getMachineList() ?? []
			});
			return diagnostics;
		} catch (error) {
			this.assemblyFailure(error);
			throw error;
		}
	}
	/** Stop and await execution before releasing controller/machine subscriptions and host file resources. */
	dispose(): Promise<void> {
		if (this.disposalPromise !== null) return this.disposalPromise;
		this.disposed = true;
		this.unsubscribeSimulator();
		this.observers.clear();
		this.stop();
		this.disposalPromise = Promise.resolve(this.pending)
			.then(() => {})
			.finally(() => this.machine.dispose());
		return this.disposalPromise;
	}
	private execute(
		step: boolean,
		breakpoints: readonly number[],
		maxSteps: number
	): Promise<boolean> {
		this.requireIdle();
		this.requireProgram();
		if (this.state.status === 'terminated' || this.state.status === 'error')
			throw new Error('Reset or assemble the program before running it again.');
		this.publish({ status: 'running', started: true, error: null, reason: 0 });
		if (this.disposed) throw new Error('This run controller has been disposed.');
		const action: SimulatorAction = step
			? { name: 'Step', stepped: (done, reason, error) => this.finished(done, reason, error) }
			: {
					name: 'Go',
					paused: (done, reason, error) => this.finished(done, reason, error),
					stopped: (error, reason) => this.finished(true, reason, error)
				};
		const operation = step
			? this.machine.program!.simulateStepAtPC(action)
			: this.machine.program!.simulateFromPC(breakpoints, maxSteps, action);
		this.pending = operation
			.then((done) => {
				if (this.state.status === 'running')
					this.finished(done, done ? Simulator.CLIFF_TERMINATION : Simulator.MAX_STEPS, null);
				return done;
			})
			.catch((error) => {
				if (error instanceof ProcessingException) this.finished(true, Simulator.EXCEPTION, error);
				else this.publish({ status: 'error', reset: false });
				throw error;
			})
			.finally(() => {
				this.pending = null;
				this.refresh();
			});
		return this.pending;
	}
	private finished(done: boolean, reason: number, error: ProcessingException | null): void {
		this.publish({
			status: error !== null ? 'error' : done ? 'terminated' : 'paused',
			reset: false,
			reason,
			error
		});
	}
	private resetRegisters(): void {
		this.machine.withGuiAccess(() => {
			this.machine.registerFile.resetRegisters();
			this.machine.coprocessor1.resetRegisters();
			this.machine.coprocessor0.resetRegisters();
		});
	}
	private assemblyFailure(error: unknown): void {
		this.publish({
			status: 'error',
			started: false,
			reset: false,
			reason: 0,
			error: error instanceof ProcessingException ? error : null,
			diagnostics: error instanceof ProcessingException ? error.errors() : null,
			programs: this.programs ?? [],
			statements: []
		});
	}
	private requireIdle(): void {
		if (this.disposed) throw new Error('This run controller has been disposed.');
		if (
			this.state.status === 'running' ||
			this.pending !== null ||
			this.machine.simulator.isRunning()
		)
			throw new Error('Pause or stop execution before changing the assembled machine.');
	}
	private requireProgram(): void {
		if (
			this.machine.program === null ||
			this.programs === null ||
			this.machine.program.getMachineList() === null
		)
			throw new Error('The program must be assembled before it can be run.');
	}
	private publish(update: Partial<RunState>): void {
		this.state = Object.freeze({ ...this.state, ...update, revision: this.state.revision + 1 });
		for (const observer of [...this.observers]) observer(this.state);
	}
}
