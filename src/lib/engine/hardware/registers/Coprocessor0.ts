/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 * Ports mars/mips/hardware/Coprocessor0.java. */
import { Register, type RegisterObserver } from './Register.js';
import type { AccessOrigin } from '../notices/AccessNotice.js';

/** Session-owned interrupt and exception registers. */
export class Coprocessor0 {
	/** Bad virtual address register number. */
	static readonly VADDR = 8;
	/** Status register number. */
	static readonly STATUS = 12;
	/** Exception cause register number. */
	static readonly CAUSE = 13;
	/** Exception program counter register number. */
	static readonly EPC = 14;
	/** Exception-level bit position in status. */
	static readonly EXCEPTION_LEVEL = 1;
	/** Initial interrupt mask, user mode, and interrupt enable bits. */
	static readonly DEFAULT_STATUS_VALUE = 0xff11;
	private readonly registers: Register[];
	/** Creates this session's registers; restore is invoked only for numeric updateRegister calls. Standalone callbacks must be closures or already bound to their owner. */
	constructor(
		private readonly restore?: (number: number, old: number) => number,
		origin?: () => AccessOrigin
	) {
		this.registers = [
			new Register('$8 (vaddr)', 8, 0, origin),
			new Register('$12 (status)', 12, Coprocessor0.DEFAULT_STATUS_VALUE, origin),
			new Register('$13 (cause)', 13, 0, origin),
			new Register('$14 (epc)', 14, 0, origin)
		];
	}
	/** Emits the original diagnostic lines through the supplied host writer. */
	showRegisters(write: (text: string) => void): void {
		for (const r of this.registers)
			write(`Name: ${r.getName()}\nNumber: ${r.getNumber()}\nValue: ${r.getValue()}\n\n`);
	}
	/** Updates an implemented register; string updates retain Java's read-before-write and no-backstep behavior. */
	updateRegister(number: number | string, value: number): number {
		const r =
			typeof number === 'string'
				? this.getRegister(number)
				: this.registers.find((r) => r.getNumber() === number);
		if (!r) return 0;
		if (typeof number === 'string') {
			const old = r.getValue();
			r.setValue(value);
			return old;
		}
		const old = r.setValue(value);
		return this.restore?.(number, old) ?? old;
	}
	/** Reads a register; unimplemented register numbers return zero. */
	getValue(number: number): number {
		return this.registers.find((r) => r.getNumber() === number)?.getValue() ?? 0;
	}
	/** Resolves a dollar-prefixed number or full display name, or -1. */
	getNumber(name: string): number {
		return this.getRegister(name)?.getNumber() ?? -1;
	}
	/** Returns the owned registers in display order. */
	getRegisters(): readonly Register[] {
		return this.registers;
	}
	/** Returns the identity-based list position, or -1. */
	getRegisterPosition(register: Register): number {
		return this.registers.indexOf(register);
	}
	/** Resolves a dollar-prefixed number or full display name, or null. */
	getRegister(name: string): Register | null {
		return this.registers.find((r) => `$${r.getNumber()}` === name || r.getName() === name) ?? null;
	}
	/** Silently resets all four registers. */
	resetRegisters(): void {
		this.registers.forEach((r) => r.resetValue());
	}
	/** Subscribes to all implemented registers; caller releases the returned teardown. */
	addRegistersObserver(observer: RegisterObserver): () => void {
		const releases = this.registers.map((r) => r.subscribe(observer));
		return () => releases.forEach((release) => release());
	}
}
