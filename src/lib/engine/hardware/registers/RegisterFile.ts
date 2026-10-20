/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 * Ports mars/mips/hardware/RegisterFile.java. */
import { Binary } from '../../formatting/Binary.js';
import { Register, type RegisterObserver } from './Register.js';
import type { AccessOrigin } from '../notices/AccessNotice.js';
import { MemoryConfigurations } from '../memory/MemoryConfigurations.js';
import type { MemoryConfiguration } from '../memory/MemoryConfiguration.js';

/** Session collaborators replace the Java Globals dependencies. */
export interface RegisterFileHost {
	/** Records a restore only when backstepping is enabled; returns the old value. */
	addRegisterFileRestore?: (number: number, old: number) => number;
	/** Records a PC restore only when backstepping is enabled. */
	addPCRestore?: (old: number) => void;
	/** Returns the valid text address of the start label, or null. */
	getStartAddress?: () => number | null;
	/** Returns whether reset should use the start label. */
	getStartAtMain?: () => boolean;
	/** Returns the current access context. */
	getAccessOrigin?: () => AccessOrigin;
}

/** A session's general registers, PC, HI, and LO; no process-global machine state. */
export class RegisterFile {
	/** Architectural global-pointer register number. */
	static readonly GLOBAL_POINTER_REGISTER = 28;
	/** Architectural stack-pointer register number. */
	static readonly STACK_POINTER_REGISTER = 29;
	private readonly registers: Register[];
	private readonly pc: Register;
	private readonly hi: Register;
	private readonly lo: Register;
	/** Creates the register file with the selected memory layout and injected session services. */
	constructor(
		configuration: MemoryConfiguration = new MemoryConfigurations().getDefaultConfiguration(),
		private readonly host: RegisterFileHost = {}
	) {
		const origin = () => host.getAccessOrigin?.() ?? 'other';
		const names = [
			'$zero',
			'$at',
			'$v0',
			'$v1',
			'$a0',
			'$a1',
			'$a2',
			'$a3',
			'$t0',
			'$t1',
			'$t2',
			'$t3',
			'$t4',
			'$t5',
			'$t6',
			'$t7',
			'$s0',
			'$s1',
			'$s2',
			'$s3',
			'$s4',
			'$s5',
			'$s6',
			'$s7',
			'$t8',
			'$t9',
			'$k0',
			'$k1',
			'$gp',
			'$sp',
			'$fp',
			'$ra'
		];
		this.registers = names.map(
			(name, i) =>
				new Register(
					name,
					i,
					i === 28
						? configuration.getGlobalPointer()
						: i === 29
							? configuration.getStackPointer()
							: 0,
					origin
				)
		);
		this.pc = new Register('pc', 32, configuration.getTextBaseAddress(), origin);
		this.hi = new Register('hi', 33, 0, origin);
		this.lo = new Register('lo', 34, 0, origin);
	}
	/** Emits the original debugging lines through an injected output function. */
	showRegisters(write: (text: string) => void): void {
		for (const r of this.registers)
			write(`Name: ${r.getName()}\nNumber: ${r.getNumber()}\nValue: ${r.getValue()}\n\n`);
	}
	/** Updates an architectural register or HI/LO; register zero and unknown numbers are ignored. */
	updateRegister(number: number | string, value: number): number {
		if (typeof number === 'string') {
			const r = this.registers.find((r) => r.getName() === number);
			return r ? this.updateRegister(r.getNumber(), value) : 0;
		}
		const r = number === 33 ? this.hi : number === 34 ? this.lo : this.registers[number];
		if (number === 0 || !r) return 0;
		const old = r.setValue(value);
		return this.host.addRegisterFileRestore?.(number, old) ?? old;
	}
	/** Reads a general register or HI/LO; PC is available through getProgramCounter. */
	getValue(number: number): number {
		return (number === 33 ? this.hi : number === 34 ? this.lo : this.registers[number]).getValue();
	}
	/** Looks up a mnemonic, returning -1 if unknown. */
	getNumber(name: string): number {
		return this.registers.find((r) => r.getName() === name)?.getNumber() ?? -1;
	}
	/** Returns the owned general registers; callers must not replace entries. */
	getRegisters(): readonly Register[] {
		return this.registers;
	}
	/** Returns HI for observation and non-notifying display. */
	getHighOrderRegister(): Register {
		return this.hi;
	}
	/** Returns LO for observation and non-notifying display. */
	getLowOrderRegister(): Register {
		return this.lo;
	}
	/** Looks up numeric or mnemonic dollar-prefixed general register names. */
	getUserRegister(name: string): Register | null {
		if (!name.length) throw new RangeError('StringIndexOutOfBoundsException');
		if (name[0] !== '$') return null;
		const number = name.slice(1);
		// Named general and floating registers cannot parse as integers; avoid constructing caught errors.
		if (Binary.isIntegerCandidate(number)) {
			try {
				const r = this.registers[Binary.stringToInt(number)];
				if (r) return r;
			} catch {
				/* Try the mnemonic. */
			}
		}
		return this.registers.find((r) => r.getName() === name) ?? null;
	}
	/** Initializes PC without backstep recording; true selects a host-validated main address if available. */
	initializeProgramCounter(value: number | boolean): void {
		this.pc.setValue(
			typeof value === 'number'
				? value
				: value
					? (this.host.getStartAddress?.() ?? this.pc.getResetValue())
					: this.pc.getResetValue()
		);
	}
	/** Writes a jump/branch PC and records the previous value through the host. */
	setProgramCounter(value: number): number {
		const old = this.pc.getValue();
		this.pc.setValue(value);
		this.host.addPCRestore?.(old);
		return old;
	}
	/** Reads PC with notification. */
	getProgramCounter(): number {
		return this.pc.getValue();
	}
	/** Returns the owned PC register. */
	getProgramCounterRegister(): Register {
		return this.pc;
	}
	/** Returns the reset PC. */
	getInitialProgramCounter(): number {
		return this.pc.getResetValue();
	}
	/** Resets general registers silently and initializes PC according to the host setting. */
	resetRegisters(): void {
		this.registers.forEach((r) => r.resetValue());
		this.initializeProgramCounter(this.host.getStartAtMain?.() ?? false);
		this.hi.resetValue();
		this.lo.resetValue();
	}
	/** Advances PC by the MIPS instruction width with word wrap. */
	incrementPC(): void {
		this.pc.setValue((this.pc.getValue() + 4) | 0);
	}
	/** Subscribes to general registers and HI/LO, excluding PC as in Java; caller owns teardown. */
	addRegistersObserver(observer: RegisterObserver): () => void {
		const releases = [...this.registers, this.hi, this.lo].map((r) => r.subscribe(observer));
		return () => releases.forEach((release) => release());
	}
}
